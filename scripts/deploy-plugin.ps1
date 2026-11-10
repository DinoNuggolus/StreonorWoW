<#
Copy a plugin folder from src\ to the Streonor/StreamDock plugins directory (one-way). Backs up any existing copy.
Streonor must be restarted to load a new plugin. Does not touch profiles or the app install.
#>
param([string]$Name = 'io.github.dinonuggolus.wowspike.sdPlugin')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root "src\$Name"
$dest = Join-Path $env:APPDATA "HotSpot\StreamDock\plugins\$Name"
if (-not (Test-Path "$src\manifest.json")) { throw "Missing $src\manifest.json" }
if (Test-Path $dest) {
  $bak = Join-Path $root "_backups\$Name-$(Get-Date -Format yyyyMMdd-HHmmss)"
  New-Item -ItemType Directory -Force (Split-Path $bak) | Out-Null
  robocopy $dest $bak /E /XD logs /NFL /NDL /NJH /NJS | Out-Null
}
robocopy $src $dest /MIR /XD logs icons /XF config.local.json /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
Write-Host "Deployed $Name -> $dest (restart Streonor to load)."
