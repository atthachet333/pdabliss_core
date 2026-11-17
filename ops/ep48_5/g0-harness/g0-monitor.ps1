# EP48.5 G0 harness - background monitor (started by Run-G0.ps1 as a job; read-only).
# Round 0 writes baseline.json. Every 15 s it re-checks; on a breach it writes STOP (first reason wins) and keeps
# recording. When MONITOR-END appears it takes the final snapshot (I5) and writes monitor-final.json.
param([int]$RunnerPid, [string]$Out, [string]$Pg, [int]$Port)
$ErrorActionPreference = 'Continue'
$stop = Join-Path $Out 'STOP'; $end = Join-Path $Out 'MONITOR-END'; $csv = Join-Path $Out 'monitor.csv'
$staging = @(1311, 1312, 5433, $Port)

function Snap {
  $procs = @{}; Get-CimInstance Win32_Process | ForEach-Object { $procs[[int]$_.ProcessId] = $_ }
  $kids = @{}; foreach ($p in $procs.Values) { $pp = [int]$p.ParentProcessId; if (-not $kids.ContainsKey($pp)) { $kids[$pp] = @() }; $kids[$pp] += [int]$p.ProcessId }
  $desc = { param($root) $seen = @{}; $q = New-Object System.Collections.Queue; $q.Enqueue($root); while ($q.Count) { $c = $q.Dequeue(); foreach ($k in @($kids[$c])) { if ($k -and -not $seen.ContainsKey($k) -and $k -ne $root) { $seen[$k] = 1; $q.Enqueue($k) } } }; @($seen.Keys) }
  # production PM2 daemon = the Daemon.js process with the most node children (the idle user daemons have none)
  $daemons = @($procs.Values | Where-Object { $_.Name -eq 'node.exe' -and "$($_.CommandLine)" -match 'pm2[\\/]lib[\\/]Daemon\.js' })
  $prod = $daemons | Sort-Object { @($kids[[int]$_.ProcessId]).Count } -Descending | Select-Object -First 1
  $tree = [ordered]@{}
  $prodPids = @()
  if ($prod) {
    $tree["$($prod.ProcessId)"] = "$($prod.CreationDate.ToString('o'))"
    foreach ($k in @($kids[[int]$prod.ProcessId])) { if ($k) { $tree["$k"] = "$($procs[$k].CreationDate.ToString('o'))"; $prodPids += $k; $prodPids += @(& $desc $k) } }
  }
  $pm = $procs.Values | Where-Object { $_.Name -eq 'postgres.exe' -and $procs[[int]$_.ParentProcessId] -and $procs[[int]$_.ParentProcessId].Name -eq 'pg_ctl.exe' } | Select-Object -First 1
  $infra = [ordered]@{
    postmaster = $(if ($pm) { "$($pm.ProcessId)@$($pm.CreationDate.ToString('o'))" } else { $null })
    mariadb = (@($procs.Values | Where-Object { $_.Name -match '^(mysqld|mariadbd)\.exe$' } | ForEach-Object { "$($_.ProcessId)@$($_.CreationDate.ToString('o'))" }) -join ',')
    cloudflared = (@($procs.Values | Where-Object { $_.Name -eq 'cloudflared.exe' } | Sort-Object ProcessId | ForEach-Object { "$($_.ProcessId)@$($_.CreationDate.ToString('o'))" }) -join ',')
  }
  $infraPids = @(@($pm) + @($procs.Values | Where-Object { $_.Name -match '^(mysqld|mariadbd|cloudflared)\.exe$' }) | Where-Object { $_ } | ForEach-Object { [int]$_.ProcessId })
  $listen = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
  $ports = @{}
  foreach ($l in $listen) { if ($prodPids -contains [int]$l.OwningProcess) { $k = [int]$l.LocalPort; if (-not $ports.ContainsKey($k)) { $ports[$k] = @() }; $ports[$k] += "$($l.LocalAddress)" } }
  $ours = @(& $desc $RunnerPid)
  [ordered]@{ procs = $procs; tree = $tree; infra = $infra; ports = $ports; listen = $listen; ours = $ours; daemonCount = $daemons.Count; prodPids = $prodPids; infraPids = $infraPids }
}
function Probe([int]$port, $addrs) {
  $h = '127.0.0.1'; if (-not (@($addrs | Where-Object { $_ -in @('0.0.0.0', '127.0.0.1') }).Count)) { $h = '[::1]' }
  $sw = [Diagnostics.Stopwatch]::StartNew(); $code = 0
  try { $r = Invoke-WebRequest -Uri "http://${h}:$port/" -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop; $code = [int]$r.StatusCode }
  catch { if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } else { $code = -1 } }
  [ordered]@{ status = $code; ms = $sw.ElapsedMilliseconds }
}
function Breach([string]$why) { if (-not (Test-Path $stop)) { Set-Content -Path $stop -Value $why -Encoding UTF8 }; Add-Content -Path (Join-Path $Out 'monitor-breaches.txt') -Value ("{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $why) }
function Sorted($h) { (@($h.Keys | Sort-Object | ForEach-Object { "$_=$($h[$_])" })) -join ';' }
# Production-owned listeners only (PM2 tree, shared PostgreSQL, MariaDB, cloudflared): desktop tools' ports come and go.
function Listeners($s) { (@($s.listen | Where-Object { ($s.prodPids -contains [int]$_.OwningProcess -or $s.infraPids -contains [int]$_.OwningProcess) -and $staging -notcontains [int]$_.LocalPort } | ForEach-Object { "$($_.LocalAddress):$($_.LocalPort)" } | Sort-Object -Unique)) -join ',' }

# ---------------------------------------------------------------- round 0: baseline
$b = Snap
if (-not $b.tree.Count) { Set-Content -Path $stop -Value 'monitor: production PM2 daemon not found at baseline'; exit }
$http = [ordered]@{}
foreach ($port in ($b.ports.Keys | Sort-Object)) {
  $samples = @(1..3 | ForEach-Object { Probe $port $b.ports[$port] })
  $ms = @($samples | ForEach-Object { $_.ms } | Sort-Object)
  $http["$port"] = [ordered]@{ status = $samples[1].status; statuses = (@($samples | ForEach-Object { $_.status }) -join ','); medianMs = $ms[1]; limitMs = [math]::Max([math]::Ceiling($ms[1] * 1.5), $ms[1] + 50) }
}
$baseline = [ordered]@{ at = (Get-Date).ToString('o'); tree = $b.tree; infra = $b.infra; http = $http; listeners = (Listeners $b); productionPorts = @($b.ports.Keys | Sort-Object) }
$baseline | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $Out 'baseline.json') -Encoding UTF8
'time,cpuPct,freeRamGB,freeDGB,maxLatencyRatio,prodChildren,ourProcesses,notes' | Set-Content -Path $csv -Encoding UTF8

$strikesLat = @{}; $strikesCpu = 0
$stats = [ordered]@{ rounds = 0; maxCpu = 0; minFreeRam = 999; maxLatencyRatio = 0 }
while (-not (Test-Path $end)) {
  Start-Sleep -Seconds 15
  if (Test-Path $end) { break }
  $s = Snap; $notes = @()
  if ((Sorted $s.tree) -ne (Sorted $b.tree)) { Breach 'production PM2 tree changed (daemon or child PID / start time)' }
  foreach ($k in $b.infra.Keys) { if ("$($s.infra[$k])" -ne "$($b.infra[$k])") { Breach "$k process changed" } }
  $maxRatio = 0
  foreach ($port in $http.Keys) {
    $r = Probe ([int]$port) $b.ports[[int]$port]
    if ($r.status -ne $http[$port].status) { Breach "production port $port answered $($r.status) instead of $($http[$port].status)" }
    $ratio = [math]::Round($r.ms / [math]::Max(1, $http[$port].medianMs), 2); if ($ratio -gt $maxRatio) { $maxRatio = $ratio }
    if ($r.ms -gt $http[$port].limitMs) { $strikesLat[$port] = 1 + [int]$strikesLat[$port]; $notes += "lat:${port}=$($r.ms)ms" } else { $strikesLat[$port] = 0 }
    if ($strikesLat[$port] -ge 2) { Breach "latency regression on port ${port}: $($r.ms) ms > $($http[$port].limitMs) ms twice" }
  }
  $cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
  if ($cpu -gt 80) { $strikesCpu++ } else { $strikesCpu = 0 }
  if ($strikesCpu -ge 3) { Breach "CPU above 80 % for 3 rounds ($cpu %)" }
  $free = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
  if ($free -lt 8) { Breach "free RAM $free GB < 8 GB" }
  $freeD = [math]::Round((Get-Volume -DriveLetter D).SizeRemaining / 1GB, 1)
  if ($freeD -lt 10) { Breach "D: free $freeD GB < 10 GB" }
  $pgL = @($s.listen | Where-Object { [int]$_.LocalPort -eq $Port })
  if (@($pgL | Where-Object { $_.LocalAddress -ne '127.0.0.1' }).Count) { Breach "temporary instance listens on a non-loopback address" }
  $to5432 = @(Get-NetTCPConnection -RemotePort 5432 -ErrorAction SilentlyContinue | Where-Object { $s.ours -contains [int]$_.OwningProcess })
  if ($to5432.Count) { Breach "a G0 process connected to port 5432 (the shared PostgreSQL)" }
  $exposed = @($s.listen | Where-Object { $s.ours -contains [int]$_.OwningProcess -and $_.LocalAddress -notin @('127.0.0.1', '::1') })
  # A-0.1: the firewall is off, so a non-loopback listener by any G0 process stops G0 in the same round.
  if ($exposed.Count) { Breach ("a G0 process listened on a non-loopback address: " + (@($exposed | ForEach-Object { "$($_.LocalAddress):$($_.LocalPort)" }) -join '|')) }
  $stats.rounds++; if ($cpu -gt $stats.maxCpu) { $stats.maxCpu = $cpu }; if ($free -lt $stats.minFreeRam) { $stats.minFreeRam = $free }; if ($maxRatio -gt $stats.maxLatencyRatio) { $stats.maxLatencyRatio = $maxRatio }
  ('{0},{1},{2},{3},{4},{5},{6},{7}' -f (Get-Date -Format 'HH:mm:ss'), $cpu, $free, $freeD, $maxRatio, ($s.tree.Count - 1), $s.ours.Count, ($notes -join ' ')) | Add-Content -Path $csv
}

# ---------------------------------------------------------------- final snapshot (I5)
$f = Snap; $diffs = @()
if ((Sorted $f.tree) -ne (Sorted $b.tree)) { $diffs += 'production PM2 tree changed' }
foreach ($k in $b.infra.Keys) { if ("$($f.infra[$k])" -ne "$($b.infra[$k])") { $diffs += "$k process changed" } }
if ((Listeners $f) -ne $baseline.listeners) { $diffs += 'production listeners changed (PM2 tree, PostgreSQL, MariaDB, cloudflared)' }
foreach ($port in $http.Keys) { $r = Probe ([int]$port) $b.ports[[int]$port]; if ($r.status -ne $http[$port].status) { $diffs += "port $port status $($r.status)" } }
[ordered]@{ i5ok = ($diffs.Count -eq 0); i5diffs = $diffs; stats = $stats; stopped = (Test-Path $stop); stopReason = $(if (Test-Path $stop) { (Get-Content $stop -Raw).Trim() } else { $null }) } |
  ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $Out 'monitor-final.json') -Encoding UTF8
