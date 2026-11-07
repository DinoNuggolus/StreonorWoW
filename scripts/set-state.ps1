# Writes the spike's state file (stand-in for the future WoW telemetry bridge). Panel shows STALE if older than 30s.
param([string]$Gold = '123g 45s 6c', [int]$FreeSlots = 17)
$f = Join-Path (Split-Path $PSScriptRoot -Parent) 'state\state.json'
$json = @{ gold = $Gold; freeSlots = $FreeSlots; updated = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
[IO.File]::WriteAllText($f, $json, (New-Object Text.UTF8Encoding($false)))
Get-Content $f
