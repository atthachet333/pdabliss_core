# PDA BLISS CORE - EP48.5 A-1 / G0 runner (isolated quality validation on S2A-SERVER).
#
# Owner authorization: A-1 / G0 ONLY (2026-11-17 11:28). -Release is REQUIRED: pass exactly the commit the owner approved.
#
#   * Everything happens in a NEW folder D:\pdabliss-core-staging\gates\g0-<timestamp> (never reused, never deleted).
#   * One TEMPORARY PostgreSQL (plain process, not a service): 127.0.0.1:55443, SCRAM, random password in memory only.
#   * The shared PostgreSQL (5432), PM2, MariaDB, Cloudflare, the firewall, scheduled tasks and production apps are
#     never changed. No service, task or permanent database is created. Nothing is pushed or deployed.
#   * Preflight-G0.ps1 runs first; a BLOCK stops G0 before anything is created.
#   * A background monitor checks every 15 s and STOPS G0 on: a production PM2 / PostgreSQL / MariaDB / cloudflared
#     process change, a production HTTP status change, a latency regression (2 consecutive rounds above
#     max(1.5 x baseline, baseline + 50 ms)), CPU > 80 % for 3 rounds, free RAM < 8 GB, D: free < 10 GB, the temporary
#     instance listening on anything but 127.0.0.1, any G0 process connected to port 5432, or ANY G0 process
#     listening on a non-loopback address (first round).
#   * EVERY step runs through ops\ep48_5\g0-guard.mjs (A-0.1): ambiguous inherited settings refused; an explicit
#     database target per step (none / static / test - never Prisma's localhost:5432 fallback); host, port, database,
#     role and the instance's system identifier (recorded from pg_controldata right after initdb) verified before any
#     connection; the loopback-only listener guard preloaded into every process; exact counts, 0 skipped.
#     Test concurrency: 2 (vitest forks, node --test); Rolldown threads: 2; G0 processes run at BelowNormal priority.
#   * The harness .mjs files run from the G0 checkout of the release commit (the reviewed code).
#   * On a stop: the running step is killed (its own process tree only), the temporary instance is stopped (not
#     deleted), the report is written. Nothing is deleted in any case (cleanup only under A-8a).
#
# Run in an ELEVATED Windows PowerShell (the production PM2 tree runs as SYSTEM):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\S2A_PROJECT\pdabliss_core\ops\ep48_5\g0-harness\Run-G0.ps1 -Release <approved sha>
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
  [int]$ExpectOps = 0   # set by the owner from the C-A0.1 report (verified discovery); 0 = refuse to run
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Off
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$G = Join-Path $GatesRoot "g0-$Stamp"
$Root = Join-Path $G 'root'                         # test-only staging root for the launcher smoke
$S = Join-Path $Root "releases\$Release"            # the G0 checkout of the release commit
$Pg = Join-Path $G 'pg'
$Out = Join-Path $G 'g0'
$StopFile = Join-Path $Out 'STOP'
$EndFile = Join-Path $Out 'MONITOR-END'
$HarnessDir = $PSScriptRoot
$Port = 55443
$script:Steps = @()
$script:StepNo = 0
$script:PgStarted = $false
$script:Monitor = $null
$script:Summary = [ordered]@{ runner = 'EP48.5 Run-G0 v2 (A-0.1)'; release = $Release; baseline = $Baseline; folder = $G; startedAt = (Get-Date).ToString('o'); result = 'RUNNING'; stopReason = $null; steps = @() }

New-Item -ItemType Directory -Force -Path $Out | Out-Null
Start-Transcript -Path (Join-Path $Out 'transcript.txt') | Out-Null
function Log([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path (Join-Path $Out 'runner.log') -Value $line }
function Q([string]$a) { if ($a -match '[\s"]') { '"' + ($a -replace '"', '\"') + '"' } else { $a } }
function Native([string]$exe, [string[]]$argv, [string]$logName) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & $exe @argv *> (Join-Path $Out $logName); return $LASTEXITCODE } finally { $ErrorActionPreference = $old }
}
function Kill-Tree([int]$id) { & taskkill.exe /PID $id /T /F *> $null }

function Write-Report {
  $script:Summary.finishedAt = (Get-Date).ToString('o')
  $script:Summary.steps = $script:Steps
  $script:Summary | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $Out 'G0-SUMMARY.json') -Encoding UTF8
  $t = @("EP48.5 G0 - $($script:Summary.result)", "release $Release | folder $G", "started $($script:Summary.startedAt) | finished $($script:Summary.finishedAt)")
  if ($script:Summary.stopReason) { $t += "STOP REASON: $($script:Summary.stopReason)" }
  foreach ($s in $script:Steps) { $t += ("{0,-3} {1,-34} {2,-6} {3,7}s  {4}" -f $s.no, $s.name, $s.status, $s.seconds, $s.note) }
  $t | Set-Content -Path (Join-Path $Out 'G0-SUMMARY.txt') -Encoding UTF8
  # Copy (never move) the logs to the repository's git-ignored ops-logs so the review can read them.
  try {
    $dest = Join-Path $Dev "ops-logs\ep48_5-g0\g0-$Stamp"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Path (Join-Path $Out '*') -Destination $dest -Recurse -Force
  } catch { Log "WARNING: could not copy logs to ops-logs: $($_.Exception.Message)" }
}

function Stop-G0([string]$reason) {
  Log "STOP: $reason"
  $script:Summary.result = 'STOPPED'
  if (-not $script:Summary.stopReason) { $script:Summary.stopReason = $reason }
  Finish-G0
  exit 1
}

function Finish-G0 {
  if ($script:PgStarted) {
    $code = Native "$PgBin\pg_ctl.exe" @('-D', $Pg, 'stop', '-m', 'fast', '-w') 'pg-stop.log'
    Log "temporary PostgreSQL stopped (exit $code); its data folder is preserved"
    $script:PgStarted = $false
  }
  if ($script:Monitor) {
    New-Item -ItemType File -Force -Path $EndFile | Out-Null
    Wait-Job $script:Monitor -Timeout 120 | Out-Null
    Receive-Job $script:Monitor *> (Join-Path $Out 'monitor-job-output.txt')
    $finalFile = Join-Path $Out 'monitor-final.json'
    if (Test-Path $finalFile) {
      $final = Get-Content $finalFile -Raw | ConvertFrom-Json
      $script:Summary.monitor = $final
      if ($script:Summary.result -eq 'RUNNING' -and -not $final.i5ok) { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = "I5 after-baseline: $($final.i5diffs -join '; ')" }
    } elseif ($script:Summary.result -eq 'RUNNING') { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = 'monitor did not report a final I5 comparison' }
    if ((Test-Path $StopFile) -and $script:Summary.result -eq 'RUNNING') { $script:Summary.result = 'STOPPED'; $script:Summary.stopReason = "monitor: $(Get-Content $StopFile -Raw)" }
    $script:Monitor = $null
  }
  try {
    $collector = Join-Path $Dev 'ops\ep48_5\Collect-HostAudit.ps1'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $collector -NoHttpProbe *> (Join-Path $Out 'collector-after.txt')
    Log 'host collector "after" written (no PostgreSQL connection)'
  } catch { Log "collector after: $($_.Exception.Message)" }
  if ($script:Summary.result -eq 'RUNNING') { $script:Summary.result = 'PASS' }
  Write-Report
  Stop-Transcript | Out-Null
}

function Check-Stop { if (Test-Path $StopFile) { Stop-G0 "monitor: $(Get-Content $StopFile -Raw)" } }

function Step([string]$name, [string]$file, [string[]]$argv, [string]$cwd, [int]$timeoutMin = 45, [string]$note = '') {
  Check-Stop
  $script:StepNo++
  $no = $script:StepNo
  $log = Join-Path $Out ('{0:D2}-{1}' -f $no, $name)
  Log "step $no $name ..."
  $t0 = Get-Date
  $p = Start-Process -FilePath $file -ArgumentList (($argv | ForEach-Object { Q $_ }) -join ' ') -WorkingDirectory $cwd -NoNewWindow -PassThru -RedirectStandardOutput "$log.out.txt" -RedirectStandardError "$log.err.txt"
  $null = $p.Handle   # PS 5.1: keeps ExitCode available after exit
  $deadline = $t0.AddMinutes($timeoutMin)
  while (-not $p.HasExited) {
    Start-Sleep -Seconds 2
    if (Test-Path $StopFile) { Kill-Tree $p.Id; $script:Steps += [ordered]@{ no = $no; name = $name; status = 'KILLED'; seconds = [int]((Get-Date) - $t0).TotalSeconds; note = 'monitor stop' }; Stop-G0 "monitor: $(Get-Content $StopFile -Raw)" }
    if ((Get-Date) -gt $deadline) { Kill-Tree $p.Id; $script:Steps += [ordered]@{ no = $no; name = $name; status = 'TIMEOUT'; seconds = [int]((Get-Date) - $t0).TotalSeconds; note = "> $timeoutMin min" }; Stop-G0 "$name timed out" }
  }
  $p.WaitForExit()
  $code = $p.ExitCode
  $secs = [int]((Get-Date) - $t0).TotalSeconds
  $status = 'PASS'; if ($code -ne 0) { $status = 'FAIL' }
  $script:Steps += [ordered]@{ no = $no; name = $name; status = $status; exit = $code; seconds = $secs; note = $note }
  Log "step $no $name -> $status (exit $code, ${secs}s)"
  if ($code -ne 0) { Stop-G0 "$name failed (exit $code) - see $log.*.txt" }
}

try {
  # ------------------------------------------------------------------ 0. preconditions (read-only)
  Log "EP48.5 G0 runner - folder $G"
  (Get-Process -Id $PID).PriorityClass = 'BelowNormal'   # children inherit BelowNormal
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $elevated = (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $elevated) { throw 'run this in an ELEVATED PowerShell (the production PM2 tree runs as SYSTEM)' }
  if ($env:COMPUTERNAME -ne 'S2A-SERVER') { throw "this is $env:COMPUTERNAME, not S2A-SERVER" }
  if ($ExpectOps -le 0) { throw '-ExpectOps <exact ops test count from the C-A0.1 report> is required' }
  $nodeV = (& node -v); if ($nodeV -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) { throw "Node 24+ required, found $nodeV" }
  $script:Summary.node = $nodeV
  # Neutralise inherited settings in THIS process (children inherit this process's block, not the registry).
  $hazards = @(Get-ChildItem Env: | Where-Object { $_.Name.ToUpper() -match '^(PG[A-Z0-9_]+|DATABASE_URL|TEST_DATABASE_URL|DIRECT_URL|SHADOW_DATABASE_URL|NODE_OPTIONS|CORE_G0[A-Z0-9_]*)$' } | ForEach-Object { $_.Name })
  foreach ($k in $hazards) { Remove-Item "Env:$k" }
  $script:Summary.neutralisedVariables = $hazards
  $code = Native powershell.exe @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $HarnessDir 'Preflight-G0.ps1'), '-Release', $Release, '-Baseline', $Baseline, '-Dev', $Dev, '-PgBin', $PgBin, '-GatesRoot', $GatesRoot, '-Port', "$Port", '-ReportDir', (Join-Path $Out 'preflight'), '-FromRunner') 'preflight.txt'
  $script:Summary.preflight = $(if ($code -eq 0) { 'PASS' } else { 'BLOCK' })
  if ($code -ne 0) { throw "PREFLIGHT BLOCKED G0 - see $Out\preflight\preflight.txt" }
  Log 'preflight PASS (read-only checks W1-W9)'
  if (-not (Test-Path "$PgBin\initdb.exe")) { throw "PostgreSQL binaries not found in $PgBin" }
  $pgV = (& "$PgBin\pg_ctl.exe" --version); $script:Summary.postgresBinaries = $pgV
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $commitType = (& git -C $Dev cat-file -t $Release 2>$null)
  & git -C $Dev diff --quiet $Baseline $Release -- backend frontend; $appDiff = $LASTEXITCODE
  $changed = @(& git -C $Dev diff --name-only $Baseline $Release)
  $ErrorActionPreference = $old
  if ($commitType -ne 'commit') { throw "release commit $Release not found in $Dev" }
  if ($appDiff -ne 0) { throw 'backend/ or frontend/ differ between cb21be1 and the release commit' }
  $outside = @($changed | Where-Object { $_ -notmatch '^(docs/EP48_5_|ops/ep48_5/|ops/test/(staging-launch|g0-))' })
  if ($outside.Count) { throw "release commit changes files outside the EP48.5 scope: $($outside -join ', ')" }
  $script:Summary.commitCheck = "commit ok; backend/ and frontend/ identical to $Baseline; $($changed.Count) files changed, all within the EP48.5 scope"
  Log $script:Summary.commitCheck
  if (@(Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue).Count) { throw "port $Port is in use" }
  $excl = (netsh interface ipv4 show excludedportrange protocol=tcp) -match '^\s*\d+\s+\d+' | ForEach-Object { $a = $_.Trim() -split '\s+'; ,@([int]$a[0], [int]$a[1]) }
  foreach ($r in $excl) { if ($Port -ge $r[0] -and $Port -le $r[1]) { throw "port $Port is inside an excluded port range" } }
  $freeD = [math]::Round((Get-Volume -DriveLetter D).SizeRemaining / 1GB, 1)
  if ($freeD -lt 20) { throw "D: has only $freeD GB free (need 20)" }
  $script:Summary.harnessSha256 = @{}; Get-ChildItem $HarnessDir -File | ForEach-Object { $script:Summary.harnessSha256[$_.Name] = (Get-FileHash $_.FullName -Algorithm SHA256).Hash }

  # ------------------------------------------------------------------ 1. "before" record + monitor baseline
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Dev 'ops\ep48_5\Collect-HostAudit.ps1') -NoHttpProbe *> (Join-Path $Out 'collector-before.txt')
  Log 'host collector "before" written (run without -PgUser: no PostgreSQL connection)'
  $monitorScript = Get-Content (Join-Path $HarnessDir 'g0-monitor.ps1') -Raw
  $script:Monitor = Start-Job -ScriptBlock ([scriptblock]::Create($monitorScript)) -ArgumentList $PID, $Out, $Pg, $Port
  $waited = 0
  while (-not (Test-Path (Join-Path $Out 'baseline.json'))) { Start-Sleep 2; $waited += 2; if ($waited -gt 180) { throw 'monitor did not produce its baseline' }; if ($script:Monitor.State -ne 'Running') { throw "monitor job ended: $(Receive-Job $script:Monitor 2>&1 | Out-String)" } }
  Check-Stop
  Log 'monitor running; baseline captured (production PM2 tree, PostgreSQL / MariaDB / cloudflared PIDs, HTTP status + latency)'

  # ------------------------------------------------------------------ 2. checkout of the exact release commit
  New-Item -ItemType Directory -Force -Path (Split-Path $S) | Out-Null
  if ((Native git @('clone', '--no-local', '--quiet', $Dev, $S) 'git-clone.log') -ne 0) { throw 'git clone failed' }
  if ((Native git @('-C', $S, 'checkout', '--quiet', '--detach', $Release) 'git-checkout.log') -ne 0) { throw 'git checkout failed' }
  $head = (& git -C $S rev-parse HEAD)
  if ($head -ne $Release) { throw "checkout HEAD $head is not $Release" }
  if (@(& git -C $S status --porcelain).Count) { throw 'checkout is not clean' }
  $SH = Join-Path $S 'ops\ep48_5\g0-harness'   # harness .mjs files: from the reviewed commit
  $guard = Join-Path $S 'ops\ep48_5\g0-guard.mjs'
  Log "checkout $S at $head (clean)"

  # ------------------------------------------------------------------ 3. temporary PostgreSQL: SCRAM, 127.0.0.1:55443, not a service
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $gatePw = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $pwFile = Join-Path $G 'initdb.pw'
  [IO.File]::WriteAllText($pwFile, $gatePw)
  $code = Native "$PgBin\initdb.exe" @('-D', $Pg, '-U', 'gate', "--pwfile=$pwFile", '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=English_United States.1252') 'initdb.log'
  [IO.File]::WriteAllText($pwFile, '')   # emptied, not deleted (nothing is deleted in G0)
  if ($code -ne 0) { throw "initdb failed (exit $code)" }
  # Instance identity: the system identifier is unique per initdb; the guard compares it before every connection.
  $ctl = @(& "$PgBin\pg_controldata.exe" -D $Pg) | Where-Object { $_ -match 'system identifier:\s+(\d{10,20})' } | Select-Object -First 1
  if (-not $ctl -or $ctl -notmatch '(\d{10,20})\s*$') { throw 'pg_controldata did not report the system identifier' }
  $env:CORE_G0_PG_SYSID = $Matches[1]
  $script:Summary.temporaryInstanceSystemId = $Matches[1]
  $hba = Get-Content (Join-Path $Pg 'pg_hba.conf') | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' }
  if (@($hba | Where-Object { $_ -match '\b(trust|md5|password|peer|ident)\b' }).Count) { throw 'pg_hba.conf of the temporary instance contains a non-SCRAM method' }
  $code = Native "$PgBin\pg_ctl.exe" @('-D', $Pg, '-o', "-p $Port -c listen_addresses=127.0.0.1", '-l', (Join-Path $G 'pg.log'), '-w', 'start') 'pg-start.log'
  if ($code -ne 0) { throw "temporary PostgreSQL did not start (exit $code)" }
  $script:PgStarted = $true
  Start-Sleep 2
  $lst = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  if (-not $lst.Count -or @($lst | Where-Object { $_.LocalAddress -ne '127.0.0.1' }).Count) { throw "temporary PostgreSQL is not listening on 127.0.0.1:$Port only" }
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($lst[0].OwningProcess)"
  if ($owner.Name -ne 'postgres.exe' -or "$($owner.CommandLine)" -notlike "*$Pg*") { throw 'port 55443 is not owned by the temporary instance' }
  Log "temporary PostgreSQL up: 127.0.0.1:$Port only, SCRAM, data $Pg (plain process, PID $($owner.ProcessId))"
  $script:Summary.temporaryPostgres = [ordered]@{ address = "127.0.0.1:$Port"; auth = 'scram-sha-256'; dataDir = $Pg; pid = $owner.ProcessId; service = $false }

  # The only connection setting of the session. Every connection goes through g0-guard.mjs, which checks it first.
  $env:TEST_DATABASE_URL = "postgresql://gate:$([uri]::EscapeDataString($gatePw))@127.0.0.1:$Port/pdabliss_core_test"
  Remove-Variable gatePw

  # ------------------------------------------------------------------ 4. install (isolated npm cache), backend static gates and build
  $env:npm_config_cache = Join-Path $G 'npm-cache'
  $env:RAYON_NUM_THREADS = '2'
  $nodeExe = (Get-Command node.exe).Source
  $npmCli = Join-Path (Split-Path $nodeExe) 'node_modules\npm\bin\npm-cli.js'   # run npm through node: no cmd.exe wrapper, so a stop kills the real tree
  if (-not (Test-Path $npmCli)) { throw "npm-cli.js not found next to $nodeExe" }
  $B = Join-Path $S 'backend'; $F = Join-Path $S 'frontend'
  # Target "static": Prisma generate / validate get DATABASE_URL = g0-static@127.0.0.1:55443/g0_no_such_database
  # (explicit; Prisma's localhost:5432 fallback in prisma.config.ts is never reached).
  Step 'backend-npm-ci' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'static', '--name', 'backend-npm-ci', '--', $npmCli, 'ci', '--no-audit', '--no-fund') $B 40
  Step 'backend-db-validate' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'static', '--name', 'backend-db-validate', '--', $npmCli, 'run', 'db:validate') $B
  Step 'backend-typecheck' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'static', '--name', 'backend-typecheck', '--', $npmCli, 'run', 'typecheck') $B
  Step 'backend-lint' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'backend-lint', '--', $npmCli, 'run', 'lint') $B
  Step 'backend-format-check' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'backend-format-check', '--', $npmCli, 'run', 'format:check') $B
  Step 'backend-build' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'static', '--name', 'backend-build', '--', $npmCli, 'run', 'build') $B

  # ------------------------------------------------------------------ 5. test database (identity verified, collision refused), guard, backend suite
  Step 'create-test-db' $nodeExe @($guard, 'create-test-db', '--gates', $G, '--src', $S) $S 5 'I1-I4 on postgres, then CREATE DATABASE'
  Step 'g0-guard-check' $nodeExe @($guard, 'check', '--gates', $G, '--src', $S) $S 5 'I1-I4'
  Step 'backend-tests' $nodeExe @($guard, 'backend-tests', '--gates', $G, '--src', $S, '--expect', "$ExpectBackend") $S 90 "expect $ExpectBackend, 0 skipped"

  # ------------------------------------------------------------------ 6. frontend
  Step 'frontend-npm-ci' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'frontend-npm-ci', '--', $npmCli, 'ci', '--no-audit', '--no-fund') $F 40
  Step 'frontend-typecheck' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'frontend-typecheck', '--', $npmCli, 'run', 'typecheck') $F
  Step 'frontend-lint' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'frontend-lint', '--', $npmCli, 'run', 'lint') $F
  Step 'frontend-format-check' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'frontend-format-check', '--', $npmCli, 'run', 'format:check') $F
  Step 'frontend-tests' $nodeExe @($guard, 'frontend-tests', '--gates', $G, '--src', $S, '--expect', "$ExpectFrontend") $S 60 "expect $ExpectFrontend, 0 skipped"
  $env:VITE_API_URL = 'http://127.0.0.1:1312'; $env:VITE_SITE_URL = 'http://127.0.0.1:1311'
  Step 'frontend-build-prerender-budgets' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'frontend-build', '--', $npmCli, 'run', 'build') $F 45 'staging origins baked in'
  Remove-Item Env:VITE_API_URL, Env:VITE_SITE_URL

  # ------------------------------------------------------------------ 7. ops + launcher + guard suites (T10 live on 55443)
  Step 'ops-tests' $nodeExe @($guard, 'ops-tests', '--gates', $G, '--src', $S, '--expect', "$ExpectOps") $S 30 "expect $ExpectOps (explicit file list, concurrency 2), 0 skipped"

  # ------------------------------------------------------------------ 8. migration scratch (guard again first)
  Step 'g0-guard-check-2' $nodeExe @($guard, 'check', '--gates', $G, '--src', $S) $S 5 'I1-I4 before migrations'
  Step 'migration-scratch' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'test', '--name', 'migration-scratch', '--', (Join-Path $SH 'g0-migration-check.mjs'), '--src', $S, '--gates', $G) $S 20 '28/28, ownership 0, forbidden 17/17'

  # ------------------------------------------------------------------ 9. Windows launcher smoke with the real builds (no database variable at all)
  Step 'launcher-smoke-windows' $nodeExe @($guard, 'exec', '--gates', $G, '--src', $S, '--target', 'none', '--name', 'launcher-smoke', '--', (Join-Path $SH 'g0-launcher-smoke.mjs'), '--src', $S, '--root', $Root) $S 10 'real buildApp + Vite 8 preview on 127.0.0.1, IPv4/IPv6 exposure'

  Check-Stop
  Remove-Item Env:TEST_DATABASE_URL
  Log 'all G0 steps passed; final I5 comparison follows'
  Finish-G0
  exit 0
} catch {
  if ($script:Summary.result -eq 'RUNNING') { Stop-G0 "runner error: $($_.Exception.Message)" }
}
