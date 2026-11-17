# PDA BLISS CORE - EP48.5 A-1 / G0 runner (isolated quality validation on S2A-SERVER).    Run-G0 v3.2
#
# v3 = G0 incident amendment 2026-11-17 (docs/EP48_5_G0_INCIDENT_20261117.md). Incident g0-20261117-134458:
#   * the PowerShell monitor's loop variable `$port` overwrote its `[int]$Port` parameter (PowerShell names are
#     case-insensitive) -> empty expected values -> false STOP at 13:49:09;
#   * this runner blocked in `& pg_ctl.exe start *> log` (the postmaster inherited the output pipe), so it never
#     checked STOP; the monitor job waited for MONITOR-END that never came.
# Now: every external program runs through Invoke-G0Bounded (files, not pipes; polled STOP / monitor health /
# deadline); the monitor is g0-supervisor.mjs (typed, unit-tested); shutdown is bounded and identity-checked.
#
# v3.2 = G0 run 3 readiness (docs/EP48_5_G0_RUN3_READINESS.md): production HTTP preservation is checked by THIS runner
#   at shutdown in every outcome (g0-supervisor.mjs i5-check: every baseline endpoint re-probed on loopback, status AND
#   owning process identity compared) - it no longer depends on the monitor surviving; only an explicit PASS passes.
#   A read-only isolation check refuses to start while a development agent runs (the owner pauses agents; nothing is
#   stopped by G0); -ExpectHttpEndpoints and -AgentIsolationConfirmed are required.
#
# Owner authorization required before EVERY run. -Release, -ExpectOps, -ExpectHttpEndpoints and -AgentIsolationConfirmed are REQUIRED.
#   * Preflight-G0.ps1 runs first; a BLOCK stops G0 before anything is created.
#   * Everything happens in a NEW folder D:\pdabliss-core-staging\gates\g0-<timestamp> (never reused, never deleted).
#   * One TEMPORARY PostgreSQL (plain process, not a service): 127.0.0.1:55443, SCRAM, random password in memory only.
#   * The shared PostgreSQL, PM2, MariaDB, Cloudflare, the firewall, scheduled tasks and production apps are never
#     changed. No service, task or permanent database is created. Nothing is pushed, deployed or deleted.
#   * The monitor (g0-supervisor.mjs monitor) refuses to start on an invalid baseline and STOPs G0 on: a production
#     PM2 / PostgreSQL / MariaDB / cloudflared change, a production HTTP status change, a latency regression
#     (2 consecutive rounds above max(1.5 x median, median + 50 ms)), CPU > 80 % for 3 rounds, free RAM < 8 GB,
#     D: < 10 GB, the temporary port bound to anything but 127.0.0.1 or held by a non-G0 process, a G0 process on
#     the shared PostgreSQL port, or a G0 process listening on a non-loopback address. Each condition is logged once.
#   * EVERY project step runs through ops\ep48_5\g0-guard.mjs (explicit database target, instance identity,
#     loopback-only listener guard, exact counts, 0 skipped). Test concurrency 2; G0 processes at BelowNormal priority.
#   * On STOP / failure / timeout / monitor loss: the running step's OWN process tree is stopped (re-verified PIDs,
#     production protected); the temporary PostgreSQL is stopped with pg_ctl stop after its identity is verified
#     (never killed); the monitor gets MONITOR-END (verified stop only if it does not end in 90 s); logs are kept.
#
# Run in an ELEVATED Windows PowerShell (the production PM2 tree runs as SYSTEM):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\g0-harness\Run-G0.ps1 -Release <approved sha> -ExpectOps <n> -ExpectHttpEndpoints <n> -AgentIsolationConfirmed
#
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Release,
  [string]$Baseline = 'cb21be102a03495c1b6659d99fa8d49eef8eaa4e',
  [string]$Dev = 'D:\S2A_PROJECT\pdabliss_core',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$GatesRoot = 'D:\pdabliss-core-staging\gates',
  [int]$ExpectBackend = 611,
  [int]$ExpectFrontend = 1192,
  [int]$ExpectOps = 0,
  [int]$ExpectHttpEndpoints = 0,
  [switch]$AgentIsolationConfirmed
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Off
$TempPgPort = 55443
$RunStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$G0Dir = Join-Path $GatesRoot "g0-$RunStamp"
$StagingRoot = Join-Path $G0Dir 'root'                          # test-only staging root for the launcher smoke
$Checkout = Join-Path $StagingRoot "releases\$Release"          # the G0 checkout of the release commit
$PgDataDir = Join-Path $G0Dir 'pg'
$OutDir = Join-Path $G0Dir 'g0'
$StopFile = Join-Path $OutDir 'STOP'
$MonitorEndFile = Join-Path $OutDir 'MONITOR-END'
$HarnessDir = $PSScriptRoot
$Supervisor = Join-Path (Split-Path $HarnessDir -Parent) 'g0-supervisor.mjs'
. (Join-Path $HarnessDir 'g0-common.ps1')
$script:NodeExe = $null
$script:GitExe = $null
$script:PowerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$script:RunnerCreated = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").CreationDate.ToString('o')
$script:PhaseRecords = @()
$script:PhaseCounter = 0
$script:PgStarted = $false
$script:MonitorProc = $null
$script:MonitorCreated = $null
$script:Finishing = $false
$script:LastPhase = $null
$script:LastWorkPhase = $null
$script:Summary = [ordered]@{ runner = 'EP48.5 Run-G0 v3.2 (run-3 readiness)'; release = $Release; baseline = $Baseline; folder = $G0Dir; startedAt = (Get-Date).ToString('o'); result = 'RUNNING'; stopReason = $null; phases = @() }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Start-Transcript -Path (Join-Path $OutDir 'transcript.txt') | Out-Null
function Write-G0Log([string]$Message) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Message; Write-Host $line; Add-Content -LiteralPath (Join-Path $OutDir 'runner.log') -Value $line }

function Test-MonitorHealth {
  if (-not $script:MonitorProc -or $script:Finishing) { return $null }
  if ($script:MonitorProc.HasExited) { return "the G0 monitor process ended unexpectedly (exit $(Format-G0ExitCode $script:MonitorProc.ExitCode); see monitor.log - no 'exit code' line there means another process terminated it)" }
  return $null
}

function Stop-OwnTree([int]$RootPid, [string]$RootCreated, [string]$Why) {
  # Stops ONE of G0's own process trees through the supervisor: every PID re-verified (start time), protected
  # production processes and anything older than this runner are refused, PostgreSQL is never killed.
  $script:PhaseCounter++
  $label = '{0:D2}-stop-tree-{1}' -f $script:PhaseCounter, $RootPid
  $stopResult = Invoke-G0Bounded -Name $label -FilePath $script:NodeExe -ArgumentValues @($Supervisor, 'stop-tree', '--root', "$RootPid", '--root-created', $RootCreated, '--not-before', $script:RunnerCreated, '--g0-dir', $G0Dir, '--out', $OutDir, '--reason', $Why) -WorkingDirectory $G0Dir -LogDir $OutDir -TimeoutSec 120
  Write-G0Log "stop-tree $RootPid ($Why) -> $($stopResult.status) (exit $($stopResult.exit))"
}

function Invoke-G0Phase {
  param([string]$Name, [string]$FilePath, [string[]]$ArgumentValues, [string]$WorkingDirectory, [int]$TimeoutMin = 45, [string]$Note = '', [switch]$Final)
  if (-not $Final) {
    if (Test-Path -LiteralPath $StopFile) { Stop-G0 ("STOP before $Name" + ': ' + "$(Get-Content -LiteralPath $StopFile -Raw)".Trim()) }
    $unhealthy = Test-MonitorHealth
    if ($unhealthy) { Stop-G0 $unhealthy }
  }
  $script:PhaseCounter++
  $label = '{0:D2}-{1}' -f $script:PhaseCounter, $Name
  Write-G0Log "phase $label ..."
  $stopPath = ''; $abortBlock = $null
  if (-not $Final) { $stopPath = $StopFile; $abortBlock = { Test-MonitorHealth } }
  $phaseResult = Invoke-G0Bounded -Name $label -FilePath $FilePath -ArgumentValues $ArgumentValues -WorkingDirectory $WorkingDirectory -LogDir $OutDir -TimeoutSec ($TimeoutMin * 60) -StopFile $stopPath -AbortCheck $abortBlock -OnAbort { param($ChildPid, $ChildCreated, $Why) Stop-OwnTree $ChildPid $ChildCreated $Why }
  $script:PhaseRecords += [ordered]@{ no = $script:PhaseCounter; name = $Name; status = $phaseResult.status; exit = $phaseResult.exit; exitText = $phaseResult.exitText; childEndedFirst = $phaseResult.childEndedFirst; seconds = $phaseResult.seconds; note = $Note; reason = $phaseResult.reason }
  $script:LastPhase = $phaseResult
  if (-not $Final) { $script:LastWorkPhase = $phaseResult }   # census reports the last WORK step, never a shutdown phase
  Write-G0Log "phase $label -> $($phaseResult.status) (exit $($phaseResult.exitText), $($phaseResult.seconds)s) $($phaseResult.reason)"
  if (-not $Final -and $phaseResult.status -ne 'OK') { Stop-G0 "$Name $($phaseResult.status): $($phaseResult.reason) - see $OutDir\$label.*.txt" }
  return $phaseResult
}

# Project steps: always through the guard (explicit database target, identity checks, loopback-only listeners).
function Step([string]$Name, [string[]]$GuardArgs, [string]$WorkingDirectory, [int]$TimeoutMin = 45, [string]$Note = '') {
  Invoke-G0Phase -Name $Name -FilePath $script:NodeExe -ArgumentValues (@($Guard) + $GuardArgs) -WorkingDirectory $WorkingDirectory -TimeoutMin $TimeoutMin -Note $Note | Out-Null
}

function Write-G0Report {
  $script:Summary.finishedAt = (Get-Date).ToString('o')
  $script:Summary.phases = $script:PhaseRecords
  $script:Summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutDir 'G0-SUMMARY.json') -Encoding UTF8
  $lines = @("EP48.5 G0 - $($script:Summary.result)", "release $Release | folder $G0Dir", "started $($script:Summary.startedAt) | finished $($script:Summary.finishedAt)")
  if ($script:Summary.stopReason) { $lines += "STOP REASON: $($script:Summary.stopReason)" }
  if ($script:Summary.monitorExit) { $lines += "MONITOR EXIT: $($script:Summary.monitorExit)" }
  if ($script:Summary.monitorFinal) { $lines += "MONITOR FINAL I5: $($script:Summary.monitorFinal)" }
  if ($script:Summary.monitorEnd) { $lines += "MONITOR END: $($script:Summary.monitorEnd)" }
  if ($script:Summary.stopRaisedBy) { $lines += "STOP RAISED BY: $($script:Summary.stopRaisedBy)" }
  if ($script:Summary.httpPreservation) { $lines += "PRODUCTION HTTP PRESERVATION: $($script:Summary.httpPreservation)" }
  if ($script:Summary.collectorAfter) { $lines += "COLLECTOR AFTER: $($script:Summary.collectorAfter)" }
  if ($script:Summary.isolation) { $lines += "ISOLATION AT START: $($script:Summary.isolation)" }
  foreach ($rec in $script:PhaseRecords) { $lines += ("{0,-3} {1,-34} {2,-8} {3,7}s  exit {4}  {5} {6}" -f $rec.no, $rec.name, $rec.status, $rec.seconds, $rec.exitText, $rec.note, $rec.reason) }
  $lines | Set-Content -LiteralPath (Join-Path $OutDir 'G0-SUMMARY.txt') -Encoding UTF8
  try {
    $dest = Join-Path $Dev "ops-logs\ep48_5-g0\g0-$RunStamp"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Path (Join-Path $OutDir '*') -Destination $dest -Recurse -Force   # copy, never move
  } catch { Write-G0Log "WARNING: could not copy logs to ops-logs: $($_.Exception.Message)" }
}

function Complete-G0 {
  if ($script:Finishing) { return }
  $script:Finishing = $true
  try {
  if (Test-Path Env:TEST_DATABASE_URL) { Remove-Item Env:TEST_DATABASE_URL }
  # 1. temporary PostgreSQL: identity verified -> graceful pg_ctl stop -> verified stopped. Never killed.
  if ($script:PgStarted) {
    $identity = Invoke-G0Phase -Name 'temp-pg-identity-before-stop' -FilePath $script:NodeExe -ArgumentValues @($Supervisor, 'temp-pg-identity', '--pg-data', $PgDataDir, '--g0-dir', $G0Dir, '--temp-pg-port', "$TempPgPort", '--out', $OutDir, '--expect', 'running') -WorkingDirectory $G0Dir -TimeoutMin 2 -Final
    if ($identity.status -eq 'OK') {
      Invoke-G0Phase -Name 'temp-pg-stop' -FilePath (Join-Path $PgBin 'pg_ctl.exe') -ArgumentValues @('-D', $PgDataDir, 'stop', '-m', 'fast', '-w', '-t', '90') -WorkingDirectory $G0Dir -TimeoutMin 3 -Final | Out-Null
    } else { Write-G0Log 'temporary PostgreSQL identity not confirmed (see the identity log): pg_ctl stop NOT issued' }
    $stoppedCheck = Invoke-G0Phase -Name 'temp-pg-stopped-check' -FilePath $script:NodeExe -ArgumentValues @($Supervisor, 'temp-pg-identity', '--pg-data', $PgDataDir, '--g0-dir', $G0Dir, '--temp-pg-port', "$TempPgPort", '--out', $OutDir, '--expect', 'stopped') -WorkingDirectory $G0Dir -TimeoutMin 2 -Final
    $script:Summary.temporaryPostgresStopped = ($stoppedCheck.status -eq 'OK')
    if ($stoppedCheck.status -ne 'OK') {
      $script:Summary.result = 'STOPPED'
      if (-not $script:Summary.stopReason) { $script:Summary.stopReason = 'temporary PostgreSQL is still running - left for an owner decision (never killed)' }
    }
    $script:PgStarted = $false
  }
  # 2. monitor: end signal, bounded wait, verified stop only as a last resort
  if ($script:MonitorProc) {
    if (-not (Test-Path -LiteralPath $MonitorEndFile)) { New-Item -ItemType File -Path $MonitorEndFile | Out-Null }
    if (-not $script:MonitorProc.WaitForExit(90000)) {
      Stop-OwnTree $script:MonitorProc.Id $script:MonitorCreated 'monitor did not end within 90 s of MONITOR-END'
      $null = $script:MonitorProc.WaitForExit(15000)
    }
    $finalFile = Join-Path $OutDir 'monitor-final.json'
    if ($script:MonitorProc.HasExited) { $script:Summary.monitorExit = (Format-G0ExitCode $script:MonitorProc.ExitCode) }
    if (Test-Path -LiteralPath $finalFile) {
      $monitorFinal = Get-Content -LiteralPath $finalFile -Raw | ConvertFrom-Json
      $script:Summary.monitorFinal = 'present'
      $script:Summary.monitor = $monitorFinal
      if ($script:Summary.result -eq 'RUNNING' -and $monitorFinal.i5ok -ne $true) { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = "I5 after-baseline: $(@($monitorFinal.i5diffs) -join '; ')" }
    } else {
      # Recorded even when G0 already stopped for another reason: the I5 comparison by the monitor did not happen.
      $script:Summary.monitorFinal = 'MISSING - the monitor ended without its final I5 comparison; compare the collector before / after host audits'
      if ($script:Summary.result -eq 'RUNNING') { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = 'monitor did not write a final I5 comparison' }
    }
  }
  if ((Test-Path -LiteralPath $StopFile) -and $script:Summary.result -eq 'RUNNING') { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = "$(Get-Content -LiteralPath $StopFile -Raw)".Trim() }
  # 3. how G0 ended: which G0 processes are alive, how the monitor ended, who raised STOP (read-only)
  Save-G0Census 'census-at-end'
  $censusEndFile = Join-Path $OutDir 'census-at-end.json'
  if (Test-Path -LiteralPath $censusEndFile) {
    $censusEnd = Get-Content -LiteralPath $censusEndFile -Raw | ConvertFrom-Json
    if ($censusEnd.monitorEnd) { $script:Summary.monitorEnd = "$($censusEnd.monitorEnd.kind): $($censusEnd.monitorEnd.detail)" }
    if ($censusEnd.stop) { $script:Summary.stopRaisedBy = "$($censusEnd.stop.raisedBy)" }
    $script:Summary.g0ProcessesAliveAtEnd = @($censusEnd.g0ProcessesAlive).Count
  }
  # 4. production preservation (I5), owned by THIS runner: runs in every outcome, also when the monitor ended
  #    unexpectedly. Every baseline endpoint is re-probed (loopback, GET /) and its status AND owning process identity
  #    compared, with the PM2 tree, PostgreSQL, MariaDB, cloudflared and the production listeners. Only PASS passes.
  $script:Summary.httpPreservation = 'MISSING - the runner-owned I5 check did not run'
  $i5File = Join-Path $OutDir 'i5-after.json'
  if ($script:NodeExe) {
    Invoke-G0Phase -Name 'production-i5-check' -FilePath $script:NodeExe -ArgumentValues @($Supervisor, 'i5-check', '--baseline', (Join-Path $OutDir 'baseline.json'), '--out', $i5File, '--g0-dir', $G0Dir, '--temp-pg-port', "$TempPgPort", '--expect-endpoints', "$ExpectHttpEndpoints") -WorkingDirectory $G0Dir -TimeoutMin 10 -Final | Out-Null
  }
  if (Test-Path -LiteralPath $i5File) {
    $i5After = Get-Content -LiteralPath $i5File -Raw | ConvertFrom-Json
    $script:Summary.httpPreservation = "$($i5After.verdict) - $($i5After.checkedEndpoints) of $($i5After.expectedEndpoints) production endpoints checked (status and owning process identity)"
    $script:Summary.i5 = $i5After
  }
  # 5. host collector "after" (read-only, bounded). It does not probe HTTP: its success is NOT HTTP-preservation evidence.
  $collectorAfter = Invoke-G0Phase -Name 'collector-after' -FilePath $script:PowerShellExe -ArgumentValues @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $Dev 'ops\ep48_5\Collect-HostAudit.ps1'), '-NoHttpProbe') -WorkingDirectory $G0Dir -TimeoutMin 15 -Final
  $script:Summary.collectorAfter = "$($collectorAfter.status) - process / listener audit only (-NoHttpProbe); not HTTP-preservation evidence"
  # 6. gates: PASS needs every phase OK AND the monitor's final I5 AND the runner-owned HTTP preservation PASS
  if ($script:Summary.result -eq 'RUNNING' -and $script:Summary.monitorFinal -ne 'present') { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = "the monitor's final I5 comparison is missing" }
  if ($script:Summary.result -eq 'RUNNING' -and "$($script:Summary.httpPreservation)" -notmatch '^PASS - ') { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = "production HTTP preservation not proven: $($script:Summary.httpPreservation)" }
  if ($script:Summary.result -eq 'RUNNING') { $script:Summary.result = 'PASS' }
  } catch {
    Write-G0Log "shutdown error: $($_.Exception.Message)"
    $script:Summary.result = 'STOPPED'
    if (-not $script:Summary.stopReason) { $script:Summary.stopReason = "shutdown error: $($_.Exception.Message)" }
  } finally {
    Write-G0Report
    try { Stop-Transcript | Out-Null } catch { }
  }
}

function Save-G0Census([string]$CensusName) {
  # G0 run 2: record, at the moment G0 stops, which G0 processes are still alive and what the exit codes mean.
  if (-not $script:NodeExe) { return }
  $exitArgs = @()
  if ($script:MonitorProc -and $script:MonitorProc.HasExited) { $exitArgs += @('--exit', "monitor=$($script:MonitorProc.ExitCode)") }
  if ($script:LastWorkPhase -and $null -ne $script:LastWorkPhase.exit) { $exitArgs += @('--exit', "$($script:LastWorkPhase.name)=$($script:LastWorkPhase.exit)") }
  $exitArgs += @('--monitor-log', (Join-Path $OutDir 'monitor.log'), '--stop-file', $StopFile)
  try {
    Invoke-G0Phase -Name $CensusName -FilePath $script:NodeExe -ArgumentValues (@($Supervisor, 'census', '--out', (Join-Path $OutDir "$CensusName.json"), '--g0-dir', $G0Dir, '--runner-pid', "$PID", '--runner-created', $script:RunnerCreated) + $exitArgs) -WorkingDirectory $G0Dir -TimeoutMin 2 -Final | Out-Null
  } catch { Write-G0Log "census failed: $($_.Exception.Message)" }
}

function Stop-G0([string]$Reason) {
  if ($script:Finishing) { Write-G0Log "(during shutdown) $Reason"; return }
  Write-G0Log "STOP: $Reason"
  $script:Summary.result = 'STOPPED'
  if (-not $script:Summary.stopReason) { $script:Summary.stopReason = $Reason }
  if (-not (Test-Path -LiteralPath $StopFile)) { Set-Content -LiteralPath $StopFile -Value "runner: $Reason" -Encoding UTF8 }
  Save-G0Census 'census-at-stop'
  Complete-G0
  exit 1
}

try {
  # ------------------------------------------------------------------ 0. preconditions + preflight (read-only)
  Write-G0Log "EP48.5 G0 runner v3.2 - folder $G0Dir"
  if ($ExpectOps -le 0) { throw '-ExpectOps <exact ops test count from the approved amendment report> is required' }
  if ($ExpectHttpEndpoints -le 0) { throw '-ExpectHttpEndpoints <number of production HTTP endpoints from the owner-reviewed baseline> is required' }
  if (-not $AgentIsolationConfirmed) { throw '-AgentIsolationConfirmed is required: complete the owner checklist in docs/EP48_5_G0_RUN3_READINESS.md first (development agents paused by the owner)' }
  (Get-Process -Id $PID).PriorityClass = 'BelowNormal'   # children inherit BelowNormal
  $identityNow = [Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not (New-Object Security.Principal.WindowsPrincipal($identityNow)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'run this in an ELEVATED PowerShell (the production PM2 tree runs as SYSTEM)' }
  if ($env:COMPUTERNAME -ne 'S2A-SERVER') { throw "this is $env:COMPUTERNAME, not S2A-SERVER" }
  $script:NodeExe = (Get-Command node.exe).Source
  $script:GitExe = (Get-Command git.exe).Source
  $nodeVersion = (& $script:NodeExe -v)
  if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) { throw "Node 24+ required, found $nodeVersion" }
  $script:Summary.node = $nodeVersion
  # Neutralise inherited settings in THIS process (children inherit this process's block, not the registry).
  $hazards = @(Get-ChildItem Env: | Where-Object { $_.Name.ToUpper() -match '^(PG[A-Z0-9_]+|DATABASE_URL|TEST_DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|NODE_OPTIONS|CORE_G0[A-Z0-9_]*)$' } | ForEach-Object { $_.Name })
  foreach ($hazardName in $hazards) { Remove-Item "Env:$hazardName" }
  $script:Summary.neutralisedVariables = $hazards
  Invoke-G0Phase -Name 'preflight' -FilePath $script:PowerShellExe -ArgumentValues @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $HarnessDir 'Preflight-G0.ps1'), '-Release', $Release, '-Baseline', $Baseline, '-Dev', $Dev, '-PgBin', $PgBin, '-GatesRoot', $GatesRoot, '-TempPgPort', "$TempPgPort", '-ReportDir', (Join-Path $OutDir 'preflight'), '-FromRunner') -WorkingDirectory $Dev -TimeoutMin 15 -Note 'read-only W1-W9' | Out-Null
  # Read-only: refuses to start while a development agent runs (production is identified first and never classified).
  Invoke-G0Phase -Name 'isolation-check' -FilePath $script:NodeExe -ArgumentValues @($Supervisor, 'isolation', '--out', (Join-Path $OutDir 'isolation-at-start.json'), '--g0-dir', $G0Dir) -WorkingDirectory $Dev -TimeoutMin 5 -Note 'read-only; BLOCK = a development agent runs' | Out-Null
  $isolationStart = Get-Content -LiteralPath (Join-Path $OutDir 'isolation-at-start.json') -Raw | ConvertFrom-Json
  $script:Summary.isolation = "$($isolationStart.status) - agents $(@($isolationStart.agents).Count), owner review items $(@($isolationStart.review).Count + @($isolationStart.reviewTasks).Count)"
  $commitType = (& $script:GitExe -C $Dev cat-file -t $Release)
  if ($commitType -ne 'commit') { throw "release commit $Release not found in $Dev" }
  & $script:GitExe -C $Dev diff --quiet $Baseline $Release -- backend frontend
  if ($LASTEXITCODE -ne 0) { throw 'backend/ or frontend/ differ between cb21be1 and the release commit' }
  $changedFiles = @(& $script:GitExe -C $Dev diff --name-only $Baseline $Release)
  $outsideScope = @($changedFiles | Where-Object { $_ -notmatch '^(docs/EP48_5_|ops/ep48_5/|ops/test/(staging-launch|g0-))' })
  if ($outsideScope.Count) { throw "release commit changes files outside the EP48.5 scope: $($outsideScope -join ', ')" }
  $script:Summary.commitCheck = "commit ok; backend/ and frontend/ identical to $Baseline; $($changedFiles.Count) files changed, all within the EP48.5 scope"
  Write-G0Log $script:Summary.commitCheck

  # ------------------------------------------------------------------ 1. "before" record + monitor with a VALID baseline
  Invoke-G0Phase -Name 'collector-before' -FilePath $script:PowerShellExe -ArgumentValues @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $Dev 'ops\ep48_5\Collect-HostAudit.ps1'), '-NoHttpProbe') -WorkingDirectory $G0Dir -TimeoutMin 15 -Note 'no PostgreSQL connection' | Out-Null
  $monitorArgLine = ConvertTo-G0ArgLine @($Supervisor, 'monitor', '--out', $OutDir, '--g0-dir', $G0Dir, '--runner-pid', "$PID", '--runner-created', $script:RunnerCreated, '--temp-pg-port', "$TempPgPort")
  $script:MonitorProc = Start-Process -FilePath $script:NodeExe -ArgumentList $monitorArgLine -WorkingDirectory $G0Dir -NoNewWindow -PassThru -RedirectStandardOutput (Join-Path $OutDir 'monitor.out.txt') -RedirectStandardError (Join-Path $OutDir 'monitor.err.txt')
  $null = $script:MonitorProc.Handle
  $script:MonitorCreated = (Get-CimInstance Win32_Process -Filter "ProcessId=$($script:MonitorProc.Id)").CreationDate.ToString('o')
  $baselineFile = Join-Path $OutDir 'baseline.json'
  $waitedSec = 0
  while (-not (Test-Path -LiteralPath $baselineFile)) {
    Start-Sleep -Seconds 1
    $waitedSec++
    if ($script:MonitorProc.HasExited) { Stop-G0 "monitor ended before writing its baseline (exit $($script:MonitorProc.ExitCode)) - see monitor.err.txt" }
    if ($waitedSec -gt 240) { Stop-G0 'monitor did not write a baseline within 240 s' }
  }
  $monitorBaseline = Get-Content -LiteralPath $baselineFile -Raw | ConvertFrom-Json
  if ($monitorBaseline.valid -ne $true) { Stop-G0 ('monitor baseline invalid: ' + (@($monitorBaseline.problems) -join '; ')) }
  if (@($monitorBaseline.http).Count -ne $ExpectHttpEndpoints) { Stop-G0 "monitor baseline has $(@($monitorBaseline.http).Count) production HTTP endpoints, $ExpectHttpEndpoints expected - every endpoint must be in the baseline" }
  Write-G0Log "monitor running (PID $($script:MonitorProc.Id)); baseline valid: $(@($monitorBaseline.http).Count) production ports, PM2 tree, PostgreSQL / MariaDB / cloudflared"

  # ------------------------------------------------------------------ 2. checkout of the exact release commit
  New-Item -ItemType Directory -Force -Path (Split-Path $Checkout) | Out-Null
  Invoke-G0Phase -Name 'git-clone' -FilePath $script:GitExe -ArgumentValues @('clone', '--no-local', '--quiet', $Dev, $Checkout) -WorkingDirectory $G0Dir -TimeoutMin 30 | Out-Null
  Invoke-G0Phase -Name 'git-checkout' -FilePath $script:GitExe -ArgumentValues @('-C', $Checkout, 'checkout', '--quiet', '--detach', $Release) -WorkingDirectory $G0Dir -TimeoutMin 5 | Out-Null
  $checkoutHead = (& $script:GitExe -C $Checkout rev-parse HEAD)
  if ($checkoutHead -ne $Release) { throw "checkout HEAD $checkoutHead is not $Release" }
  if (@(& $script:GitExe -C $Checkout status --porcelain).Count) { throw 'checkout is not clean' }
  $Guard = Join-Path $Checkout 'ops\ep48_5\g0-guard.mjs'
  $CheckoutHarness = Join-Path $Checkout 'ops\ep48_5\g0-harness'   # harness .mjs files: from the reviewed commit
  Write-G0Log "checkout $Checkout at $checkoutHead (clean)"

  # ------------------------------------------------------------------ 3. temporary PostgreSQL: SCRAM, 127.0.0.1:55443, not a service
  $randomBytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
  $gatePw = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $pwFile = Join-Path $G0Dir 'initdb.pw'
  [IO.File]::WriteAllText($pwFile, $gatePw)
  $initdbResult = Invoke-G0Phase -Name 'initdb' -FilePath (Join-Path $PgBin 'initdb.exe') -ArgumentValues @('-D', $PgDataDir, '-U', 'gate', "--pwfile=$pwFile", '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=English_United States.1252') -WorkingDirectory $G0Dir -TimeoutMin 10 -Final
  [IO.File]::WriteAllText($pwFile, '')   # emptied, not deleted (nothing is deleted in G0)
  if ($initdbResult.status -ne 'OK') { Stop-G0 "initdb $($initdbResult.status)" }
  $hbaLines = Get-Content -LiteralPath (Join-Path $PgDataDir 'pg_hba.conf') | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' }
  if (@($hbaLines | Where-Object { $_ -match '\b(trust|md5|password|peer|ident)\b' }).Count) { throw 'pg_hba.conf of the temporary instance contains a non-SCRAM method' }
  # Instance identity: the system identifier is unique per initdb; the guard compares it before every connection.
  $controlResult = Invoke-G0Phase -Name 'pg-controldata' -FilePath (Join-Path $PgBin 'pg_controldata.exe') -ArgumentValues @('-D', $PgDataDir) -WorkingDirectory $G0Dir -TimeoutMin 2
  $sysidLine = @(Get-Content -LiteralPath $controlResult.stdout) | Where-Object { $_ -match 'system identifier:\s+(\d{10,20})\s*$' } | Select-Object -First 1
  if (-not $sysidLine -or $sysidLine -notmatch '(\d{10,20})\s*$') { throw 'pg_controldata did not report the system identifier' }
  $env:CORE_G0_PG_SYSID = $Matches[1]
  $script:Summary.temporaryInstanceSystemId = $Matches[1]
  $script:PgStarted = $true   # from here on the shutdown always attempts a verified pg_ctl stop
  # pg_ctl start through Invoke-G0Bounded: output goes to FILES, so the postmaster cannot hold the runner (incident cause 2).
  Invoke-G0Phase -Name 'temp-pg-start' -FilePath (Join-Path $PgBin 'pg_ctl.exe') -ArgumentValues @('-D', $PgDataDir, '-o', "-p $TempPgPort -c listen_addresses=127.0.0.1", '-l', (Join-Path $G0Dir 'pg.log'), '-w', '-t', '120', 'start') -WorkingDirectory $G0Dir -TimeoutMin 3 | Out-Null
  Invoke-G0Phase -Name 'temp-pg-identity' -FilePath $script:NodeExe -ArgumentValues @($Supervisor, 'temp-pg-identity', '--pg-data', $PgDataDir, '--g0-dir', $G0Dir, '--temp-pg-port', "$TempPgPort", '--out', $OutDir, '--expect', 'running') -WorkingDirectory $G0Dir -TimeoutMin 2 -Note 'postmaster PID, data folder, -p 55443, 127.0.0.1 only' | Out-Null
  $script:Summary.temporaryPostgres = [ordered]@{ address = "127.0.0.1:$TempPgPort"; auth = 'scram-sha-256'; dataDir = $PgDataDir; service = $false }
  # The only connection setting of the session. Every connection goes through g0-guard.mjs, which checks it first.
  $env:TEST_DATABASE_URL = "postgresql://gate:$([uri]::EscapeDataString($gatePw))@127.0.0.1:$TempPgPort/pdabliss_core_test"
  Remove-Variable gatePw

  # ------------------------------------------------------------------ 4. install (isolated npm cache), backend static gates and build
  $env:npm_config_cache = Join-Path $G0Dir 'npm-cache'
  $env:RAYON_NUM_THREADS = '2'
  $npmCli = Join-Path (Split-Path $script:NodeExe) 'node_modules\npm\bin\npm-cli.js'   # npm through node: no cmd.exe wrapper
  if (-not (Test-Path -LiteralPath $npmCli)) { throw "npm-cli.js not found next to $($script:NodeExe)" }
  $BackendDir = Join-Path $Checkout 'backend'; $FrontendDir = Join-Path $Checkout 'frontend'
  # Target "static": Prisma generate / validate get DATABASE_URL = g0-static@127.0.0.1:55443/g0_no_such_database.
  Step 'backend-npm-ci' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'static', '--name', 'backend-npm-ci', '--', $npmCli, 'ci', '--no-audit', '--no-fund') $BackendDir 40
  Step 'backend-db-validate' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'static', '--name', 'backend-db-validate', '--', $npmCli, 'run', 'db:validate') $BackendDir
  Step 'backend-typecheck' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'static', '--name', 'backend-typecheck', '--', $npmCli, 'run', 'typecheck') $BackendDir
  Step 'backend-lint' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'backend-lint', '--', $npmCli, 'run', 'lint') $BackendDir
  Step 'backend-format-check' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'backend-format-check', '--', $npmCli, 'run', 'format:check') $BackendDir
  Step 'backend-build' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'static', '--name', 'backend-build', '--', $npmCli, 'run', 'build') $BackendDir

  # ------------------------------------------------------------------ 5. test database (identity verified, collision refused), guard, backend suite
  Step 'create-test-db' @('create-test-db', '--gates', $G0Dir, '--src', $Checkout) $Checkout 5 'I1-I4 on postgres, then CREATE DATABASE'
  Step 'g0-guard-check' @('check', '--gates', $G0Dir, '--src', $Checkout) $Checkout 5 'I1-I4'
  Step 'backend-tests' @('backend-tests', '--gates', $G0Dir, '--src', $Checkout, '--expect', "$ExpectBackend") $Checkout 90 "expect $ExpectBackend, 0 skipped"

  # ------------------------------------------------------------------ 6. frontend
  Step 'frontend-npm-ci' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'frontend-npm-ci', '--', $npmCli, 'ci', '--no-audit', '--no-fund') $FrontendDir 40
  Step 'frontend-typecheck' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'frontend-typecheck', '--', $npmCli, 'run', 'typecheck') $FrontendDir
  Step 'frontend-lint' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'frontend-lint', '--', $npmCli, 'run', 'lint') $FrontendDir
  Step 'frontend-format-check' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'frontend-format-check', '--', $npmCli, 'run', 'format:check') $FrontendDir
  Step 'frontend-tests' @('frontend-tests', '--gates', $G0Dir, '--src', $Checkout, '--expect', "$ExpectFrontend") $Checkout 60 "expect $ExpectFrontend, 0 skipped"
  $env:VITE_API_URL = 'http://127.0.0.1:1312'; $env:VITE_SITE_URL = 'http://127.0.0.1:1311'
  Step 'frontend-build-prerender-budgets' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'frontend-build', '--', $npmCli, 'run', 'build') $FrontendDir 45 'staging origins baked in'
  Remove-Item Env:VITE_API_URL, Env:VITE_SITE_URL

  # ------------------------------------------------------------------ 7. ops + launcher + guard + supervisor suites (T10 live on 55443)
  Step 'ops-tests' @('ops-tests', '--gates', $G0Dir, '--src', $Checkout, '--expect', "$ExpectOps") $Checkout 30 "expect $ExpectOps (explicit file list, concurrency 2), 0 skipped"

  # ------------------------------------------------------------------ 8. migration scratch (guard again first)
  Step 'g0-guard-check-2' @('check', '--gates', $G0Dir, '--src', $Checkout) $Checkout 5 'I1-I4 before migrations'
  Step 'migration-scratch' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'test', '--name', 'migration-scratch', '--', (Join-Path $CheckoutHarness 'g0-migration-check.mjs'), '--src', $Checkout, '--gates', $G0Dir) $Checkout 20 '28/28, ownership 0, forbidden 17/17'

  # ------------------------------------------------------------------ 9. Windows launcher smoke with the real builds (no database variable at all)
  Step 'launcher-smoke-windows' @('exec', '--gates', $G0Dir, '--src', $Checkout, '--target', 'none', '--name', 'launcher-smoke', '--', (Join-Path $CheckoutHarness 'g0-launcher-smoke.mjs'), '--src', $Checkout, '--root', $StagingRoot) $Checkout 10 'real buildApp + Vite 8 preview on 127.0.0.1, IPv4/IPv6 exposure'

  Write-G0Log 'all G0 phases passed; shutdown and the final I5 comparison follow'
  Complete-G0
  exit 0
} catch {
  if (-not $script:Finishing) { Stop-G0 "runner error: $($_.Exception.Message)" }
  Write-G0Log "error during shutdown: $($_.Exception.Message)"
  exit 1
}
