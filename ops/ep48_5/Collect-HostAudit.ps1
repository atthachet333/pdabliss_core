# PDA BLISS CORE - EP48.5 Stage A read-only host collector (v2).
#
# Gathers the Phase 1 / Phase 2 evidence for docs/EP48_5_SERVER_AUDIT.md on the Windows host itself.
#
#   READ-ONLY. It starts, stops, restarts, installs, creates or edits nothing: no service, no PM2
#   process, no firewall rule, no scheduled task, no Cloudflare setting, no database object.
#   - PM2: the pm2 command is NEVER run (v1 ran "pm2 jlist", which can spawn a daemon and only sees
#     the current account's daemon). v2 reads the process table and PM2's own files instead: the
#     pids\*.pid files (name -> pid) and dump.pm2 parsed by node with every environment block dropped.
#   - PostgreSQL is queried ONLY when -PgUser is given; the password is prompted (never a
#     parameter, never written), and the session is forced read-only (default_transaction_read_only).
#   - Command lines, URLs and arguments are redacted (passwords, tokens, keys, connection strings).
#   - Loopback HTTP probes send one GET per listening node port (status + latency only) as the
#     "before" availability baseline. Use -NoHttpProbe to skip.
#   - Works without elevation. Run elevated to also read what other accounts own (the production
#     PM2 tree's command lines and owner, SYSTEM scheduled tasks, other profiles' PM2 homes);
#     the output lists every field that was unreadable for lack of elevation.
#
# Output: ops-logs\ep48_5-host-audit\<timestamp>\host-audit.json + summary.txt (ops-logs/ is git-ignored).
#
# Usage (Windows PowerShell 5.1 or later):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\Collect-HostAudit.ps1 -PgUser postgres
#
[CmdletBinding()]
param(
  [string]$PgUser = '',
  [int]$PgPort = 0,
  [int]$Samples = 12,
  [int]$SampleSeconds = 5,
  [int[]]$CandidatePorts = @(1311, 1312, 1411, 1412, 5433, 5434, 55443),
  [switch]$NoHttpProbe
)

$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$OutDir = Join-Path $RepoRoot "ops-logs\ep48_5-host-audit\$Stamp"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$RunStart = Get-Date
$Audit = [ordered]@{ collector = 'EP48.5 Collect-HostAudit v2'; startedAt = $RunStart.ToString('o'); errors = @(); warnings = @(); elevationGaps = @() }

function Redact([string]$s) {
  if (-not $s) { return $s }
  $s = $s -replace '(?i)(postgres(ql)?|mysql|mariadb|redis|mongodb(\+srv)?)://([^:/@\s]+):([^@\s]+)@', '$1://$4:<redacted>@'
  $s = $s -replace '(?i)(--?(token|password|passwd|pwd|secret|api-?key|key|credentials?)[=\s]+)("[^"]*"|\S+)', '$1<redacted>'
  $s = $s -replace '(?i)\b([A-Z0-9_]*(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)[A-Z0-9_]*)\s*[=:]\s*("[^"]*"|''[^'']*''|[^\s;,)]+)', '$1=<redacted>'
  $s = $s -replace 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+', '<redacted-jwt>'
  return $s
}
function Iso($d) { if ($null -eq $d) { return $null }; try { return ([datetime]$d).ToString('o') } catch { return "$d" } }
function Num($v, [int]$digits = 1) { if ($null -eq $v -or "$v" -eq '') { return $null }; try { return [math]::Round([double]$v, $digits) } catch { return $null } }
function Stats($values) {
  # null-safe min / max / average (Measure-Object -Property does not read dictionary keys in PS 5.1 - the v1 bug)
  $n = @($values | Where-Object { $null -ne $_ -and "$_" -ne '' } | ForEach-Object { [double]$_ })
  if ($n.Count -eq 0) { return [ordered]@{ count = 0; min = $null; max = $null; avg = $null } }
  $sum = 0.0; $min = $n[0]; $max = $n[0]
  foreach ($x in $n) { $sum += $x; if ($x -lt $min) { $min = $x }; if ($x -gt $max) { $max = $x } }
  return [ordered]@{ count = $n.Count; min = [math]::Round($min, 2); max = [math]::Round($max, 2); avg = [math]::Round($sum / $n.Count, 2) }
}
function Try-Step([string]$name, [scriptblock]$block) {
  # records terminating errors AND the non-terminating ones v1 silently printed (e.g. Measure-Object)
  $before = $Error.Count
  $result = $null
  try { $result = & $block } catch { $script:Audit.errors += "${name}: $(Redact $_.Exception.Message)" }
  $new = $Error.Count - $before
  if ($new -gt 0) {
    $take = [math]::Min($new, 15)
    for ($i = $take - 1; $i -ge 0; $i--) { $script:Audit.warnings += "${name}: $(Redact ($Error[$i].ToString()))" }
    if ($new -gt $take) { $script:Audit.warnings += "${name}: ... $($new - $take) more" }
  }
  return $result
}
function Gap([string]$what) { if (-not $script:IsElevated -and $script:Audit.elevationGaps -notcontains $what) { $script:Audit.elevationGaps += $what } }
function Val($v) { if ($null -eq $v -or "$v" -eq '') { return '?' } else { return "$v" } }

# ---------------------------------------------------------------- 1. identity / hardware
$script:IsElevated = $false
$Audit.identity = Try-Step 'identity' {
  $os = Get-CimInstance Win32_OperatingSystem
  $cs = Get-CimInstance Win32_ComputerSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $script:IsElevated = (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  [ordered]@{
    hostname = $env:COMPUTERNAME
    os = $os.Caption; osVersion = $os.Version; osBuild = $os.BuildNumber; installDate = (Iso $os.InstallDate)
    lastBoot = (Iso $os.LastBootUpTime); uptimeHours = (Num ((Get-Date) - $os.LastBootUpTime).TotalHours)
    manufacturer = $cs.Manufacturer; model = $cs.Model; domainOrWorkgroup = $cs.Domain
    cpu = "$($cpu.Name)".Trim(); cores = $cpu.NumberOfCores; logicalProcessors = $cpu.NumberOfLogicalProcessors
    ramGB = (Num ($cs.TotalPhysicalMemory / 1GB))
    battery = [bool](Get-CimInstance Win32_Battery -ErrorAction Ignore)
    elevated = $script:IsElevated
    runAs = $id.Name
    psVersion = $PSVersionTable.PSVersion.ToString()
    timeZone = (Get-TimeZone).Id
    localUsers = @(Get-LocalUser -ErrorAction Ignore | ForEach-Object { [ordered]@{ name = $_.Name; enabled = $_.Enabled; admin = $null } })
  }
}
Try-Step 'localAdmins' {
  $admins = @(Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction Ignore | ForEach-Object { ($_.Name -split '\\')[-1] })
  if ($admins.Count -gt 0) { foreach ($u in @($Audit.identity.localUsers)) { if ($u) { $u.admin = ($admins -contains $u.name) } } }
} | Out-Null

# ---------------------------------------------------------------- 2. storage
$Audit.storage = Try-Step 'storage' {
  $pds = @(Get-PhysicalDisk -ErrorAction Ignore)
  [ordered]@{
    physicalDisks = @($pds | ForEach-Object { [ordered]@{ deviceId = "$($_.DeviceId)"; name = $_.FriendlyName; media = "$($_.MediaType)"; bus = "$($_.BusType)"; sizeGB = (Num ($_.Size / 1GB) 0); health = "$($_.HealthStatus)"; status = "$($_.OperationalStatus)" } })
    volumeToDisk = @(Get-Partition -ErrorAction Ignore | Where-Object { $_.DriveLetter } | ForEach-Object {
        $dn = "$($_.DiskNumber)"; $pd = $pds | Where-Object { "$($_.DeviceId)" -eq $dn } | Select-Object -First 1
        [ordered]@{ drive = "$($_.DriveLetter):"; diskNumber = $dn; disk = $(if ($pd) { $pd.FriendlyName } else { $null }); media = $(if ($pd) { "$($pd.MediaType)" } else { $null }); bus = $(if ($pd) { "$($pd.BusType)" } else { $null }) } })
    volumes = @(Get-Volume | Where-Object { $_.DriveLetter } | Sort-Object DriveLetter | ForEach-Object {
      [ordered]@{ drive = "$($_.DriveLetter):"; label = $_.FileSystemLabel; fs = $_.FileSystem; type = "$($_.DriveType)"; sizeGB = (Num ($_.Size / 1GB)); freeGB = (Num ($_.SizeRemaining / 1GB)); usedPct = $(if ($_.Size) { Num (100 * (1 - $_.SizeRemaining / $_.Size)) } else { $null }); health = "$($_.HealthStatus)" } })
    networkDrives = @(Get-SmbMapping -ErrorAction Ignore | ForEach-Object { [ordered]@{ local = $_.LocalPath; remote = $_.RemotePath; status = "$($_.Status)" } })
    # SMB shares this host offers (read-only listing; access lists need elevation). Port 445 is LAN-reachable while the firewall profile is off.
    smbShares = @(Get-SmbShare -ErrorAction Ignore | ForEach-Object {
        $sh = $_
        [ordered]@{ name = $sh.Name; path = $sh.Path; special = [bool]$sh.Special; description = $sh.Description
          access = @(Get-SmbShareAccess -Name $sh.Name -ErrorAction Ignore | ForEach-Object { "$($_.AccountName):$($_.AccessControlType):$($_.AccessRight)" }) } })
    oneDrive = [ordered]@{
      roots = @(@($env:OneDrive, $env:OneDriveCommercial, $env:OneDriveConsumer) | Where-Object { $_ } | Select-Object -Unique)
      running = [bool](Get-Process OneDrive -ErrorAction Ignore)
      repoInsideOneDrive = [bool](@(@($env:OneDrive, $env:OneDriveCommercial, $env:OneDriveConsumer) | Where-Object { $_ -and $RepoRoot.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }).Count)
    }
  }
}

# ---------------------------------------------------------------- 3. process table
$procs = @{}
Try-Step 'processes' { Get-CimInstance Win32_Process | ForEach-Object { $procs[[int]$_.ProcessId] = $_ } } | Out-Null
$owners = @{}
function OwnerOf([int]$procId) {
  if ($owners.ContainsKey($procId)) { return $owners[$procId] }
  $o = $null; $p = $procs[$procId]
  if ($p) { try { $r = Invoke-CimMethod -InputObject $p -MethodName GetOwner -ErrorAction Stop; if ($r -and $r.User) { $o = "$($r.Domain)\$($r.User)" } } catch { $o = $null } }
  $owners[$procId] = $o; return $o
}
function ProcInfo([int]$procId) {
  $p = $procs[$procId]; if (-not $p) { return [ordered]@{ pid = $procId; name = $null; parentPid = $null; parentName = $null; commandLine = $null; readable = $false } }
  $parent = $procs[[int]$p.ParentProcessId]
  [ordered]@{ pid = $procId; name = $p.Name; parentPid = [int]$p.ParentProcessId; parentName = $(if ($parent) { $parent.Name } else { $null }); commandLine = (Redact $p.CommandLine); readable = [bool]$p.CommandLine }
}
function Descendants([int]$root) {
  $out = @(); $queue = New-Object System.Collections.Queue; $queue.Enqueue($root)
  while ($queue.Count -gt 0) {
    $cur = [int]$queue.Dequeue()
    foreach ($p in $procs.Values) { $cp = [int]$p.ProcessId; if ([int]$p.ParentProcessId -eq $cur -and $cp -ne $cur -and $cp -ne $root -and $out -notcontains $cp) { $out += $cp; $queue.Enqueue($cp) } }
  }
  return $out
}

# ---------------------------------------------------------------- 4. listeners and port map
$Audit.listeners = Try-Step 'listeners' {
  @(Get-NetTCPConnection -State Listen | Sort-Object LocalPort, LocalAddress | ForEach-Object {
    $i = ProcInfo ([int]$_.OwningProcess)
    [ordered]@{ port = [int]$_.LocalPort; address = "$($_.LocalAddress)"; loopbackOnly = ("$($_.LocalAddress)" -in @('127.0.0.1', '::1')); process = $i.name; pid = $i.pid; parentPid = $i.parentPid; parent = $i.parentName; commandLine = $i.commandLine } })
}
$listenByPid = @{}
foreach ($l in @($Audit.listeners)) { if ($null -ne $l) { $k = [int]$l.pid; if (-not $listenByPid.ContainsKey($k)) { $listenByPid[$k] = @() }; $listenByPid[$k] += "$($l.address):$($l.port)" } }
function PortsOf([int]$procId, [switch]$WithDescendants) {
  $ports = @(); if ($listenByPid.ContainsKey($procId)) { $ports += $listenByPid[$procId] }
  if ($WithDescendants) { foreach ($x in @(Descendants $procId)) { if ($listenByPid.ContainsKey([int]$x)) { $ports += $listenByPid[[int]$x] } } }
  return @($ports | Where-Object { $_ } | Select-Object -Unique)
}
$Audit.excludedPortRanges = Try-Step 'excludedPortRanges' {
  @((netsh interface ipv4 show excludedportrange protocol=tcp) -match '^\s*\d+\s+\d+' | ForEach-Object { $a = ($_.Trim() -split '\s+'); [ordered]@{ start = [int]$a[0]; end = [int]$a[1]; admin = ($_ -match '\*') } })
}
$Audit.nodeProcesses = Try-Step 'nodeProcesses' {
  @($procs.Values | Where-Object { $_.Name -match '^(node|pm2|cloudflared|postgres|mysqld|mariadbd)\.exe$' } | Sort-Object Name, ProcessId | ForEach-Object {
    $i = ProcInfo ([int]$_.ProcessId); $i.workingSetMB = (Num ($_.WorkingSetSize / 1MB) 0); $i.started = (Iso $_.CreationDate); $i.ports = @(PortsOf ([int]$_.ProcessId)); $i })
}
if (@($Audit.nodeProcesses | Where-Object { $_ -and -not $_.readable }).Count -gt 0) { Gap 'command lines of processes owned by other accounts (production PM2 tree, cloudflared, PostgreSQL)' }

# ---------------------------------------------------------------- 5. node / npm / pm2 version (version read from package.json, pm2 not run)
$Audit.runtime = Try-Step 'runtime' {
  $r = [ordered]@{}
  $r.node = (& node -v 2>$null); $r.npm = (& npm -v 2>$null)
  $globalRoot = (& npm root -g 2>$null)
  $r.npmGlobalRoot = $globalRoot
  $pkg = $null; if ($globalRoot) { $pkg = Join-Path $globalRoot 'pm2\package.json' }
  $r.pm2Version = $null; if ($pkg -and (Test-Path $pkg)) { $r.pm2Version = (Get-Content $pkg -Raw | ConvertFrom-Json).version }
  $r.nodePath = $(try { (Get-Command node -ErrorAction Stop).Source } catch { $null })
  $r.git = (& git --version 2>$null)
  $r
}

# ---------------------------------------------------------------- 6. PM2 (no pm2 command - process table + PM2's own files)
$Audit.pm2 = Try-Step 'pm2' {
  $res = [ordered]@{ method = 'process table + pids/*.pid + dump.pm2 (env blocks dropped); the pm2 command is never run'; daemons = @(); homes = @(); startup = @() }
  # 6a. daemons: confirmed by command line, or inferred (node.exe, unreadable command line, parent gone / not node, >= 3 node children)
  $confirmed = @($procs.Values | Where-Object { "$($_.CommandLine)" -match '(?i)pm2[\\/]lib[\\/]Daemon\.js' })
  $confirmedIds = @($confirmed | ForEach-Object { [int]$_.ProcessId })
  $inferred = @()
  foreach ($p in $procs.Values) {
    if ($p.Name -ne 'node.exe' -or $p.CommandLine -or ($confirmedIds -contains [int]$p.ProcessId)) { continue }
    $par = $procs[[int]$p.ParentProcessId]
    if ($par -and $par.Name -eq 'node.exe') { continue }
    $pp = [int]$p.ProcessId
    $kids = @($procs.Values | Where-Object { [int]$_.ParentProcessId -eq $pp -and $_.Name -eq 'node.exe' }).Count
    if ($kids -ge 3) { $inferred += $p }
  }
  foreach ($d in @($confirmed + $inferred)) {
    $dpid = [int]$d.ProcessId
    $children = @($procs.Values | Where-Object { [int]$_.ParentProcessId -eq $dpid } | Sort-Object ProcessId)
    $res.daemons += [ordered]@{
      pid = $dpid; started = (Iso $d.CreationDate); startedDuringThisRun = ($d.CreationDate -ge $RunStart.AddMinutes(-1))
      evidence = $(if ($confirmedIds -contains $dpid) { 'Daemon.js on the command line' } else { 'inferred: unreadable command line with node children (elevate to confirm)' })
      owner = (OwnerOf $dpid); workingSetMB = (Num ($d.WorkingSetSize / 1MB) 0)
      apps = @($children | ForEach-Object {
          $cpid = [int]$_.ProcessId
          [ordered]@{ pid = $cpid; name = $_.Name; started = (Iso $_.CreationDate); workingSetMB = (Num ($_.WorkingSetSize / 1MB) 0); ports = @(PortsOf $cpid -WithDescendants); descendants = @(Descendants $cpid).Count; commandLine = (Redact $_.CommandLine) } })
    }
  }
  if ($inferred.Count -gt 0) { Gap 'owner and command line of the inferred PM2 daemon(s) - needed to confirm which account and PM2 home run the production apps' }
  # 6b. PM2 homes: pid files (name -> pid, no secrets) and dump.pm2 (parsed by node, env blocks never read out)
  $cands = @($env:PM2_HOME, [Environment]::GetEnvironmentVariable('PM2_HOME', 'Machine'), [Environment]::GetEnvironmentVariable('PM2_HOME', 'User'),
    (Join-Path $env:USERPROFILE '.pm2'), 'C:\ProgramData\pm2\home', 'C:\ProgramData\pm2', 'C:\ProgramData\.pm2', 'C:\etc\.pm2',
    "$env:SystemRoot\System32\config\systemprofile\.pm2", "$env:SystemRoot\ServiceProfiles\LocalService\.pm2", "$env:SystemRoot\ServiceProfiles\NetworkService\.pm2")
  $cands += @(Get-ChildItem 'C:\Users' -Directory -Force -ErrorAction Ignore | ForEach-Object { Join-Path $_.FullName '.pm2' })
  $js = "const fs=require('fs');let a=[];try{a=JSON.parse(fs.readFileSync(process.argv[1],'utf8'))}catch(e){console.log(JSON.stringify({error:'unreadable dump'}));process.exit(0)}" +
        ";const j=v=>Array.isArray(v)?v.join(' '):(v==null?null:String(v));" +
        "console.log(JSON.stringify((Array.isArray(a)?a:[]).map(p=>({name:p.name,id:p.pm_id,script:p.pm_exec_path,cwd:p.pm_cwd,execMode:p.exec_mode,instances:p.instances,interpreter:p.exec_interpreter,autorestart:p.autorestart,maxMemoryRestart:p.max_memory_restart,args:j(p.args),nodeArgs:j(p.node_args)}))))"
  foreach ($h in @($cands | Where-Object { $_ } | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $h -ErrorAction Ignore)) { continue }
    $entry = [ordered]@{ home = $h; readable = $true; pidFiles = @(); dump = $null; dumpModified = $null; logFiles = $null }
    try {
      $entry.pidFiles = @(Get-ChildItem -LiteralPath (Join-Path $h 'pids') -Filter '*.pid' -ErrorAction Stop | ForEach-Object {
          $raw = "$(Get-Content -LiteralPath $_.FullName -Raw -ErrorAction Ignore)".Trim(); $p = 0; [void][int]::TryParse($raw, [ref]$p)
          # alive only when the PID belongs to a plausible app process: Windows reuses PIDs, so "a process with this PID exists" is not enough
          $pname = $null; if ($p -and $procs[$p]) { $pname = $procs[$p].Name }
          [ordered]@{ app = ($_.BaseName -replace '-\d+$', ''); file = $_.Name; pid = $p; processName = $pname; alive = [bool]($pname -match '^(node|python|pythonw|streamlit)\.exe$'); ports = $(if ($p -and $pname) { @(PortsOf $p -WithDescendants) } else { @() }); modified = (Iso $_.LastWriteTime) } })
      $entry.logFiles = @(Get-ChildItem -LiteralPath (Join-Path $h 'logs') -File -ErrorAction Ignore).Count
      $dumpFile = Join-Path $h 'dump.pm2'
      if (Test-Path -LiteralPath $dumpFile) {
        $entry.dumpModified = (Iso (Get-Item -LiteralPath $dumpFile).LastWriteTime)
        $out = & node -e $js $dumpFile 2>$null
        if ($out) {
          $parsed = ($out | Select-Object -Last 1) | ConvertFrom-Json
          if ($parsed -is [array] -or $parsed.name) {
            $entry.dump = @($parsed | ForEach-Object { [ordered]@{ name = $_.name; id = $_.id; script = (Redact $_.script); cwd = $_.cwd; execMode = $_.execMode; instances = $_.instances; interpreter = $_.interpreter; autorestart = $_.autorestart; maxMemoryRestart = $_.maxMemoryRestart; args = (Redact $_.args); nodeArgs = (Redact $_.nodeArgs) } })
          } else { $entry.dump = 'unreadable' }
        }
      }
    } catch { $entry.readable = $false; Gap "PM2 home $h (access denied)" }
    $res.homes += $entry
  }
  # 6c. how PM2 / apps start at boot or logon (names and redacted targets only)
  $res.startup += @(Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction Ignore | ForEach-Object { $_.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { "Run key: $($_.Name) = $(Redact "$($_.Value)")" } })
  $res.startup += @(@("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp") | ForEach-Object { Get-ChildItem -LiteralPath $_ -File -ErrorAction Ignore } | ForEach-Object { "Startup folder: $($_.FullName)" })
  $res.startup += @(Get-ScheduledTask -ErrorAction Ignore | Where-Object { $_.TaskName -match '(?i)pm2|node|s2a|pda|bliss|core' -or ((@($_.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join ' ') -match '(?i)pm2|node\.exe|S2A_PROJECT') } | ForEach-Object { "Scheduled task: $($_.TaskPath)$($_.TaskName) [$($_.State)] as $($_.Principal.UserId) triggers=$((@($_.Triggers | ForEach-Object { $_.CimClass.CimClassName -replace 'MSFT_Task','' -replace 'Trigger','' }) -join ','))" })
  $res.startup += @(Get-CimInstance Win32_Service -ErrorAction Ignore | Where-Object { "$($_.PathName)" -match '(?i)pm2|node\.exe|S2A_PROJECT|nssm|winsw' -or $_.Name -match '(?i)pm2' } | ForEach-Object { "Service: $($_.Name) [$($_.State)/$($_.StartMode)] as $($_.StartName): $(Redact $_.PathName)" })
  if (Test-Path 'C:\Scripts\pm2-resurrect.ps1') { $res.startup += "Script C:\Scripts\pm2-resurrect.ps1 exists; PM2_HOME lines: $((@(Select-String -LiteralPath 'C:\Scripts\pm2-resurrect.ps1' -Pattern 'PM2_HOME' -ErrorAction Ignore | ForEach-Object { Redact $_.Line.Trim() })) -join ' | ')" }
  Gap 'scheduled tasks and services registered by other accounts / SYSTEM (how the production PM2 starts at boot)'
  $res
}

# ---------------------------------------------------------------- 7. services of interest
$Audit.services = Try-Step 'services' {
  @(Get-CimInstance Win32_Service | Where-Object { $_.Name -match '(?i)postgres|mysql|maria|cloudflared|pm2|nginx|caddy|w3svc|iis|apache|httpd|anydesk|teamviewer|sshd|rustdesk|node|redis|nssm|winsw|backup|veeam|tailscale|zerotier|wireguard|openvpn' -or $_.DisplayName -match '(?i)postgres|maria|cloudflare|pm2|backup' -or "$($_.PathName)" -match '(?i)node\.exe|S2A_PROJECT' } |
    Sort-Object Name | ForEach-Object { [ordered]@{ name = $_.Name; display = $_.DisplayName; state = $_.State; startMode = $_.StartMode; delayed = $_.DelayedAutoStart; account = $_.StartName; processId = $_.ProcessId; binary = (Redact $_.PathName) } })
}

# ---------------------------------------------------------------- 8. Cloudflare tunnel (routing only - never credentials or tokens)
$Audit.cloudflared = Try-Step 'cloudflared' {
  $svc = @(Get-CimInstance Win32_Service | Where-Object { $_.Name -match '(?i)cloudflared' })
  $cand = @()
  foreach ($s in $svc) { if ("$($s.PathName)" -match '(?i)--config\s+"?([^"]+?\.ya?ml)"?(\s|$)') { $cand += $Matches[1] } }
  $cand += @("$env:USERPROFILE\.cloudflared\config.yml", "$env:USERPROFILE\.cloudflared\config.yaml", "$env:SystemRoot\System32\config\systemprofile\.cloudflared\config.yml", "$env:ProgramData\Cloudflare\cloudflared\config.yml", "$env:ProgramData\cloudflared\config.yml", "${env:ProgramFiles(x86)}\cloudflared\config.yml", "$env:ProgramFiles\cloudflared\config.yml")
  $configs = @()
  foreach ($c in @($cand | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $c -ErrorAction Ignore) {
      $lines = @(Get-Content -LiteralPath $c -ErrorAction Ignore)
      $ing = @(); $cur = $null
      foreach ($l in $lines) {
        if ($l -match '^\s*-\s*hostname:\s*(\S+)') { $cur = [ordered]@{ hostname = $Matches[1]; service = $null; path = $null }; $ing += $cur }
        elseif ($l -match '^\s*-\s*service:\s*(\S+)') { $ing += [ordered]@{ hostname = '(catch-all)'; service = $Matches[1]; path = $null }; $cur = $null }
        elseif ($cur -and $l -match '^\s*service:\s*(\S+)') { $cur.service = $Matches[1] }
        elseif ($cur -and $l -match '^\s*path:\s*(\S+)') { $cur.path = $Matches[1] }
      }
      $configs += [ordered]@{ file = $c; ingress = $ing }
    }
  }
  [ordered]@{
    services = @($svc | ForEach-Object { [ordered]@{ name = $_.Name; state = $_.State; startMode = $_.StartMode; account = $_.StartName; mode = $(if ("$($_.PathName)" -match '(?i)--token-file|--token\b') { 'token (remotely managed ingress)' } elseif ("$($_.PathName)" -match '(?i)--config') { 'config file' } else { 'default' }); binary = (Redact $_.PathName) } })
    localConfigs = $configs
    metricsListeners = @($Audit.listeners | Where-Object { $_ -and $_.process -eq 'cloudflared.exe' } | ForEach-Object { "$($_.address):$($_.port)" })
    note = 'Token-run tunnels are remotely managed: their ingress (hostname -> service) lives in the Cloudflare dashboard and cannot be read on the host.'
  }
}

# ---------------------------------------------------------------- 9. scheduled tasks (non-Microsoft)
$Audit.scheduledTasks = Try-Step 'scheduledTasks' {
  @(Get-ScheduledTask -ErrorAction Ignore | Where-Object { $_.TaskPath -notmatch '^\\Microsoft\\' } | ForEach-Object {
    $info = $_ | Get-ScheduledTaskInfo -ErrorAction Ignore
    [ordered]@{ path = $_.TaskPath; name = $_.TaskName; state = "$($_.State)"; runAs = $_.Principal.UserId; runLevel = "$($_.Principal.RunLevel)"
      actions = @($_.Actions | ForEach-Object { Redact "$($_.Execute) $($_.Arguments)" })
      triggers = @($_.Triggers | ForEach-Object { "$($_.CimClass.CimClassName -replace 'MSFT_Task','' -replace 'Trigger','') $($_.StartBoundary) $(if ($_.Repetition.Interval) { 'every ' + $_.Repetition.Interval })".Trim() })
      lastRun = $(if ($info) { Iso $info.LastRunTime } else { $null }); lastResult = $(if ($info) { $info.LastTaskResult } else { $null }); nextRun = $(if ($info) { Iso $info.NextRunTime } else { $null }) } })
}

# ---------------------------------------------------------------- 10. firewall
$Audit.firewall = Try-Step 'firewall' {
  $profiles = @(Get-NetFirewallProfile | ForEach-Object { [ordered]@{ name = "$($_.Name)"; enabled = "$($_.Enabled)"; defaultInbound = "$($_.DefaultInboundAction)"; defaultOutbound = "$($_.DefaultOutboundAction)" } })
  $activeOn = @()
  foreach ($a in @(Get-NetConnectionProfile -ErrorAction Ignore)) {
    $cat = "$($a.NetworkCategory)"; $pname = $cat; if ($cat -eq 'DomainAuthenticated') { $pname = 'Domain' }
    $pr = $profiles | Where-Object { $_.name -eq $pname } | Select-Object -First 1
    $activeOn += [ordered]@{ alias = $a.InterfaceAlias; category = $cat; firewallEnabled = $(if ($pr) { $pr.enabled } else { $null }) }
  }
  $watch = @(@($Audit.listeners | Where-Object { $_ -and -not $_.loopbackOnly } | ForEach-Object { "$($_.port)" }) + @('5432', '3306', '3389', '445', '22', '80', '443') + @($CandidatePorts | ForEach-Object { "$_" })) | Select-Object -Unique
  $rules = @(Get-NetFirewallRule -Direction Inbound -Enabled True -Action Allow -ErrorAction Ignore)
  $portBy = @{}; Get-NetFirewallPortFilter -All -ErrorAction Ignore | ForEach-Object { $portBy[$_.InstanceID] = $_ }
  $appBy = @{}; Get-NetFirewallApplicationFilter -All -ErrorAction Ignore | ForEach-Object { $appBy[$_.InstanceID] = $_ }
  $addrBy = @{}; Get-NetFirewallAddressFilter -All -ErrorAction Ignore | ForEach-Object { $addrBy[$_.InstanceID] = $_ }
  $hits = @()
  foreach ($r in $rules) {
    $pf = $portBy[$r.InstanceID]; $app = $appBy[$r.InstanceID]; $af = $addrBy[$r.InstanceID]
    if (-not $pf -or "$($pf.Protocol)" -notin @('TCP', 'Any')) { continue }
    $lp = @($pf.LocalPort | ForEach-Object { "$_" })
    $prog = 'Any'; if ($app) { $prog = "$($app.Program)" }
    $match = [bool](@($lp | Where-Object { $watch -contains $_ }).Count)
    if (($lp -contains 'Any') -and $prog -match '(?i)node|postgres|mysqld|mariadb|cloudflared|pm2') { $match = $true }
    if ($match) { $hits += [ordered]@{ name = $r.DisplayName; profile = "$($r.Profile)"; ports = ($lp -join ','); program = (Redact $prog); remote = $(if ($af) { @($af.RemoteAddress) -join ',' } else { '?' }) } }
  }
  [ordered]@{ profiles = $profiles; activeNetworks = $activeOn; relevantInboundAllowRules = $hits; inboundAllowRuleCount = $rules.Count; filtersLoaded = ($portBy.Count -gt 0)
    lanReachableListeners = @($Audit.listeners | Where-Object { $_ -and -not $_.loopbackOnly -and [int]$_.port -lt 49152 } | ForEach-Object { "$($_.address):$($_.port) $($_.process)" }) }
}

# ---------------------------------------------------------------- 11. existing backups (names, counts, sizes, ages only - nothing opened)
$Audit.backups = Try-Step 'backups' {
  $dirs = @(Get-ChildItem $env:USERPROFILE -Directory -ErrorAction Ignore | Where-Object { $_.Name -match '(?i)backup|dump' })
  foreach ($v in @(Get-Volume | Where-Object { $_.DriveLetter -and "$($_.DriveType)" -eq 'Fixed' })) {
    $dirs += @(Get-ChildItem "$($v.DriveLetter):\" -Directory -ErrorAction Ignore | Where-Object { $_.Name -match '(?i)backup|dump|nas' })
  }
  [ordered]@{
    folders = @($dirs | ForEach-Object {
      $f = @(Get-ChildItem -LiteralPath $_.FullName -File -Recurse -ErrorAction Ignore)
      $newest = $f | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      $bytes = 0.0; foreach ($x in $f) { $bytes += [double]$x.Length }
      $ext = @($f | Group-Object Extension | Sort-Object Count -Descending | Select-Object -First 4 | ForEach-Object { "$($_.Name) x$($_.Count)" })
      [ordered]@{ path = $_.FullName; files = $f.Count; sizeMB = (Num ($bytes / 1MB)); newest = $(if ($newest) { Iso $newest.LastWriteTime } else { $null }); topExtensions = $ext } })
    tasks = @($Audit.scheduledTasks | Where-Object { $_ -and ("$($_.name) $(@($_.actions) -join ' ')") -match '(?i)backup|pg_dump|pg_dumpall|mysqldump|mariadb-dump|robocopy|rclone|restic|wbadmin' } | ForEach-Object { "$($_.path)$($_.name) [$($_.state)] last=$($_.lastRun) result=$($_.lastResult)" })
    windowsBackupService = @(Get-Service -Name 'wbengine', 'SDRSVC', 'VSS' -ErrorAction Ignore | ForEach-Object { "$($_.Name): $($_.Status)/$($_.StartType)" })
  }
}

# ---------------------------------------------------------------- 12. PostgreSQL (read-only session; optional)
$Audit.postgres = Try-Step 'postgres' {
  $svc = @(Get-CimInstance Win32_Service | Where-Object { $_.Name -match '(?i)^postgresql' })
  $res = [ordered]@{ services = @($svc | ForEach-Object { [ordered]@{ name = $_.Name; state = $_.State; startMode = $_.StartMode; account = $_.StartName; processId = $_.ProcessId; binary = (Redact $_.PathName) } }); queried = $false }
  $bin = $null
  foreach ($s in $svc) { if ("$($s.PathName)" -match '"?([A-Za-z]:\\[^"]+\\bin)\\pg_ctl\.exe') { $bin = $Matches[1] } }
  $res.binDir = $bin
  $port = $PgPort
  if (-not $port) { $l = @($Audit.listeners | Where-Object { $_ -and $_.process -eq 'postgres.exe' } | Select-Object -First 1); if ($l.Count -gt 0 -and $l[0]) { $port = [int]$l[0].port } else { $port = 5432 } }
  $res.port = $port
  $res.listeners = @($Audit.listeners | Where-Object { $_ -and $_.process -eq 'postgres.exe' } | ForEach-Object { "$($_.address):$($_.port)" })
  $res.postmasterPid = $null; $res.postmasterStarted = $null
  if ($svc.Count -gt 0 -and $svc[0].ProcessId) {
    $svcPid = [int]$svc[0].ProcessId
    $pm = @($procs.Values | Where-Object { [int]$_.ParentProcessId -eq $svcPid -and $_.Name -eq 'postgres.exe' } | Select-Object -First 1)
    if ($pm.Count -gt 0 -and $pm[0]) { $res.postmasterPid = [int]$pm[0].ProcessId; $res.postmasterStarted = (Iso $pm[0].CreationDate) }
  }
  if ($PgUser -and $bin -and (Test-Path "$bin\psql.exe")) {
    $sec = Read-Host -AsSecureString "PostgreSQL password for $PgUser (used once, read-only session, not stored)"
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=15000'
    $env:PGCONNECT_TIMEOUT = '10'
    $q = [ordered]@{
      server = "select json_build_object('version', version(), 'readOnlySession', current_setting('default_transaction_read_only'), 'postmasterStart', pg_postmaster_start_time(), 'settings', (select json_object_agg(name, setting) from pg_settings where name in ('port','listen_addresses','data_directory','hba_file','max_connections','superuser_reserved_connections','shared_buffers','effective_cache_size','work_mem','maintenance_work_mem','wal_level','archive_mode','max_wal_size','ssl','password_encryption','data_checksums','logging_collector','log_directory','log_rotation_size','log_rotation_age','timezone','server_encoding')))"
      databases = "select coalesce(json_agg(json_build_object('name', datname, 'owner', pg_get_userbyid(datdba), 'sizeMB', round(pg_database_size(oid)/1048576.0, 1), 'connLimit', datconnlimit, 'allowConn', datallowconn, 'encoding', pg_encoding_to_char(encoding), 'collate', datcollate, 'ctype', datctype, 'localeProvider', datlocprovider) order by datname), '[]') from pg_database where not datistemplate"
      roles = "select coalesce(json_agg(json_build_object('name', rolname, 'superuser', rolsuper, 'login', rolcanlogin, 'createdb', rolcreatedb, 'createrole', rolcreaterole, 'connLimit', rolconnlimit) order by rolname), '[]') from pg_roles where rolname !~ '^pg_'"
      activity = "select coalesce(json_agg(s), '[]') from (select datname as db, usename as role, coalesce(state, '-') as state, count(*) as n from pg_stat_activity where backend_type = 'client backend' group by 1, 2, 3 order by 1, 2, 3) s"
      hba = "select coalesce(json_agg(json_build_object('line', line_number, 'type', type, 'database', database, 'user', user_name, 'address', address, 'netmask', netmask, 'method', auth_method, 'error', error) order by line_number), '[]') from pg_hba_file_rules"
      tablespaces = "select coalesce(json_agg(json_build_object('name', spcname, 'location', pg_tablespace_location(oid))), '[]') from pg_tablespace"
    }
    $out = [ordered]@{}
    foreach ($k in $q.Keys) {
      $r = & "$bin\psql.exe" -h 127.0.0.1 -p $port -U $PgUser -d postgres -X -A -t -q -v ON_ERROR_STOP=1 -c $q[$k] 2>&1
      if ($LASTEXITCODE -eq 0) { $out[$k] = ($r -join '') | ConvertFrom-Json } else { $out[$k] = "ERROR: $(Redact (($r | Out-String).Trim()))" }
    }
    $env:PGPASSWORD = $null; $env:PGOPTIONS = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $res.queried = $true; $res.result = $out
    $res.pgDumpVersion = (& "$bin\pg_dump.exe" --version 2>$null)
  } elseif (-not $PgUser) { $res.note = 'Not queried: run with -PgUser <superuser> for settings, databases, roles, hba and activity.' }
  $res
}
$Audit.mariadb = Try-Step 'mariadb' { @($Audit.listeners | Where-Object { $_ -and $_.process -match '(?i)mysqld|mariadbd' } | ForEach-Object { "$($_.address):$($_.port) $($_.process)" }) }

# ---------------------------------------------------------------- 13. resource utilisation (sampled; null-safe)
$Audit.resources = Try-Step 'resources' {
  $s = @()
  for ($i = 0; $i -lt $Samples; $i++) {
    $cpu = $null; $free = $null; $disk = $null
    try { $cpu = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction Stop).PercentProcessorTime } catch { }
    try { $free = (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).FreePhysicalMemory } catch { }
    try { $disk = (Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'" -ErrorAction Stop).PercentDiskTime } catch { }
    $s += [ordered]@{ at = (Get-Date).ToString('HH:mm:ss'); cpuPct = (Num $cpu 0); freeRamGB = $(if ($null -ne $free) { Num ($free / 1MB) 2 } else { $null }); diskTimePct = (Num $disk 0) }
    if ($i -lt $Samples - 1) { Start-Sleep -Seconds $SampleSeconds }
  }
  $cpuS = Stats @($s | ForEach-Object { $_.cpuPct }); $ramS = Stats @($s | ForEach-Object { $_.freeRamGB }); $dskS = Stats @($s | ForEach-Object { $_.diskTimePct })
  [ordered]@{
    samples = $s
    cpuAvgPct = $cpuS.avg; cpuMaxPct = $cpuS.max; cpuSamples = $cpuS.count
    freeRamMinGB = $ramS.min; freeRamAvgGB = $ramS.avg; ramSamples = $ramS.count
    diskTimeMaxPct = $dskS.max
    topMemory = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 | ForEach-Object { [ordered]@{ name = $_.ProcessName; pid = $_.Id; wsMB = (Num ($_.WorkingSet64 / 1MB) 0); cpuSec = (Num $_.CPU 0) } })
  }
}

# ---------------------------------------------------------------- 14. loopback availability baseline
$Audit.httpBaseline = Try-Step 'httpBaseline' {
  if ($NoHttpProbe) { return 'skipped (-NoHttpProbe)' }
  $targets = @{}
  foreach ($l in @($Audit.listeners)) {
    if ($null -eq $l -or "$($l.process)" -notmatch '(?i)^node') { continue }
    $p = [int]$l.port
    if (-not $targets.ContainsKey($p)) { $targets[$p] = @() }
    $targets[$p] += "$($l.address)"
  }
  @($targets.Keys | Sort-Object | ForEach-Object {
    $port = [int]$_; $addrs = @($targets[$port])
    $hostPart = '127.0.0.1'
    if (-not (@($addrs | Where-Object { $_ -in @('0.0.0.0', '127.0.0.1') }).Count) -and (@($addrs | Where-Object { $_ -in @('::', '::1') }).Count)) { $hostPart = '[::1]' }
    $sw = [Diagnostics.Stopwatch]::StartNew(); $code = $null; $err = $null
    try { $r = Invoke-WebRequest -Uri "http://${hostPart}:$port/" -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop; $code = [int]$r.StatusCode }
    catch { if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } else { $err = "$($_.Exception.Message)" } }
    $sw.Stop()
    [ordered]@{ port = $port; host = $hostPart; status = $code; error = $err; ms = $sw.ElapsedMilliseconds } })
}

# ---------------------------------------------------------------- 15. proposed CORE staging port availability
$Audit.candidatePorts = Try-Step 'candidatePorts' {
  @($CandidatePorts | ForEach-Object {
    $p = [int]$_
    [ordered]@{ port = $p
      listening = [bool](@($Audit.listeners | Where-Object { $_ -and [int]$_.port -eq $p }).Count)
      udp = [bool](@(Get-NetUDPEndpoint -LocalPort $p -ErrorAction Ignore).Count)
      inExcludedRange = [bool](@($Audit.excludedPortRanges | Where-Object { $_ -and $p -ge [int]$_.start -and $p -le [int]$_.end }).Count)
      firewallRule = [bool](@($Audit.firewall.relevantInboundAllowRules | Where-Object { $_ -and (("$($_.ports)") -split ',') -contains "$p" }).Count)
      inLocalTunnelConfig = [bool](@(@($Audit.cloudflared.localConfigs) | ForEach-Object { if ($_) { $_.ingress } } | Where-Object { $_ -and "$($_.service)" -match ":$p(\b|/|$)" }).Count) } })
}

# ---------------------------------------------------------------- 16. repository on this host
$Audit.repository = Try-Step 'repository' {
  [ordered]@{ root = $RepoRoot; head = (& git -C $RepoRoot rev-parse HEAD 2>$null); branch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>$null); originMain = (& git -C $RepoRoot rev-parse origin/main 2>$null)
    changedFiles = @(& git -C $RepoRoot status --porcelain 2>$null)
    nodeModules = [ordered]@{ backend = (Test-Path "$RepoRoot\backend\node_modules"); frontend = (Test-Path "$RepoRoot\frontend\node_modules") }
    envFiles = @(Get-ChildItem $RepoRoot -Recurse -Force -File -Filter '.env*' -ErrorAction Ignore | Where-Object { $_.FullName -notmatch '\\node_modules\\' } | ForEach-Object { $_.FullName.Substring($RepoRoot.Length + 1) }) }
}

$Audit.finishedAt = (Get-Date).ToString('o')
$jsonPath = Join-Path $OutDir 'host-audit.json'
$Audit | ConvertTo-Json -Depth 10 | Set-Content -Path $jsonPath -Encoding UTF8

# ---------------------------------------------------------------- human summary (every field null-safe)
$sum = @()
$sum += "EP48.5 host audit (collector v2)  $($Audit.startedAt)"
$id = $Audit.identity
$sum += "Host: $(Val $id.hostname) | $(Val $id.os) $(Val $id.osVersion) | $(Val $id.cpu) | $(Val $id.ramGB) GB | up $(Val $id.uptimeHours) h | elevated=$(Val $id.elevated)"
$sum += 'Volumes:'; foreach ($v in @($Audit.storage.volumes)) { if ($v) { $sum += "  $(Val $v.drive) $($v.label) $(Val $v.sizeGB) GB, free $(Val $v.freeGB) GB ($(Val $v.usedPct)% used)" } }
$sum += "Node $(Val $Audit.runtime.node) | npm $(Val $Audit.runtime.npm) | pm2 $(Val $Audit.runtime.pm2Version)"
$sum += 'PM2 daemons (pm2 command not run):'
foreach ($d in @($Audit.pm2.daemons)) {
  if (-not $d) { continue }
  $flag = ''; if ($d.startedDuringThisRun) { $flag = ' STARTED DURING THIS RUN' }
  $sum += "  pid $(Val $d.pid) started $(Val $d.started) owner $(Val $d.owner) [$(Val $d.evidence)] children=$(@($d.apps).Count)$flag"
  foreach ($a in @($d.apps)) { if ($a -and @($a.ports).Count) { $sum += "    child $(Val $a.pid) ports $(@($a.ports) -join ',')" } }
}
foreach ($h in @($Audit.pm2.homes)) { if ($h) { $sum += "  home $(Val $h.home): pidFiles=$(@($h.pidFiles).Count) dumpApps=$(@($h.dump).Count) readable=$(Val $h.readable)"; foreach ($p in @($h.pidFiles)) { if ($p) { $sum += "    $(Val $p.app) pid=$(Val $p.pid) alive=$(Val $p.alive) ports=$(@($p.ports) -join ',')" } } } }
foreach ($x in @($Audit.pm2.startup)) { if ($x) { $sum += "  startup: $x" } }
$sum += 'TCP listeners:'; foreach ($l in @($Audit.listeners)) { if ($l) { $sum += "  $(Val $l.address):$(Val $l.port)  $(Val $l.process)" } }
$sum += "PostgreSQL queried=$(Val $Audit.postgres.queried) listeners=$(@($Audit.postgres.listeners) -join ',')"
$sum += "Cloudflared services=$(@($Audit.cloudflared.services).Count) localConfigs=$(@($Audit.cloudflared.localConfigs).Count)"
$sum += 'SMB shares:'; foreach ($sh in @($Audit.storage.smbShares)) { if ($sh) { $sum += "  $(Val $sh.name) -> $(Val $sh.path) special=$(Val $sh.special) access=$(@($sh.access) -join '; ')" } }
$sum += "Firewall:$((@($Audit.firewall.activeNetworks) | ForEach-Object { if ($_) { "$($_.alias)=$($_.category) enabled=$($_.firewallEnabled)" } }) -join '; ')"
$sum += "CPU avg/max $(Val $Audit.resources.cpuAvgPct)/$(Val $Audit.resources.cpuMaxPct)% over $(Val $Audit.resources.cpuSamples) samples | min free RAM $(Val $Audit.resources.freeRamMinGB) GB"
$sum += 'HTTP baseline:'
if ($Audit.httpBaseline -is [string]) { $sum += "  $($Audit.httpBaseline)" } else { foreach ($h in @($Audit.httpBaseline)) { if ($h) { $sum += "  $(Val $h.port): $(Val $h.status) $(Val $h.ms) ms $($h.error)" } } }
$sum += 'Candidate CORE staging ports:'; foreach ($c in @($Audit.candidatePorts)) { if ($c) { $sum += "  $(Val $c.port): listening=$(Val $c.listening) udp=$(Val $c.udp) excludedRange=$(Val $c.inExcludedRange) firewall=$(Val $c.firewallRule)" } }
$sum += "Errors: $(@($Audit.errors).Count) | warnings: $(@($Audit.warnings).Count) | elevation gaps: $(@($Audit.elevationGaps).Count)"
foreach ($e in @($Audit.errors)) { $sum += "  ERROR $e" }
foreach ($e in @($Audit.elevationGaps)) { $sum += "  NEEDS ELEVATION: $e" }
$sum | Set-Content -Path (Join-Path $OutDir 'summary.txt') -Encoding UTF8
$sum | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Written: $OutDir"
Write-Host "Nothing on this host was changed (no pm2 command was run)."
