# PDA BLISS CORE - EP48.5 G0 harness: shared helpers (Windows PowerShell 5.1). Dot-sourced by Run-G0.ps1 and
# Test-G0Harness.ps1. G0 incident amendment 2026-11-17 (docs/EP48_5_G0_INCIDENT_20261117.md).
#
# Why: in incident g0-20261117-134458 the runner called `& pg_ctl.exe ... start *> pg-start.log`. PowerShell read the
# child's output through a pipe and waited for end-of-file; the postmaster (started by pg_ctl through cmd.exe)
# inherited that pipe, so the call never returned although pg_ctl had exited - and the runner never checked STOP.
#
# Invoke-G0Bounded is the ONLY way G0 runs an external program:
#   * Start-Process with -RedirectStandardOutput/-RedirectStandardError: the child writes to FILES (no pipe, so a
#     long-lived grandchild such as the postmaster cannot hold the runner);
#   * a polling loop (500 ms) that returns on exit, on the STOP file, on an abort condition (e.g. the monitor died)
#     or on a deadline - every phase is bounded;
#   * on STOP / abort / timeout it calls -OnAbort with the child's PID and creation time; the runner's OnAbort stops
#     that child's OWN tree through `g0-supervisor.mjs stop-tree` (re-verified PIDs, production protected).

function ConvertTo-G0ArgLine([string[]]$ArgumentValues) {
  # Windows command-line quoting (CommandLineToArgvW rules): quote arguments with spaces or quotes; double the
  # backslashes that precede a quote or the closing quote.
  $quoted = foreach ($oneArg in @($ArgumentValues)) {
    if ($null -eq $oneArg) { continue }
    if ($oneArg -eq '') { '""'; continue }
    if ($oneArg -notmatch '[\s"]') { $oneArg; continue }
    '"' + (($oneArg -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
  }
  return (@($quoted) -join ' ')
}

function Format-G0ExitCode($CodeValue) {
  # Windows exit codes are 32-bit: -1 is 0xFFFFFFFF (terminated by another process with TerminateProcess(-1), e.g.
  # .NET Process.Kill / Stop-Process). g0-supervisor.mjs census records the full meaning.
  if ($null -eq $CodeValue) { return 'none' }
  $asInt = [int64]$CodeValue
  if ($asInt -lt 0) { $asInt += 4294967296 }
  return ('{0} (0x{1:X8})' -f $CodeValue, $asInt)
}

function Invoke-G0Bounded {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentValues = @(),
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$LogDir,
    [int]$TimeoutSec = 600,
    [string]$StopFile = '',
    [scriptblock]$AbortCheck = $null,
    [scriptblock]$OnAbort = $null
  )
  $startedAt = Get-Date
  $logBase = Join-Path $LogDir $Name
  $argLine = ConvertTo-G0ArgLine $ArgumentValues
  $startParams = @{ FilePath = $FilePath; WorkingDirectory = $WorkingDirectory; NoNewWindow = $true; PassThru = $true; RedirectStandardOutput = "$logBase.out.txt"; RedirectStandardError = "$logBase.err.txt" }
  if ($argLine) { $startParams.ArgumentList = $argLine }
  $child = Start-Process @startParams
  $null = $child.Handle   # PS 5.1: keeps ExitCode available after the process ends
  $childCreated = $null
  $childCim = Get-CimInstance Win32_Process -Filter "ProcessId=$($child.Id)" -ErrorAction SilentlyContinue
  if ($childCim -and $childCim.CreationDate) { $childCreated = $childCim.CreationDate.ToString('o') }
  $deadline = $startedAt.AddSeconds($TimeoutSec)
  $outcome = $null
  $why = $null
  while (-not $child.HasExited) {
    Start-Sleep -Milliseconds 500
    if ($StopFile -and (Test-Path -LiteralPath $StopFile)) {
      $outcome = 'STOPPED'
      $why = 'STOP: ' + ("$(Get-Content -LiteralPath $StopFile -Raw -ErrorAction SilentlyContinue)".Trim())
      break
    }
    if ($AbortCheck) {
      $abortReason = & $AbortCheck
      if ($abortReason) { $outcome = 'STOPPED'; $why = "$abortReason"; break }
    }
    if ((Get-Date) -gt $deadline) { $outcome = 'TIMEOUT'; $why = "exceeded $TimeoutSec s"; break }
  }
  $endedFirst = $false
  if ($outcome) {
    # G0 run 2: the step may have ended by itself in the same instant the abort condition appeared. Then nothing was
    # stopped by G0 and the record must say so (fail closed: the outcome stays STOPPED / TIMEOUT).
    if ($child.HasExited) {
      $endedFirst = $true
      $why = "$why; the step had already ended by itself (exit $(Format-G0ExitCode $child.ExitCode)) - G0 did not stop it"
    } elseif ($OnAbort -and $childCreated) { & $OnAbort $child.Id $childCreated $why }
    $null = $child.WaitForExit(15000)
  } else {
    $child.WaitForExit()
    $outcome = 'OK'
    if ($child.ExitCode -ne 0) { $outcome = 'FAIL' }
  }
  $exitValue = $null
  if ($child.HasExited) { $exitValue = $child.ExitCode }
  return [pscustomobject]@{
    name = $Name; status = $outcome; exit = $exitValue; exitText = (Format-G0ExitCode $exitValue); childEndedFirst = $endedFirst; reason = $why; seconds = [int]((Get-Date) - $startedAt).TotalSeconds
    childPid = $child.Id; childCreated = $childCreated; stdout = "$logBase.out.txt"; stderr = "$logBase.err.txt"
  }
}

function Get-G0VariableHazards([string]$ScriptPath) {
  # Incident cause 1: PowerShell variable names are case-insensitive and a typed parameter keeps its type, so a loop
  # variable spelled like a parameter silently overwrites (and converts) it. Returns the problems found (AST-based):
  #   * one variable written with several spellings ($Port / $port);
  #   * a foreach variable or an assignment target that reuses a script parameter's name.
  $tokens = $null; $parseErrors = $null
  $tree = [System.Management.Automation.Language.Parser]::ParseFile($ScriptPath, [ref]$tokens, [ref]$parseErrors)
  $found = @()
  foreach ($parseError in @($parseErrors)) { $found += "parse error line $($parseError.Extent.StartLineNumber): $($parseError.Message)" }
  $spellings = @{}
  foreach ($varNode in @($tree.FindAll({ param($node) $node -is [System.Management.Automation.Language.VariableExpressionAst] }, $true))) {
    $userPath = $varNode.VariablePath.UserPath
    if ($userPath -match '^env:') { continue }
    $bareName = $userPath -replace '^(script|global|local|private|using):', ''
    $lowerName = $bareName.ToLowerInvariant()
    if (-not $spellings.ContainsKey($lowerName)) { $spellings[$lowerName] = @{} }
    $spellings[$lowerName][$bareName] = 1
  }
  foreach ($lowerName in @($spellings.Keys)) { if ($spellings[$lowerName].Count -gt 1) { $found += "one variable with several spellings: $((@($spellings[$lowerName].Keys) | Sort-Object) -join ' / ')" } }
  $paramNames = @()
  if ($tree.ParamBlock) { $paramNames = @($tree.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath.ToLowerInvariant() }) }
  foreach ($loopNode in @($tree.FindAll({ param($node) $node -is [System.Management.Automation.Language.ForEachStatementAst] }, $true))) {
    if ($paramNames -contains $loopNode.Variable.VariablePath.UserPath.ToLowerInvariant()) { $found += "line $($loopNode.Extent.StartLineNumber): foreach variable reuses the script parameter `$$($loopNode.Variable.VariablePath.UserPath)" }
  }
  foreach ($assignNode in @($tree.FindAll({ param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst] }, $true))) {
    $targetNode = $assignNode.Left
    if ($targetNode -is [System.Management.Automation.Language.ConvertExpressionAst]) { $targetNode = $targetNode.Child }
    if ($targetNode -is [System.Management.Automation.Language.VariableExpressionAst] -and $paramNames -contains $targetNode.VariablePath.UserPath.ToLowerInvariant()) { $found += "line $($assignNode.Extent.StartLineNumber): assignment to the script parameter `$$($targetNode.VariablePath.UserPath)" }
  }
  return $found
}
