# PDA BLISS CORE - EP48.5 G0 harness: Windows PowerShell 5.1 regression tests for incident g0-20261117-134458.
#
# Run in an ELEVATED Windows PowerShell 5.1 on S2A-SERVER (elevation lets the facts script read SYSTEM command lines):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\g0-harness\Test-G0Harness.ps1
#
# Safe for the host: no G0 run, no database, no npm, no service / task / firewall / PM2 / PostgreSQL change, no
# listener outside 127.0.0.1 (the Node suites run under the loopback-only guard). It only starts its own short-lived
# helper processes (ping.exe to 127.0.0.1, cmd.exe, powershell.exe, node.exe) in a new folder under %TEMP%, stops only
# its own ping.exe through g0-supervisor.mjs stop-tree, and asks the supervisor for a PLAN (never an action) against
# production PIDs. Results: ops-logs\ep48_5-g0\harness-test-<timestamp>\ (git-ignored). Exit 0 = all PASS.
param([string]$Dev = 'D:\S2A_PROJECT\pdabliss_core')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Off
. (Join-Path $PSScriptRoot 'g0-common.ps1')
$testStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$workDir = Join-Path $env:TEMP "g0-harness-test-$testStamp"
$reportDir = Join-Path $Dev "ops-logs\ep48_5-g0\harness-test-$testStamp"
New-Item -ItemType Directory -Force -Path $workDir, $reportDir | Out-Null
$supervisorScript = Join-Path $Dev 'ops\ep48_5\g0-supervisor.mjs'
$nodePath = (Get-Command node.exe).Source
$testStart = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").CreationDate.ToString('o')
$outcomes = @()
function Add-Outcome([string]$TestId, [string]$TestName, [bool]$IsPass, $Detail) {
  $script:outcomes += [ordered]@{ id = $TestId; name = $TestName; pass = $IsPass; detail = $Detail }
  $colour = 'Green'; if (-not $IsPass) { $colour = 'Red' }
  Write-Host ("{0,-4} {1,-5} {2}" -f $TestId, $(if ($IsPass) { 'PASS' } else { 'FAIL' }), $TestName) -ForegroundColor $colour
}
function Invoke-Node([string]$StepName, [string[]]$NodeArgs, [int]$Seconds = 120) {
  Invoke-G0Bounded -Name $StepName -FilePath $nodePath -ArgumentValues $NodeArgs -WorkingDirectory $Dev -LogDir $workDir -TimeoutSec $Seconds
}

# P1 - PowerShell 5.1 itself: the incident's variable collision and positional dictionary lookup, reproduced.
try {
  $reproText = Get-Content -LiteralPath (Join-Path $Dev 'ops\test\g0-fixtures\incident-20261117\ps-collision-repro.ps1.txt') -Raw
  $repro = & ([scriptblock]::Create($reproText)) 55443
  $passed = ($repro.portAfterLoop -eq 9899) -and ($repro.portTypeAfterLoop -eq 'Int32') -and ($null -eq $repro.statusByIntKey) -and ($repro.statusByStringKey -eq 200)
  Add-Outcome 'P1' 'PS 5.1 reproduces cause 1: loop variable overwrote [int] parameter; [int] key lookup on ordered dictionary is empty' $passed $repro
} catch { Add-Outcome 'P1' 'PS 5.1 collision reproduction' $false $_.Exception.Message }

# P2 - the AST checker finds the incident monitor's defect and finds nothing in the current scripts.
try {
  $incidentCopy = Join-Path $workDir 'g0-monitor.e784ca1.ps1'
  Copy-Item -LiteralPath (Join-Path $Dev 'ops\test\g0-fixtures\incident-20261117\g0-monitor.e784ca1.ps1.txt') -Destination $incidentCopy
  $incidentHazards = @(Get-G0VariableHazards $incidentCopy)
  $currentHazards = @()
  foreach ($scriptRel in @('ops\ep48_5\g0-harness\Run-G0.ps1', 'ops\ep48_5\g0-harness\g0-common.ps1', 'ops\ep48_5\g0-harness\g0-facts.ps1', 'ops\ep48_5\g0-harness\Preflight-G0.ps1', 'ops\ep48_5\g0-harness\Test-G0Harness.ps1', 'ops\ep48_5\Collect-HostAudit.ps1')) {
    foreach ($hazard in @(Get-G0VariableHazards (Join-Path $Dev $scriptRel))) { $currentHazards += "$scriptRel $hazard" }
  }
  $passed = ($incidentHazards.Count -ge 2) -and ($currentHazards.Count -eq 0)
  Add-Outcome 'P2' 'AST variable check: incident monitor flagged, current scripts clean' $passed ([ordered]@{ incident = $incidentHazards; current = $currentHazards })
} catch { Add-Outcome 'P2' 'AST variable check' $false $_.Exception.Message }

# P3 - cause 2: a child that leaves a grandchild holding inherited handles returns control at once through
# Invoke-G0Bounded (files), while the old `& ... *> file` pattern blocks until the grandchild ends.
try {
  $bounded = Invoke-G0Bounded -Name 'p3-bounded' -FilePath (Join-Path $env:SystemRoot 'System32\cmd.exe') -ArgumentValues @('/c', 'start', '/b', 'ping', '-n', '12', '127.0.0.1') -WorkingDirectory $workDir -LogDir $workDir -TimeoutSec 60
  $oldPattern = Join-Path $workDir 'p3-old-pattern.ps1'
  Set-Content -LiteralPath $oldPattern -Encoding ASCII -Value ('& cmd.exe /c "start /b ping -n 8 127.0.0.1" *> "' + (Join-Path $workDir 'p3-old.log') + '"')
  $old = Invoke-G0Bounded -Name 'p3-old' -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentValues @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $oldPattern) -WorkingDirectory $workDir -LogDir $workDir -TimeoutSec 60
  $passed = ($bounded.status -eq 'OK') -and ($bounded.seconds -le 4) -and ($old.status -eq 'OK') -and ($old.seconds -ge 6)
  Add-Outcome 'P3' 'pg_ctl-style start returns control (bounded: seconds <= 4); old *> pattern blocked (>= 6 s)' $passed ([ordered]@{ boundedSeconds = $bounded.seconds; oldPatternSeconds = $old.seconds })
} catch { Add-Outcome 'P3' 'start returns control' $false $_.Exception.Message }

# P4 - STOP during a blocked step: the step returns within seconds and ONLY its own process is stopped (verified).
try {
  $stopMarker = Join-Path $workDir 'STOP'
  $markerScript = Join-Path $workDir 'p4-write-stop.ps1'
  Set-Content -LiteralPath $markerScript -Encoding ASCII -Value ("Start-Sleep -Seconds 3; Set-Content -LiteralPath '" + $stopMarker + "' -Value 'test stop'")
  $markerWriter = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList (ConvertTo-G0ArgLine @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $markerScript)) -WindowStyle Hidden -PassThru
  $stopCalls = @()
  $blocked = Invoke-G0Bounded -Name 'p4-blocked-step' -FilePath (Join-Path $env:SystemRoot 'System32\PING.EXE') -ArgumentValues @('-n', '120', '127.0.0.1') -WorkingDirectory $workDir -LogDir $workDir -TimeoutSec 90 -StopFile $stopMarker -OnAbort {
    param($ChildPid, $ChildCreated, $Why)
    $script:stopCalls += $ChildPid
    $null = Invoke-Node 'p4-stop-tree' @($supervisorScript, 'stop-tree', '--root', "$ChildPid", '--root-created', $ChildCreated, '--not-before', $testStart, '--g0-dir', $workDir, '--out', $workDir, '--reason', $Why) 60
  }
  Start-Sleep -Seconds 1
  $stillThere = $null -ne (Get-Process -Id $blocked.childPid -ErrorAction SilentlyContinue)
  $passed = ($null -ne $markerWriter) -and ($blocked.status -eq 'STOPPED') -and ($blocked.seconds -le 15) -and (-not $stillThere) -and ($stopCalls.Count -eq 1)
  Add-Outcome 'P4' 'STOP propagates during a blocked step; its own process stopped via verified stop-tree' $passed ([ordered]@{ status = $blocked.status; seconds = $blocked.seconds; reason = $blocked.reason; childStillRunning = $stillThere })
} catch { Add-Outcome 'P4' 'STOP propagation' $false $_.Exception.Message }

# P5 - production protection: the supervisor PLANS (never acts) against the PM2 daemon and the shared postmaster.
try {
  $allProcs = @(Get-CimInstance Win32_Process)
  $pm2Daemons = @($allProcs | Where-Object { $_.Name -eq 'node.exe' -and "$($_.CommandLine)" -match 'pm2[\\/]lib[\\/]Daemon\.js' })
  $nameByPid = @{}; foreach ($procItem in $allProcs) { $nameByPid[[int]$procItem.ProcessId] = $procItem.Name }
  $sharedPostmaster = $allProcs | Where-Object { $_.Name -eq 'postgres.exe' -and $nameByPid[[int]$_.ParentProcessId] -eq 'pg_ctl.exe' -and "$($_.CommandLine)" -notmatch 'pdabliss-core-staging' } | Select-Object -First 1
  $planned = @()
  foreach ($target in @($pm2Daemons) + @($sharedPostmaster)) {
    if (-not $target) { continue }
    $plan = Invoke-Node ("p5-plan-{0}" -f $target.ProcessId) @($supervisorScript, 'plan-stop-tree', '--root', "$($target.ProcessId)", '--root-created', $target.CreationDate.ToString('o'), '--not-before', $testStart, '--g0-dir', $workDir) 120
    $planJson = Get-Content -LiteralPath $plan.stdout -Raw | ConvertFrom-Json
    $planned += [ordered]@{ pid = $target.ProcessId; exit = $plan.exit; stop = @($planJson.plan.stop).Count; refused = @($planJson.plan.refused | ForEach-Object { $_.reason }) }
  }
  $passed = ($planned.Count -ge 2) -and (@($planned | Where-Object { $_.stop -ne 0 -or $_.exit -ne 3 }).Count -eq 0)
  Add-Outcome 'P5' 'production PIDs (PM2 daemon(s), shared postmaster) are refused by the stop planner' $passed $planned
} catch { Add-Outcome 'P5' 'production protection' $false $_.Exception.Message }

# P6 - the facts script returns typed JSON the supervisor accepts (read-only).
try {
  $facts = Invoke-G0Bounded -Name 'p6-facts' -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentValues @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'g0-facts.ps1')) -WorkingDirectory $workDir -LogDir $workDir -TimeoutSec 120
  $factsJson = Get-Content -LiteralPath $facts.stdout -Raw | ConvertFrom-Json
  $passed = ($facts.status -eq 'OK') -and (@($factsJson.processes).Count -gt 50) -and (@($factsJson.listeners | Where-Object { $_.port -eq 5432 }).Count -ge 1) -and ($factsJson.cpuPct -is [int])
  Add-Outcome 'P6' 'g0-facts.ps1: processes, listeners (5432 present), typed resource readings' $passed ([ordered]@{ processes = @($factsJson.processes).Count; listeners = @($factsJson.listeners).Count; cpuPct = $factsJson.cpuPct; freeRamGB = $factsJson.freeRamGB })
} catch { Add-Outcome 'P6' 'facts script' $false $_.Exception.Message }

# P7 - the EP48.5 Node suites on Windows / Node 24, under the loopback-only guard, concurrency 2 (no database: T10 and
# the EP43 suite, which needs the backend's dependencies, are not part of this run).
try {
  $loopbackDir = Join-Path $workDir 'loopback'
  New-Item -ItemType Directory -Force -Path $loopbackDir | Out-Null
  $suiteFiles = @(Get-ChildItem -LiteralPath (Join-Path $Dev 'ops\test') -Filter '*.test.mjs' | Where-Object { $_.Name -notin @('ops.test.mjs', 'staging-launch.g0.test.mjs') } | Sort-Object Name | ForEach-Object { "ops/test/$($_.Name)" })
  $env:NODE_OPTIONS = '--import=' + ([Uri](Join-Path $Dev 'ops\ep48_5\g0-loopback-preload.mjs')).AbsoluteUri
  $env:CORE_G0_LOOPBACK_DIR = $loopbackDir
  try { $suite = Invoke-Node 'p7-node-suites' (@('--test', '--test-reporter=tap', '--test-concurrency=2') + $suiteFiles) 600 }
  finally { Remove-Item Env:NODE_OPTIONS; Remove-Item Env:CORE_G0_LOOPBACK_DIR }
  $tap = Get-Content -LiteralPath $suite.stdout -Raw
  $count = @{}
  foreach ($key in @('tests', 'pass', 'fail', 'skipped', 'todo', 'cancelled')) { if ($tap -match "(?m)^# $key (\d+)") { $count[$key] = [int]$Matches[1] } else { $count[$key] = -1 } }
  $violations = 0; $violationsFile = Join-Path $loopbackDir 'violations.log'
  if (Test-Path -LiteralPath $violationsFile) { $violations = @(Get-Content -LiteralPath $violationsFile).Count }
  $passed = ($suite.status -eq 'OK') -and ($count['fail'] -eq 0) -and ($count['skipped'] -eq 0) -and ($count['cancelled'] -eq 0) -and ($count['tests'] -gt 0) -and ($count['pass'] -eq $count['tests']) -and ($violations -eq 0)
  Add-Outcome 'P7' 'EP48.5 Node suites on Windows (loopback-only guard, concurrency 2): 0 fail, 0 skipped, 0 non-loopback attempts' $passed ([ordered]@{ files = $suiteFiles; counts = $count; nonLoopbackAttempts = $violations })
} catch { Add-Outcome 'P7' 'Node suites on Windows' $false $_.Exception.Message }

$allPassed = @($outcomes | Where-Object { -not $_.pass }).Count -eq 0
[ordered]@{ tool = 'EP48.5 Test-G0Harness (PowerShell 5.1)'; at = (Get-Date).ToString('o'); psVersion = "$($PSVersionTable.PSVersion)"; node = (& $nodePath -v); result = $(if ($allPassed) { 'PASS' } else { 'FAIL' }); tests = $outcomes } |
  ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportDir 'harness-test.json') -Encoding UTF8
Copy-Item -Path (Join-Path $workDir '*') -Destination $reportDir -Recurse -Force -ErrorAction SilentlyContinue   # copy, never move
Write-Host ''
Write-Host ("HARNESS TESTS: {0} - report {1}" -f $(if ($allPassed) { 'PASS' } else { 'FAIL' }), $reportDir)
if ($allPassed) { exit 0 } else { exit 1 }
