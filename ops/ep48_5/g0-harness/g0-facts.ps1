# PDA BLISS CORE - EP48.5 G0 harness: Windows facts for g0-supervisor.mjs (READ-ONLY; Windows PowerShell 5.1).
# Prints ONE compressed JSON document: processes (PID, parent, name, command line, creation time), TCP listeners,
# TCP connections to port 5432, CPU, free RAM and free space on D:. No process, socket, file or setting is changed.
# The supervisor normalizes all types (PS 5.1 turns 1-element arrays into objects and may emit numbers as strings).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$processList = @(Get-CimInstance Win32_Process | ForEach-Object {
    $createdText = ''
    if ($_.CreationDate) { $createdText = $_.CreationDate.ToString('o') }
    [ordered]@{ pid = [int]$_.ProcessId; parent = [int]$_.ParentProcessId; name = [string]$_.Name; cmd = [string]$_.CommandLine; created = $createdText }
  })
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
  at = (Get-Date).ToString('o'); processes = $processList; listeners = $listenerList; to5432 = $sharedPgConnections
  cpuPct = [int]$cpuReading; freeRamGB = $ramReading; freeDiskDGB = $diskReading
} | ConvertTo-Json -Depth 4 -Compress
