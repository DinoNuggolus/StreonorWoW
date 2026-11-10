<#
.SYNOPSIS  Builds the plugin release zip into dist\ (git-ignored): dist\StreonorDock-Plugin-<version>.zip
.DESCRIPTION
  Contains ONLY: the plugin folder (manifest, plugin code, lib, its own icon), the double-click installer and
  uninstaller, a short README.txt and the LICENSE. Never included: logs, state, icon libraries or caches, per-machine
  config (config.local.json), tests, docs, or any game art.
.PARAMETER OutDir  Output folder (default: dist next to the repo root).
#>
param([string]$OutDir)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $OutDir) { $OutDir = Join-Path $root 'dist' }
$id = 'io.github.dinonuggolus.streonordock.sdPlugin'
$pluginSrc = Join-Path $root "src\$id"
$manifest = Get-Content -Raw -LiteralPath (Join-Path $pluginSrc 'manifest.json') | ConvertFrom-Json
$version = $manifest.Version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Unexpected plugin version '$version'" }
$name = "StreonorDock-Plugin-$version"

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("sd-release-" + [guid]::NewGuid().ToString('N'))
$top = Join-Path $stage $name
New-Item -ItemType Directory -Force -Path $top | Out-Null
try {
  & robocopy $pluginSrc (Join-Path $top $id) /E /XD logs icons /XF config.local.json *.previous *.log /NFL /NDL /NJH /NJS | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
  foreach ($f in 'Install-StreonorDock.ps1', 'Install StreonorDock Plugin.bat', 'Uninstall StreonorDock Plugin.bat') {
    Copy-Item -LiteralPath (Join-Path $root "installer\$f") -Destination $top
  }
  Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $top
  @"
StreonorDock plugin $version for Streonor (HotSpot StreamDock)

1. Extract this whole zip to a normal folder (not inside the zip viewer).
2. Double-click "Install StreonorDock Plugin.bat". It asks before closing Streonor and before starting it again.
   Windows may show a blue "protected your PC" box for the .bat: choose More info, then Run anyway.
3. In Streonor open your S15 profile and drag Dock Key 1 ... Dock Key 15 onto the keys (S15 in landscape):
       top row:     11  12  13  14  15
       middle row:   6   7   8   9  10
       bottom row:   1   2   3   4   5     (Dock Key 1 is bottom-left)
4. Install the StreonorDock addon in World of Warcraft (see its README) and /reload once.

To remove the plugin: double-click "Uninstall StreonorDock Plugin.bat". Your Streonor profiles are never changed.
Optional: put your own icon images (named <iconFileID>.png, 144x144) into the plugin's icons folder to show real spell
icons on the keys; without them assigned keys show a question mark.
"@ | Set-Content -LiteralPath (Join-Path $top 'README.txt') -Encoding ASCII

  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $zip = Join-Path $OutDir "$name.zip"
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
  try {
    Get-ChildItem -LiteralPath $top -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($stage.Length + 1) -replace '\\', '/'
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel, 'Optimal') | Out-Null
    }
  } finally { $archive.Dispose() }
  $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
  Write-Host "Built $zip"
  Write-Host "SHA256 $hash"
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}
