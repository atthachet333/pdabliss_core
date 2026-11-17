# PDA BLISS CORE - EP48.5 G0 harness: Windows PowerShell 5.1 regression tests for incident g0-20261117-134458.
#
# Run in an ELEVATED Windows PowerShell 5.1 on S2A-SERVER (elevation lets the facts script read SYSTEM command lines):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\g0-harness\Test-G0Harness.ps1
#
# Safe for the host: no G0 run, no database, no npm, no service / task / firewall / PM2 / PostgreSQL change, no
# listener outside 127.0.0.1 (the Node suites run under the loopback-only guard). It only starts its own short-lived
# helper processes (ping.exe to 127.0.0.1, cmd.exe, powershell.exe, node.exe) in a new folder under %TEMP%, stops only
# its own ping.exe processes through g0-supervisor.mjs stop-tree (verified identity), checks that none is left (P8), and asks the supervisor for a PLAN (never an action) against
# production PIDs. G0 run 3 readiness: P7 checks an exact per-file test manifest; P11 runs the runner-owned production
# I5 check read-only (loopback GET / to production ports, as the monitor does); P12 writes the read-only isolation
# report. Results: ops-logs\ep48_5-g0\harness-test-<timestamp>\ (git-ignored). Exit 0 = all PASS.
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
# C-A0.2: also proves that an unrelated process (a decoy started by this test, outside the step) survives, that a
# wrong start time is refused on a real process, and records the stop-tree's own timings (plan / verify / gone).
try {
  $stopMarker = Join-Path $workDir 'STOP'
  $markerScript = Join-Path $workDir 'p4-write-stop.ps1'
  Set-Content -LiteralPath $markerScript -Encoding ASCII -Value ("Start-Sleep -Seconds 3; Set-Content -LiteralPath '" + $stopMarker + "' -Value 'test stop'")
  $pingExe = Join-Path $env:SystemRoot 'System32\PING.EXE'
  $decoy = Start-Process -FilePath $pingExe -ArgumentList '-n 300 127.0.0.1' -WindowStyle Hidden -PassThru
  $decoyCreated = (Get-CimInstance Win32_Process -Filter "ProcessId=$($decoy.Id)").CreationDate.ToString('o')
  $markerWriter = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList (ConvertTo-G0ArgLine @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $markerScript)) -WindowStyle Hidden -PassThru
  $stopCalls = @()
  $stopTreeRun = $null
  $blocked = Invoke-G0Bounded -Name 'p4-blocked-step' -FilePath $pingExe -ArgumentValues @('-n', '120', '127.0.0.1') -WorkingDirectory $workDir -LogDir $workDir -TimeoutSec 90 -StopFile $stopMarker -OnAbort {
    param($ChildPid, $ChildCreated, $Why)
    $script:stopCalls += $ChildPid
    $script:stopTreeRun = Invoke-Node 'p4-stop-tree' @($supervisorScript, 'stop-tree', '--root', "$ChildPid", '--root-created', $ChildCreated, '--not-before', $testStart, '--g0-dir', $workDir, '--out', $workDir, '--reason', $Why) 60
  }
  $returnedAt = Get-Date
  $stopToReturn = [math]::Round(($returnedAt - (Get-Item -LiteralPath $stopMarker).LastWriteTime).TotalSeconds, 1)
  Start-Sleep -Seconds 1
  $stillThere = $null -ne (Get-Process -Id $blocked.childPid -ErrorAction SilentlyContinue)
  $treeTimings = $null
  $treeRecord = Get-ChildItem -LiteralPath $workDir -Filter ("stop-tree-{0}-*.json" -f $blocked.childPid) | Select-Object -First 1
  if ($treeRecord) { $treeTimings = (Get-Content -LiteralPath $treeRecord.FullName -Raw | ConvertFrom-Json).executed.timings }
  # A real process with a WRONG start time (as after PID reuse) must be refused - the decoy keeps running.
  $wrongTime = Invoke-Node 'p4-wrong-start-time' @($supervisorScript, 'stop-tree', '--root', "$($decoy.Id)", '--root-created', '2020-01-01T00:00:00.0000000+07:00', '--not-before', $testStart, '--g0-dir', $workDir, '--out', $workDir, '--reason', 'p4 wrong start time') 60
  $wrongPlan = (Get-Content -LiteralPath $wrongTime.stdout -Raw | ConvertFrom-Json).plan
  $decoyAlive = ($null -ne (Get-Process -Id $decoy.Id -ErrorAction SilentlyContinue))
  # Cleanup of the test's own decoy through the same verified path (correct identity) - no process left behind.
  $cleanup = Invoke-Node 'p4-cleanup-decoy' @($supervisorScript, 'stop-tree', '--root', "$($decoy.Id)", '--root-created', $decoyCreated, '--not-before', $testStart, '--g0-dir', $workDir, '--out', $workDir, '--reason', 'p4 cleanup of the test decoy') 60
  Start-Sleep -Seconds 1
  $decoyGone = ($null -eq (Get-Process -Id $decoy.Id -ErrorAction SilentlyContinue))
  $passed = ($null -ne $markerWriter) -and ($blocked.status -eq 'STOPPED') -and ($blocked.seconds -le 15) -and ($stopToReturn -le 10) -and (-not $stillThere) -and ($stopCalls.Count -eq 1) -and
    ($null -ne $stopTreeRun) -and ($stopTreeRun.status -eq 'OK') -and ($stopTreeRun.exit -eq 0) -and ($null -ne $treeTimings) -and
    (@($wrongPlan.stop).Count -eq 0) -and ("$(@($wrongPlan.refused)[0].reason)" -match 'start time differs') -and $decoyAlive -and ($cleanup.exit -eq 0) -and $decoyGone
  Add-Outcome 'P4' 'STOP during a blocked step: own process stopped via verified stop-tree; decoy untouched; wrong start time refused' $passed ([ordered]@{
      status = $blocked.status; seconds = $blocked.seconds; stopToReturnSeconds = $stopToReturn; reason = $blocked.reason; childStillRunning = $stillThere
      stopTreeSeconds = $(if ($stopTreeRun) { $stopTreeRun.seconds } else { $null }); stopTreeExit = $(if ($stopTreeRun) { $stopTreeRun.exit } else { $null }); stopTreeTimingsMs = $treeTimings
      wrongStartTimeRefused = "$(@($wrongPlan.refused)[0].reason)"; decoyAliveAfterRefusal = $decoyAlive; decoyCleanedUp = $decoyGone })
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
# the EP43 suite, which needs the backend's dependencies, are not part of this run). G0 run 3 readiness: the files and
# their EXACT test counts come from ops\ep48_5\g0-test-manifest.mjs; a per-test reporter records each test's file and
# `check` requires exactly the manifest (no file missing or added, no count drift, 0 fail / skipped / todo / cancelled).
try {
  $loopbackDir = Join-Path $workDir 'loopback'
  New-Item -ItemType Directory -Force -Path $loopbackDir | Out-Null
  $manifestTool = Join-Path $Dev 'ops\ep48_5\g0-test-manifest.mjs'
  $manifestList = Invoke-Node 'p7-manifest-files' @($manifestTool, 'files', '--manifest', 'p7') 60
  $suiteFiles = @(Get-Content -LiteralPath $manifestList.stdout | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() })
  $eventsFile = Join-Path $workDir 'p7-events.jsonl'
  $env:NODE_OPTIONS = '--import=' + ([Uri](Join-Path $Dev 'ops\ep48_5\g0-loopback-preload.mjs')).AbsoluteUri
  $env:CORE_G0_LOOPBACK_DIR = $loopbackDir
  try { $suite = Invoke-Node 'p7-node-suites' (@('--test', '--test-concurrency=2', '--test-reporter=tap', '--test-reporter-destination=stdout', ('--test-reporter=' + ([Uri]$manifestTool).AbsoluteUri), "--test-reporter-destination=$eventsFile") + $suiteFiles) 600 }
  finally { Remove-Item Env:NODE_OPTIONS; Remove-Item Env:CORE_G0_LOOPBACK_DIR }
  $tap = Get-Content -LiteralPath $suite.stdout -Raw
  $count = @{}
  foreach ($key in @('tests', 'pass', 'fail', 'skipped', 'todo', 'cancelled')) { if ($tap -match "(?m)^# $key (\d+)") { $count[$key] = [int]$Matches[1] } else { $count[$key] = -1 } }
  $violations = 0; $violationsFile = Join-Path $loopbackDir 'violations.log'
  if (Test-Path -LiteralPath $violationsFile) { $violations = @(Get-Content -LiteralPath $violationsFile).Count }
  $verdictFile = Join-Path $workDir 'p7-manifest-check.json'
  $manifestCheck = Invoke-Node 'p7-manifest-check' @($manifestTool, 'check', '--manifest', 'p7', '--events', $eventsFile, '--tap', $suite.stdout, '--test-dir', 'ops/test', '--violations', "$violations", '--out', $verdictFile) 60
  $verdict = Get-Content -LiteralPath $verdictFile -Raw | ConvertFrom-Json
  $passed = ($suite.status -eq 'OK') -and ($manifestCheck.status -eq 'OK') -and ($verdict.ok -eq $true) -and ($count['fail'] -eq 0) -and ($count['skipped'] -eq 0) -and ($count['cancelled'] -eq 0) -and ($count['todo'] -eq 0) -and ($count['tests'] -eq $verdict.expected) -and ($count['pass'] -eq $verdict.expected) -and ($violations -eq 0)
  Add-Outcome 'P7' "EP48.5 Node suites on Windows (loopback-only guard, concurrency 2): exactly the manifest ($($verdict.expected) tests in $($suiteFiles.Count) files), 0 fail / skipped / todo / cancelled, 0 non-loopback attempts" $passed ([ordered]@{ files = $suiteFiles; exit = $suite.exitText; seconds = $suite.seconds; expected = $verdict.expected; counts = $count; perFile = $verdict.perFile; problems = @($verdict.problems); nonLoopbackAttempts = $violations })
} catch { Add-Outcome 'P7' 'Node suites on Windows' $false $_.Exception.Message }

# P11 - G0 run 3 readiness: the runner-owned production I5 check on THIS host (read-only: loopback GET / to the
# production ports, exactly as the monitor does every round; nothing else). A fresh baseline then an unchanged host
# must PASS with every endpoint checked; a baseline with one expected status and one owning process altered must
# FAIL; a missing baseline must be MISSING. All three exit non-zero unless PASS.
try {
  $p11Base = Join-Path $workDir 'p11-baseline.json'
  $p11Tampered = Join-Path $workDir 'p11-baseline-tampered.json'
  $baseRun = Invoke-Node 'p11-baseline' @($supervisorScript, 'baseline', '--out', $p11Base, '--g0-dir', $workDir, '--temp-pg-port', '55443') 300
  $p11Baseline = Get-Content -LiteralPath $p11Base -Raw | ConvertFrom-Json
  $endpointCount = @($p11Baseline.http).Count
  $unchangedRun = Invoke-Node 'p11-i5-unchanged' @($supervisorScript, 'i5-check', '--baseline', $p11Base, '--out', (Join-Path $workDir 'p11-i5-unchanged.json'), '--g0-dir', $workDir, '--temp-pg-port', '55443', '--expect-endpoints', "$endpointCount") 600
  $unchanged = Get-Content -LiteralPath (Join-Path $workDir 'p11-i5-unchanged.json') -Raw | ConvertFrom-Json
  $tamperCode = "const fs = require('fs'); const b = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const e = b.http[0]; const s = e.status === 418 ? 419 : 418; e.status = s; e.statuses = e.statuses.map(() => s); b.portOwners[b.portOwners.length - 1].owners = ['1@2020-01-01T00:00:00.0000000+07:00']; fs.writeFileSync(process.argv[2], JSON.stringify(b, null, 2));"
  $null = Invoke-Node 'p11-tamper' @('-e', $tamperCode, $p11Base, $p11Tampered) 60
  $tamperedRun = Invoke-Node 'p11-i5-tampered' @($supervisorScript, 'i5-check', '--baseline', $p11Tampered, '--out', (Join-Path $workDir 'p11-i5-tampered.json'), '--g0-dir', $workDir, '--temp-pg-port', '55443', '--expect-endpoints', "$endpointCount") 600
  $tampered = Get-Content -LiteralPath (Join-Path $workDir 'p11-i5-tampered.json') -Raw | ConvertFrom-Json
  $missingRun = Invoke-Node 'p11-i5-missing' @($supervisorScript, 'i5-check', '--baseline', (Join-Path $workDir 'p11-no-such-baseline.json'), '--out', (Join-Path $workDir 'p11-i5-missing.json'), '--g0-dir', $workDir, '--temp-pg-port', '55443', '--expect-endpoints', "$endpointCount") 300
  $missing = Get-Content -LiteralPath (Join-Path $workDir 'p11-i5-missing.json') -Raw | ConvertFrom-Json
  $tamperMessages = @($tampered.problems | ForEach-Object { $_.message })
  $passed = ($baseRun.status -eq 'OK') -and ($p11Baseline.valid -eq $true) -and ($endpointCount -ge 1) -and
    ($unchangedRun.status -eq 'OK') -and ($unchanged.verdict -eq 'PASS') -and ($unchanged.checkedEndpoints -eq $endpointCount) -and
    ($tamperedRun.exit -eq 1) -and ($tampered.verdict -eq 'FAIL') -and (@($tamperMessages | Where-Object { $_ -match 'answered' }).Count -ge 1) -and (@($tamperMessages | Where-Object { $_ -match 'is served by' }).Count -ge 1) -and
    ($missingRun.exit -eq 1) -and ($missing.verdict -eq 'MISSING')
  Add-Outcome 'P11' 'runner-owned production I5 (read-only): unchanged host PASS on every endpoint; altered status / owner FAIL; missing baseline MISSING' $passed ([ordered]@{
      productionEndpoints = $endpointCount; baselineProblems = @($p11Baseline.problems); unchanged = "$($unchanged.verdict) ($($unchanged.checkedEndpoints) of $($unchanged.expectedEndpoints) checked)"
      unchangedProblems = @($unchanged.problems | ForEach-Object { $_.message }); tampered = $tampered.verdict; tamperedProblems = $tamperMessages; missing = $missing.verdict })
} catch { Add-Outcome 'P11' 'runner-owned production I5' $false $_.Exception.Message }

# P12 - G0 run 3 readiness: the isolation report runs read-only and never classifies production as a development
# agent. Its status (CLEAR / REVIEW / BLOCK) is reported for the owner, not required here: BLOCK only means an agent is
# running now. Nothing is stopped.
try {
  $isolationFile = Join-Path $workDir 'p12-isolation.json'
  $isolationRun = Invoke-Node 'p12-isolation' @($supervisorScript, 'isolation', '--out', $isolationFile, '--g0-dir', $workDir) 300
  $isolationReport = Get-Content -LiteralPath $isolationFile -Raw | ConvertFrom-Json
  $productionPids = @(@($pm2Daemons) + @($sharedPostmaster) | Where-Object { $_ } | ForEach-Object { [int]$_.ProcessId })
  $agentPids = @($isolationReport.agents | ForEach-Object { [int]$_.pid })
  $productionAsAgent = @($agentPids | Where-Object { $productionPids -contains $_ })
  $expectedExit = $(if ($isolationReport.status -eq 'BLOCK') { 1 } else { 0 })
  $passed = ($isolationRun.exit -eq $expectedExit) -and ($isolationReport.status -in @('CLEAR', 'REVIEW', 'BLOCK')) -and ($isolationReport.production.pm2Daemon) -and ($isolationReport.production.postmaster) -and ($productionAsAgent.Count -eq 0)
  Add-Outcome 'P12' 'isolation report (read-only): produced; production never classified as an agent (status for the owner)' $passed ([ordered]@{
      status = $isolationReport.status; agents = @($isolationReport.agents | ForEach-Object { "$($_.agent): $($_.pid) $($_.name)" }); blockingTasks = @($isolationReport.blockingTasks | ForEach-Object { $_.task })
      reviewItems = @($isolationReport.review).Count; reviewTasks = @($isolationReport.reviewTasks | ForEach-Object { "$($_.task) next $($_.nextRun)" }); productionAsAgent = $productionAsAgent })
} catch { Add-Outcome 'P12' 'isolation report' $false $_.Exception.Message }

# P9 - G0 run 2: a step that ends by itself in the same instant an abort condition appears is reported as having
# ended by itself (exit code kept), and G0 does not try to stop it.
try {
  $abortCalls = @()
  $ended = Invoke-G0Bounded -Name 'p9-ends-during-abort' -FilePath (Join-Path $env:SystemRoot 'System32\PING.EXE') -ArgumentValues @('-n', '2', '127.0.0.1') -WorkingDirectory $workDir -LogDir $workDir -TimeoutSec 60 -AbortCheck { Start-Sleep -Milliseconds 2500; 'p9 abort condition' } -OnAbort { param($ChildPid, $ChildCreated, $Why) $script:abortCalls += $ChildPid }
  $passed = ($ended.status -eq 'STOPPED') -and ($ended.childEndedFirst -eq $true) -and ($ended.exit -eq 0) -and ($abortCalls.Count -eq 0) -and ("$($ended.reason)" -match 'already ended by itself')
  Add-Outcome 'P9' 'a step that ended by itself during an abort is recorded as such (not as stopped by G0); nothing is stopped' $passed ([ordered]@{ status = $ended.status; childEndedFirst = $ended.childEndedFirst; exit = $ended.exitText; reason = $ended.reason; onAbortCalls = $abortCalls.Count })
} catch { Add-Outcome 'P9' 'step ended during abort' $false $_.Exception.Message }

# P10 - G0 run 2 exit-code evidence on THIS host: a Node process with the monitor's exit diagnostics, terminated by
# another process (.NET Process.Kill = Stop-Process), ends with 0xFFFFFFFF and leaves NO exit line; a normal exit
# writes "exit code 0". Only the test's own processes, by their own PIDs.
try {
  $supervisorUrl = ([Uri]$supervisorScript).AbsoluteUri
  $diagCode = "import('" + $supervisorUrl + "').then((m) => { m.installMonitorExitDiagnostics(process.argv[1]); if (process.argv[2] === 'normal') setTimeout(() => process.exit(0), 300); else setInterval(() => {}, 1000); });"
  $killedDir = Join-Path $workDir 'p10-killed'; $normalDir = Join-Path $workDir 'p10-normal'
  New-Item -ItemType Directory -Force -Path $killedDir, $normalDir | Out-Null
  $killedProc = Start-Process -FilePath $nodePath -ArgumentList (ConvertTo-G0ArgLine @('-e', $diagCode, $killedDir, 'wait')) -WindowStyle Hidden -PassThru
  $null = $killedProc.Handle
  Start-Sleep -Seconds 3
  $killedProc.Kill()   # through the handle this test holds: TerminateProcess(-1), the same call as Stop-Process; no PID lookup
  $null = $killedProc.WaitForExit(10000)
  $normalProc = Start-Process -FilePath $nodePath -ArgumentList (ConvertTo-G0ArgLine @('-e', $diagCode, $normalDir, 'normal')) -WindowStyle Hidden -PassThru
  $null = $normalProc.Handle
  $null = $normalProc.WaitForExit(20000)
  $killedLog = Join-Path $killedDir 'monitor.log'; $normalLog = Join-Path $normalDir 'monitor.log'
  $killedHasExitLine = (Test-Path -LiteralPath $killedLog) -and (@(Select-String -LiteralPath $killedLog -Pattern 'exit code').Count -gt 0)
  $normalHasExitLine = (Test-Path -LiteralPath $normalLog) -and (@(Select-String -LiteralPath $normalLog -Pattern 'exit code 0').Count -gt 0)
  $passed = ($killedProc.ExitCode -eq -1) -and (-not $killedHasExitLine) -and ($normalProc.ExitCode -eq 0) -and $normalHasExitLine
  Add-Outcome 'P10' 'exit-code evidence: Process.Kill / Stop-Process gives 0xFFFFFFFF and no exit line; a normal exit is logged' $passed ([ordered]@{ killedExit = (Format-G0ExitCode $killedProc.ExitCode); killedHasExitLine = $killedHasExitLine; normalExit = (Format-G0ExitCode $normalProc.ExitCode); normalHasExitLine = $normalHasExitLine })
} catch { Add-Outcome 'P10' 'exit-code evidence' $false $_.Exception.Message }

# P8 - no process leak: nothing this harness started is still running (its own children, anything naming its work
# folder, any ping.exe to 127.0.0.1 started since the harness began). Waits up to 20 s for P3's short ping to end.
try {
  $leaks = @()
  for ($waitRound = 0; $waitRound -lt 20; $waitRound++) {
    $leaks = @(Get-CimInstance Win32_Process | Where-Object {
        $_.ProcessId -ne $PID -and $_.CreationDate -and $_.CreationDate -ge [datetime]$testStart -and $_.Name -ne 'conhost.exe' -and
        ($_.ParentProcessId -eq $PID -or "$($_.CommandLine)" -like "*$workDir*" -or ($_.Name -eq 'PING.EXE' -and "$($_.CommandLine)" -match '127\.0\.0\.1'))
      } | ForEach-Object { "$($_.ProcessId) $($_.Name) $($_.CommandLine)" })
    if (-not $leaks.Count) { break }
    Start-Sleep -Seconds 1
  }
  Add-Outcome 'P8' 'no process leak after the harness (its children, work-folder processes, its ping.exe)' ($leaks.Count -eq 0) ([ordered]@{ leftRunning = $leaks })
} catch { Add-Outcome 'P8' 'no process leak' $false $_.Exception.Message }

$allPassed = @($outcomes | Where-Object { -not $_.pass }).Count -eq 0
[ordered]@{ tool = 'EP48.5 Test-G0Harness (PowerShell 5.1)'; at = (Get-Date).ToString('o'); gate = $(if ($allPassed) { 'CLEAR' } else { 'BLOCK' }); psVersion = "$($PSVersionTable.PSVersion)"; node = (& $nodePath -v); result = $(if ($allPassed) { 'PASS' } else { 'FAIL' }); tests = $outcomes } |
  ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportDir 'harness-test.json') -Encoding UTF8
Copy-Item -Path (Join-Path $workDir '*') -Destination $reportDir -Recurse -Force -ErrorAction SilentlyContinue   # copy, never move
Write-Host ''
Write-Host ("HARNESS TESTS: {0} - report {1}" -f $(if ($allPassed) { 'PASS' } else { 'FAIL (BLOCK)' }), $reportDir)
if ($allPassed) { exit 0 } else { exit 1 }
