# PDA BLISS CORE - EP48.5 A-0.1: G0 PREFLIGHT (read-only). A failed preflight BLOCKS G0: Run-G0.ps1 runs this first.
#
# Run in an ELEVATED Windows PowerShell 5.1 on S2A-SERVER (the production PM2 tree runs as SYSTEM):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\g0-harness\Preflight-G0.ps1 -Release <sha>
#
# It only READS: no npm install, no database connection or creation, no migration, no service, task or listener, no
# PM2 / PostgreSQL / MariaDB / Cloudflare / firewall change, nothing deleted. It writes its own report to
#   <Dev>\ops-logs\ep48_5-g0\preflight-<timestamp>\preflight.json / preflight.txt   (git-ignored)
# and runs `node ops\ep48_5\g0-preflight.mjs` (static checks + a loopback-guard self-test that binds no socket).
# Exit 0 = PASS (warnings allowed), 1 = BLOCK.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Release,
  [string]$Baseline = 'cb21be102a03495c1b6659d99fa8d49eef8eaa4e',
  [string]$Dev = 'D:\S2A_PROJECT\pdabliss_core',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$GatesRoot = 'D:\pdabliss-core-staging\gates',
  [int]$TempPgPort = 55443,
  [string]$ReportDir = '',
  [switch]$FromRunner
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Off
$reportFolder = $ReportDir
if (-not $reportFolder) { $reportFolder = Join-Path $Dev ("ops-logs\ep48_5-g0\preflight-" + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
New-Item -ItemType Directory -Force -Path $reportFolder | Out-Null
$script:Checks = @()
function Add-Check([string]$id, [string]$name, [string]$status, $detail) {
  $script:Checks += [ordered]@{ id = $id; name = $name; status = $status; detail = $detail }
  $c = 'Green'; if ($status -eq 'WARN') { $c = 'Yellow' } elseif ($status -eq 'FAIL') { $c = 'Red' }
  Write-Host ("{0,-4} {1,-5} {2}" -f $id, $status, $name) -ForegroundColor $c
}
function Quiet([scriptblock]$b) { $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; try { & $b } finally { $ErrorActionPreference = $old } }
$hazardPattern = '^(PG[A-Z0-9_]+|DATABASE_URL|TEST_DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|NODE_OPTIONS|CORE_G0[A-Z0-9_]*)$'
Write-Host "EP48.5 G0 preflight - release $Release - report $reportFolder"

# ------------------------------------------------------------------ W1 Windows PowerShell compatibility
try {
  $problems = @()
  if ($PSVersionTable.PSEdition -ne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { $problems += "PowerShell $($PSVersionTable.PSVersion) $($PSVersionTable.PSEdition) (Windows PowerShell 5.1 Desktop expected)" }
  if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') { $problems += "language mode $($ExecutionContext.SessionState.LanguageMode)" }
  foreach ($cmd in @('Get-NetTCPConnection', 'Get-CimInstance', 'Get-Volume', 'Start-Job', 'Get-FileHash', 'Invoke-WebRequest', 'Get-NetIPAddress')) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { $problems += "cmdlet $cmd missing" } }
  $parsed = [ordered]@{}
  if (Test-Path (Join-Path $Dev 'ops\ep48_5\g0-harness\g0-monitor.ps1')) { $problems += 'the retired PowerShell monitor g0-monitor.ps1 is still present' }
  . (Join-Path $PSScriptRoot 'g0-common.ps1')
  foreach ($f in @('ops\ep48_5\g0-harness\Run-G0.ps1', 'ops\ep48_5\g0-harness\g0-common.ps1', 'ops\ep48_5\g0-harness\g0-facts.ps1', 'ops\ep48_5\g0-harness\Preflight-G0.ps1', 'ops\ep48_5\g0-harness\Test-G0Harness.ps1', 'ops\ep48_5\Collect-HostAudit.ps1')) {
    $full = Join-Path $Dev $f
    if (-not (Test-Path $full)) { $problems += "$f missing"; continue }
    $hazardList = @(Get-G0VariableHazards $full)
    $parsed[$f] = $hazardList.Count
    foreach ($hazard in $hazardList) { $problems += "$f $hazard" }
  }
  $st = 'PASS'; if ($problems.Count) { $st = 'FAIL' }
  Add-Check 'W1' 'Windows PowerShell 5.1 compatibility (parser, language mode, cmdlets, variable-name collisions)' $st ([ordered]@{ version = "$($PSVersionTable.PSVersion)"; edition = $PSVersionTable.PSEdition; parseErrors = $parsed; problems = $problems })
} catch { Add-Check 'W1' 'Windows PowerShell 5.1 compatibility' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W2 host identity and elevation
try {
  $problems = @()
  $os = Get-CimInstance Win32_OperatingSystem
  if ($env:COMPUTERNAME -ne 'S2A-SERVER') { $problems += "this is $env:COMPUTERNAME, not S2A-SERVER" }
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { $problems += 'not elevated (G0 and this preflight must read the SYSTEM-owned PM2 tree)' }
  $st = 'PASS'; if ($problems.Count) { $st = 'FAIL' }
  Add-Check 'W2' 'production host identity (S2A-SERVER) and elevation' $st ([ordered]@{ computer = $env:COMPUTERNAME; os = "$($os.Caption) $($os.Version)"; user = $id.Name; problems = $problems })
} catch { Add-Check 'W2' 'production host identity' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W3 release commit
try {
  $problems = @()
  $r = Quiet {
    [ordered]@{
      type = (& git -C $Dev -c safe.directory=* cat-file -t $Release 2>$null)
      head = (& git -C $Dev -c safe.directory=* rev-parse HEAD 2>$null)
      dirty = @(& git -C $Dev -c safe.directory=* status --porcelain -- ops docs backend frontend 2>$null)
      appDiff = $(& git -C $Dev -c safe.directory=* diff --quiet $Baseline $Release -- backend frontend 2>$null; $LASTEXITCODE)
      changed = @(& git -C $Dev -c safe.directory=* diff --name-only $Baseline $Release 2>$null)
      tree = @(& git -C $Dev -c safe.directory=* ls-tree -r --name-only $Release 2>$null)
    }
  }
  if ($r.type -ne 'commit') { $problems += "release $Release is not a commit in $Dev" }
  if ($r.head -ne $Release) { $problems += "the repository HEAD ($($r.head)) is not the release; the runner and harness must be the reviewed commit" }
  if ($r.dirty.Count) { $problems += "uncommitted or untracked changes under ops/ docs/ backend/ frontend/: $($r.dirty.Count)" }
  if ($r.appDiff -ne 0) { $problems += "backend/ or frontend/ differ between $Baseline and the release" }
  $outside = @($r.changed | Where-Object { $_ -notmatch '^(docs/EP48_5_|ops/ep48_5/|ops/test/(staging-launch|g0-))' })
  if ($outside.Count) { $problems += "files outside the EP48.5 scope changed: $($outside -join ', ')" }
  $envInTree = @($r.tree | Where-Object { $_ -match '(^|/)\.env(\.[^/]+)?$' -and $_ -notmatch '(^|/)\.env\.example$' })
  if ($envInTree.Count) { $problems += ".env files committed in the release: $($envInTree -join ', ')" }
  $hashes = [ordered]@{}; Get-ChildItem (Join-Path $Dev 'ops\ep48_5\g0-harness') -File | ForEach-Object { $hashes[$_.Name] = (Get-FileHash $_.FullName -Algorithm SHA256).Hash }
  $st = 'PASS'; if ($problems.Count) { $st = 'FAIL' }
  Add-Check 'W3' 'release SHA, clean tree, backend/frontend = baseline, scope, no committed .env' $st ([ordered]@{ release = $Release; head = $r.head; changedFiles = $r.changed.Count; harnessSha256 = $hashes; problems = $problems })
} catch { Add-Check 'W3' 'release commit' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W4 Node / npm / git
try {
  $problems = @()
  $nodeV = Quiet { & node -v 2>$null }
  if ("$nodeV" -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) { $problems += "Node 24+ required, found '$nodeV'" }
  $nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
  $npmCli = $null; if ($nodeExe) { $npmCli = Join-Path (Split-Path $nodeExe) 'node_modules\npm\bin\npm-cli.js' }
  if (-not $npmCli -or -not (Test-Path $npmCli)) { $problems += 'npm-cli.js not found next to node.exe' }
  $gitV = Quiet { & git --version 2>$null }
  if (-not $gitV) { $problems += 'git not found' }
  $st = 'PASS'; if ($problems.Count) { $st = 'FAIL' }
  Add-Check 'W4' 'Node.js 24, npm CLI, git' $st ([ordered]@{ node = "$nodeV"; nodeExe = $nodeExe; npmCli = $npmCli; git = "$gitV"; problems = $problems })
} catch { Add-Check 'W4' 'Node.js / npm / git' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W5 PostgreSQL binaries (only --version is executed)
try {
  $problems = @()
  foreach ($b in @('initdb.exe', 'pg_ctl.exe', 'postgres.exe', 'pg_controldata.exe')) { if (-not (Test-Path (Join-Path $PgBin $b))) { $problems += "$b missing in $PgBin" } }
  $v = Quiet { & (Join-Path $PgBin 'pg_ctl.exe') --version 2>$null }
  if ("$v" -notmatch '\b18\.\d+') { $problems += "pg_ctl version '$v' (18.x expected)" }
  $svc = Get-CimInstance Win32_Service -Filter "Name='postgresql-x64-18'" -ErrorAction SilentlyContinue
  $st = 'PASS'; if ($problems.Count) { $st = 'FAIL' }
  Add-Check 'W5' 'PostgreSQL 18 binaries for the temporary instance' $st ([ordered]@{ pgBin = $PgBin; version = "$v"; sharedServiceState = "$($svc.State)"; note = 'the same binaries start a SEPARATE instance with its own data folder under the gates folder; the shared service and its data are not touched'; problems = $problems })
} catch { Add-Check 'W5' 'PostgreSQL binaries' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W6 port 55443
try {
  $problems = @()
  $inUse = @(Get-NetTCPConnection -LocalPort $TempPgPort -ErrorAction SilentlyContinue)
  if ($inUse.Count) { $problems += "port $TempPgPort is in use ($($inUse.Count) socket(s))" }
  $ranges = @()
  foreach ($fam in @('ipv4', 'ipv6')) {
    $lines = Quiet { netsh interface $fam show excludedportrange protocol=tcp }
    foreach ($l in @($lines)) { if ($l -match '^\s*(\d+)\s+(\d+)') { $ranges += "$fam $($Matches[1])-$($Matches[2])"; if ($TempPgPort -ge [int]$Matches[1] -and $TempPgPort -le [int]$Matches[2]) { $problems += "port $TempPgPort is inside the excluded $fam range $($Matches[1])-$($Matches[2])" } } }
  }
  $shared = @(Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { "$($_.LocalAddress)" })
  $st = 'PASS'; if ($problems.Count) { $st = 'FAIL' }
  Add-Check 'W6' "port $TempPgPort free (IPv4 / IPv6) and not excluded" $st ([ordered]@{ excludedRanges = $ranges; sharedPostgres5432ListensOn = $shared; problems = $problems })
} catch { Add-Check 'W6' 'port availability' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W7 inherited environment and .env files (names only, never values)
try {
  $found = @()
  foreach ($scope in @('Process', 'User', 'Machine')) {
    $vars = [Environment]::GetEnvironmentVariables($scope)
    foreach ($k in $vars.Keys) { if ("$k".ToUpper() -match $hazardPattern) { $found += "$scope`:$k" } }
  }
  $envFiles = @()
  foreach ($d in @('', 'backend', 'frontend', 'ops')) { $p = Join-Path $Dev $d; if (Test-Path $p) { Get-ChildItem -Path $p -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\.env(\..+)?$' -and $_.Name -ne '.env.example' } | ForEach-Object { $envFiles += $_.FullName.Substring($Dev.Length).TrimStart('\') } } }
  $processHaz = @($found | Where-Object { $_ -like 'Process:*' })
  $st = 'PASS'; $note = 'none found'
  if ($found.Count -or $envFiles.Count) { $st = 'WARN'; $note = 'Run-G0.ps1 removes these variables from its own process before any child starts, and the guard strips them from every child; .env files are git-ignored and never reach the fresh G0 clone (guard I4 re-checks the clone)' }
  if ($FromRunner -and $processHaz.Count) { $st = 'FAIL'; $note = 'the runner did not neutralise its environment' }
  Add-Check 'W7' 'unsafe inherited environment variables and .env files' $st ([ordered]@{ variables = $found; envFilesInWorkingTree = $envFiles; note = $note })
} catch { Add-Check 'W7' 'environment' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W8 production baseline and resources (read-only)
try {
  $problems = @(); $warn = @()
  $procs = @{}; Get-CimInstance Win32_Process | ForEach-Object { $procs[[int]$_.ProcessId] = $_ }
  $kids = @{}; foreach ($p in $procs.Values) { $pp = [int]$p.ParentProcessId; if (-not $kids.ContainsKey($pp)) { $kids[$pp] = @() }; $kids[$pp] += [int]$p.ProcessId }
  $daemons = @($procs.Values | Where-Object { $_.Name -eq 'node.exe' -and "$($_.CommandLine)" -match 'pm2[\\/]lib[\\/]Daemon\.js' })
  $prod = $daemons | Sort-Object { @($kids[[int]$_.ProcessId]).Count } -Descending | Select-Object -First 1
  if (-not $prod) { $problems += 'no PM2 daemon found (the G0 monitor needs the production PM2 tree as its baseline)' }
  $children = @(); if ($prod) { $children = @($kids[[int]$prod.ProcessId] | Where-Object { $_ }) }
  $pm = $procs.Values | Where-Object { $_.Name -eq 'postgres.exe' -and $procs[[int]$_.ParentProcessId] -and $procs[[int]$_.ParentProcessId].Name -eq 'pg_ctl.exe' } | Select-Object -First 1
  if (-not $pm) { $problems += 'the shared PostgreSQL postmaster was not found' }
  $prodPids = @(); foreach ($c in $children) { $prodPids += $c; $q = New-Object System.Collections.Queue; $q.Enqueue($c); while ($q.Count) { $x = $q.Dequeue(); foreach ($k in @($kids[$x])) { if ($k) { $prodPids += $k; $q.Enqueue($k) } } } }
  $appPortAddresses = @{}; foreach ($l in @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)) { if ($prodPids -contains [int]$l.OwningProcess) { $k = [string][int]$l.LocalPort; if (-not $appPortAddresses.ContainsKey($k)) { $appPortAddresses[$k] = @() }; $appPortAddresses[$k] += "$($l.LocalAddress)" } }
  $http = [ordered]@{}
  foreach ($appPortKey in @($appPortAddresses.Keys | Sort-Object { [int]$_ })) {
    $h = '127.0.0.1'; if (-not (@($appPortAddresses[$appPortKey] | Where-Object { $_ -in @('0.0.0.0', '127.0.0.1') }).Count)) { $h = '[::1]' }
    $sw = [Diagnostics.Stopwatch]::StartNew(); $code = 0
    try { $resp = Invoke-WebRequest -Uri "http://${h}:$appPortKey/" -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop; $code = [int]$resp.StatusCode }
    catch { if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } else { $code = -1 } }
    $http[$appPortKey] = "$code in $($sw.ElapsedMilliseconds) ms"
  }
  $freeRam = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 1)
  $cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
  $freeD = [math]::Round((Get-Volume -DriveLetter D).SizeRemaining / 1GB, 1)
  if ($freeRam -lt 10) { $problems += "free RAM $freeRam GB (G0 stops below 8 GB; at least 10 GB needed to start)" }
  if ($freeD -lt 20) { $problems += "D: free $freeD GB (20 GB needed)" }
  if ($cpu -gt 80) { $warn += "CPU at $cpu % right now (G0 stops after 3 rounds above 80 %)" }
  if (-not ($GatesRoot -match '^D:\\')) { $problems += "the gates folder $GatesRoot is not on D:" }
  $st = 'PASS'; if ($warn.Count) { $st = 'WARN' }; if ($problems.Count) { $st = 'FAIL' }
  Add-Check 'W8' 'production process baseline and resources' $st ([ordered]@{
    pm2Daemons = $daemons.Count; productionDaemonPid = $(if ($prod) { $prod.ProcessId } else { $null }); productionChildren = $children.Count
    postmaster = $(if ($pm) { "$($pm.ProcessId)@$($pm.CreationDate.ToString('o'))" } else { $null })
    mariadb = @($procs.Values | Where-Object { $_.Name -match '^(mysqld|mariadbd)\.exe$' } | ForEach-Object { $_.ProcessId })
    cloudflared = @($procs.Values | Where-Object { $_.Name -eq 'cloudflared.exe' } | ForEach-Object { $_.ProcessId })
    productionPorts = $http; freeRamGB = $freeRam; cpuPct = $cpu; freeDiskDGB = $freeD; problems = $problems; warnings = $warn })
} catch { Add-Check 'W8' 'production baseline' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ W9 G0 targets only the temporary instance; no non-loopback listener
try {
  $out = Quiet { & node (Join-Path $Dev 'ops\ep48_5\g0-preflight.mjs') --src $Dev 2>&1 }
  $code = $LASTEXITCODE
  $text = ($out | Out-String)
  Set-Content -Path (Join-Path $reportFolder 'g0-preflight-node.json') -Value $text -Encoding UTF8
  $j = $null; try { $j = $text | ConvertFrom-Json } catch { }
  $summary = @(); if ($j) { foreach ($c in $j.checks) { $s = 'ok'; if (-not $c.ok) { $s = 'FAIL: ' + (@($c.problems) -join '; ') }; $summary += "$($c.id) $($c.name): $s" } }
  $st = 'PASS'; if ($code -ne 0 -or -not $j -or -not $j.ok) { $st = 'FAIL' }
  Add-Check 'W9' 'G0 targets only 127.0.0.1:55443; no test can create a non-loopback listener (static checks + guard self-test)' $st ([ordered]@{ exit = $code; checks = $summary })
} catch { Add-Check 'W9' 'G0 configuration' 'FAIL' $_.Exception.Message }

# ------------------------------------------------------------------ report
$block = @($script:Checks | Where-Object { $_.status -eq 'FAIL' }).Count
$result = 'PASS'; if ($block) { $result = 'BLOCK' }
$report = [ordered]@{ tool = 'EP48.5 Preflight-G0 (read-only)'; result = $result; release = $Release; at = (Get-Date).ToString('o'); fromRunner = [bool]$FromRunner; checks = $script:Checks }
$report | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $reportFolder 'preflight.json') -Encoding UTF8
$lines = @("EP48.5 G0 PREFLIGHT: $result  (release $Release)")
foreach ($c in $script:Checks) { $lines += ("{0,-4} {1,-5} {2}" -f $c.id, $c.status, $c.name) }
$lines | Set-Content -Path (Join-Path $reportFolder 'preflight.txt') -Encoding UTF8
Write-Host ''
Write-Host "PREFLIGHT $result - report: $reportFolder"
if ($block) { exit 1 } else { exit 0 }
