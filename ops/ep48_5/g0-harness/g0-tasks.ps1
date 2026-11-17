# PDA BLISS CORE - EP48.5 G0 run 3 readiness: scheduled tasks for the isolation check (READ-ONLY).
# Lists every scheduled task that is not disabled: path, name, state, next / last run time and actions, as JSON on
# stdout. It changes nothing (no Register / Set / Start / Stop / Disable / Unregister). g0-supervisor.mjs `isolation`
# classifies the result; action arguments are redacted there.
$ErrorActionPreference = 'Stop'
$taskRows = @()
foreach ($scheduled in @(Get-ScheduledTask)) {
  if ("$($scheduled.State)" -eq 'Disabled') { continue }
  $taskInfo = $null
  try { $taskInfo = Get-ScheduledTaskInfo -TaskName $scheduled.TaskName -TaskPath $scheduled.TaskPath -ErrorAction Stop } catch { $taskInfo = $null }
  $actionRows = @()
  foreach ($taskAction in @($scheduled.Actions)) { $actionRows += [ordered]@{ execute = "$($taskAction.Execute)"; arguments = "$($taskAction.Arguments)" } }
  $nextText = $null
  $lastText = $null
  if ($taskInfo -and $taskInfo.NextRunTime) { $nextText = ([datetime]$taskInfo.NextRunTime).ToString('o') }
  if ($taskInfo -and $taskInfo.LastRunTime) { $lastText = ([datetime]$taskInfo.LastRunTime).ToString('o') }
  $taskRows += [ordered]@{ path = "$($scheduled.TaskPath)"; name = "$($scheduled.TaskName)"; state = "$($scheduled.State)"; author = "$($scheduled.Author)"; nextRun = $nextText; lastRun = $lastText; actions = $actionRows }
}
[ordered]@{ at = (Get-Date).ToString('o'); tasks = $taskRows } | ConvertTo-Json -Depth 6 -Compress
