<#
.SYNOPSIS
  Installs (or removes) the StreonorDock plugin for Streonor / HotSpot StreamDock. Double-click
  "Install StreonorDock Plugin.bat" instead of running this by hand.
.DESCRIPTION
  * Copies the plugin folder next to this script into the Streonor plugins folder
    (%APPDATA%\HotSpot\StreamDock\plugins).
  * An existing copy of the same plugin is backed up first (outside the plugins folder) and then updated in place;
    your own icons\, logs\ and config.local.json inside the plugin folder are kept.
  * Nothing else is deleted, no profile is touched, no other plugin is touched.
  * Asks before closing Streonor and before starting it again.
.PARAMETER Uninstall   Remove this plugin's folder (a backup copy is kept).
.PARAMETER DryRun      Print what would happen; change nothing.
.PARAMETER Yes         Do not ask questions (close/start Streonor automatically).
.PARAMETER NoRestart   Never start Streonor afterwards.
.PARAMETER NoPause     Do not wait for Enter at the end.
.PARAMETER PluginsDir  Target plugins folder (default: Streonor's). Used by the tests.
.PARAMETER Source      Folder that contains the plugin folder (default: this script's folder).
.PARAMETER ProcessName Streonor's process name (default: Streonor). Used by the tests.
#>
param(
  [switch]$Uninstall,
  [switch]$DryRun,
  [switch]$Yes,
  [switch]$NoRestart,
  [switch]$NoPause,
  [string]$PluginsDir = (Join-Path $env:APPDATA 'HotSpot\StreamDock\plugins'),
  [string]$Source = $PSScriptRoot,
  [string]$ProcessName = 'Streonor'
)
$ErrorActionPreference = 'Stop'
$PluginId = 'io.github.dinonuggolus.streonordock.sdPlugin'

function Say([string]$text, [string]$color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ask([string]$question) {
  if ($Yes) { return $true }
  $answer = Read-Host "$question [Y/n]"
  return ($answer -eq '' -or $answer -match '^(y|yes|j|ja|s|si|oui)$')
}
function Finish([int]$code) {
  if (-not $NoPause -and -not $Yes) { Write-Host ''; Read-Host 'Press Enter to close this window' | Out-Null }
  exit $code
}
function Find-StreonorExe {
  $running = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.Path } | Select-Object -First 1
  if ($running) { return $running.Path }
  try {
    $cmd = (Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\StreamDock.sdPlugin\shell\open\command' -ErrorAction Stop).'(default)'
    if ($cmd -match '^"([^"]+)"') { if (Test-Path -LiteralPath $Matches[1]) { return $Matches[1] } }
  } catch { }
  foreach ($p in @("${env:ProgramFiles(x86)}\Streonor\Streonor.exe", "$env:ProgramFiles\Streonor\Streonor.exe")) {
    if ($p -and (Test-Path -LiteralPath $p)) { return $p }
  }
  return $null
}

try {
  Say ''
  Say ('StreonorDock plugin - ' + $(if ($Uninstall) { 'uninstall' } else { 'install' }) + $(if ($DryRun) { ' (dry run: nothing will be changed)' } else { '' })) 'Cyan'
  $parent = Split-Path -Parent $PluginsDir
  if (-not (Test-Path -LiteralPath $PluginsDir)) {
    if (-not (Test-Path -LiteralPath $parent)) {
      throw "Streonor's plugin folder was not found:`n  $PluginsDir`nStart Streonor once so it creates its folders, then run this again."
    }
    if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $PluginsDir | Out-Null }
  }
  $target = Join-Path $PluginsDir $PluginId
  $sourcePlugin = Join-Path $Source $PluginId
  if (-not $Uninstall) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourcePlugin 'manifest.json'))) {
      throw "The plugin files were not found next to this installer:`n  $sourcePlugin`nExtract the whole zip first, then run the installer from the extracted folder."
    }
  } elseif (-not (Test-Path -LiteralPath $target)) {
    Say 'The StreonorDock plugin is not installed. Nothing to do.' 'Yellow'
    Finish 0
  }

  # Streonor must not be running while its plugin folder changes.
  $exe = Find-StreonorExe
  $running = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
  $closed = $false
  if ($running.Count -gt 0) {
    Say 'Streonor is running and has to be closed for the change.' 'Yellow'
    if ($DryRun) { Say '  [dry run] would close Streonor' }
    elseif (Ask 'Close Streonor now?') {
      $running | ForEach-Object { try { $_.CloseMainWindow() | Out-Null } catch { } }
      Start-Sleep -Seconds 3
      Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 1
      $closed = $true
      Say '  Streonor closed.'
    } else {
      throw 'Streonor is still running. Close it (tray icon > Exit) and run this again.'
    }
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupRoot = Join-Path $parent 'plugin-backups'
  if (Test-Path -LiteralPath $target) {
    $backup = Join-Path $backupRoot "$PluginId-$stamp"
    if ($DryRun) { Say "  [dry run] would back up the existing copy to $backup" }
    else {
      New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
      & robocopy $target $backup /E /NFL /NDL /NJH /NJS | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "Could not back up the existing plugin (robocopy $LASTEXITCODE)." }
      Say "  Backed up the existing copy to $backup"
    }
  }

  if ($Uninstall) {
    $resolved = [System.IO.Path]::GetFullPath($target)
    if ((Split-Path -Leaf $resolved) -ne $PluginId -or ([System.IO.Path]::GetFullPath((Split-Path -Parent $resolved)).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($PluginsDir).TrimEnd('\'))) {
      throw "Refusing to remove an unexpected folder: $resolved"
    }
    if ($DryRun) { Say "  [dry run] would remove $resolved" }
    else { Remove-Item -LiteralPath $resolved -Recurse -Force; Say "  Removed $resolved" }
  } else {
    if ($DryRun) { Say "  [dry run] would copy $sourcePlugin -> $target (keeping icons, logs and config.local.json)" }
    else {
      & robocopy $sourcePlugin $target /E /NFL /NDL /NJH /NJS | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "Copying the plugin failed (robocopy $LASTEXITCODE)." }
      Say "  Installed to $target" 'Green'
    }
  }

  if (-not $DryRun -and -not $NoRestart -and $exe -and ($closed -or $running.Count -eq 0)) {
    if (Ask 'Start Streonor now?') { Start-Process -FilePath $exe | Out-Null; Say '  Streonor started.' }
  }

  Say ''
  if ($Uninstall) {
    Say 'Done. The plugin is removed. Keys that used it are empty until you place other actions.' 'Green'
    Say 'Your Streonor profiles were not touched. A copy of the plugin was kept in:'
    Say "  $backupRoot"
  } else {
    Say 'Next steps' 'Cyan'
    Say '  1. Start (or restart) Streonor if it is not running.'
    Say '  2. Open your S15 profile. The category "StreonorDock" has 15 actions: Dock Key 1 ... Dock Key 15.'
    Say '  3. Drag them onto the keys with the S15 in LANDSCAPE, left to right:'
    Say '        top row:     11  12  13  14  15'
    Say '        middle row:   6   7   8   9  10'
    Say '        bottom row:   1   2   3   4   5     (Dock Key 1 is bottom-left)'
    Say '  4. In World of Warcraft install the StreonorDock addon, then /reload once so the keys show your icons.'
  }
  Finish 0
} catch {
  Write-Host ''
  Write-Host ('Something went wrong: ' + $_.Exception.Message) -ForegroundColor Red
  Finish 1
}
