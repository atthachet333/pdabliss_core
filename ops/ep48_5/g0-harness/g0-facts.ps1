# PDA BLISS CORE - EP48.5 G0 harness: Windows facts for g0-supervisor.mjs (READ-ONLY; Windows PowerShell 5.1).
# Prints ONE compressed JSON document. No process, socket, file or setting is changed.
#   -Scope full       (default; the monitor) processes, TCP listeners, connections to 5432, CPU, free RAM, free D:
#   -Scope processes  (stop-tree planning)  processes only - no socket tables, performance counters or volumes
#   -Scope identity   (stop-tree verification) only the PIDs in -ProcessIds (comma-separated): one filtered query
# The supervisor normalizes all types (PS 5.1 turns 1-element arrays into objects and may emit numbers as strings).
param(
  [ValidateSet('full', 'processes', 'identity')][string]$Scope = 'full',
  [string]$ProcessIds = ''
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function ConvertTo-FactProcess($CimProcess) {
  $createdText = ''
  if ($CimProcess.CreationDate) { $createdText = $CimProcess.CreationDate.ToString('o') }
  [ordered]@{ pid = [int]$CimProcess.ProcessId; parent = [int]$CimProcess.ParentProcessId; name = [string]$CimProcess.Name; cmd = [string]$CimProcess.CommandLine; created = $createdText }
}
if ($Scope -eq 'identity') {
  $idList = @($ProcessIds -split ',' | Where-Object { $_ -match '^\s*\d+\s*$' } | ForEach-Object { [int]$_ })
  $identityList = @()
  if ($idList.Count) {
    $cimFilter = (@($idList | ForEach-Object { "ProcessId=$_" }) -join ' OR ')
    $identityList = @(Get-CimInstance Win32_Process -Filter $cimFilter | ForEach-Object { ConvertTo-FactProcess $_ })
  }
  [ordered]@{ at = (Get-Date).ToString('o'); scope = 'identity'; processes = $identityList } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}
$processList = @(Get-CimInstance Win32_Process | ForEach-Object { ConvertTo-FactProcess $_ })
if ($Scope -eq 'processes') {
  [ordered]@{ at = (Get-Date).ToString('o'); scope = 'processes'; processes = $processList } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}
$listenerList = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{ address = [string]$_.LocalAddress; port = [int]$_.LocalPort; pid = [int]$_.OwningProcess }
  })
$sharedPgConnections = @(Get-NetTCPConnection -RemotePort 5432 -ErrorAction SilentlyContinue | Where-Object { "$($_.State)" -ne 'Listen' } | ForEach-Object {
    [ordered]@{ pid = [int]$_.OwningProcess; local = "$($_.LocalAddress):$($_.LocalPort)"; remote = "$($_.RemoteAddress):$($_.RemotePort)"; state = "$($_.State)" }
  })
$cpuReading = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
$ramReading = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
$diskReading = [math]::Round((Get-Volume -DriveLetter D).SizeRemaining / 1GB, 1)
[ordered]@{
  at = (Get-Date).ToString('o'); scope = 'full'; processes = $processList; listeners = $listenerList; to5432 = $sharedPgConnections
  cpuPct = [int]$cpuReading; freeRamGB = $ramReading; freeDiskDGB = $diskReading
} | ConvertTo-Json -Depth 4 -Compress
