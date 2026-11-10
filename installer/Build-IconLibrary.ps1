<#
.SYNOPSIS
  Builds the local icon library the StreonorDock plugin uses to show real spell/item icons on the controller keys.
  Double-click "Build Icon Library.bat" instead of running this by hand.
.DESCRIPTION
  1. Asks for your OK (download size and sources are shown).
  2. Downloads two community files from their ORIGINAL sources to your PC (resumable):
       - the WoW: Forever icon pack  github.com/qcy-hash/wow-forever-icons-png  (about 1.7 GB)
       - the community listfile      github.com/wowdev/wow-listfile              (about 150 MB)
  3. Converts the icons to small 144 px key images in  %LOCALAPPDATA%\StreonorDock\icons  (about 300 MB).
  4. Deletes the downloads again (about 4 GB) unless -KeepDownloads is given.
  The icons are Blizzard artwork for your personal use; this plugin neither contains nor redistributes them.
  You can close the window at any time and run it again: finished downloads and finished icons are kept.
.PARAMETER Yes           Do not ask (the tests use this).
.PARAMETER NoPause       Do not wait for Enter at the end.
.PARAMETER DryRun        Only check the prerequisites and print the plan.
.PARAMETER KeepDownloads Keep the downloaded pack and listfile.
.PARAMETER WorkDir       Where downloads and the extracted pack live (default %LOCALAPPDATA%\StreonorDock\IconBuilder).
.PARAMETER LibraryDir    Where the icon images go (default %LOCALAPPDATA%\StreonorDock\icons, which the plugin reads).
.PARAMETER MinFreeGB     Free space required on the work drive (default 6).
.PARAMETER NodePath, Tool, PackUrl, ListfileUrl  Overrides (the tests use them).
#>
param(
  [switch]$Yes,
  [switch]$NoPause,
  [switch]$DryRun,
  [switch]$KeepDownloads,
  [string]$WorkDir = (Join-Path $env:LOCALAPPDATA 'StreonorDock\IconBuilder'),
  [string]$LibraryDir = (Join-Path $env:LOCALAPPDATA 'StreonorDock\icons'),
  [double]$MinFreeGB = 6,
  [string]$NodePath,
  [string]$Tool,
  [string]$PackUrl = 'https://github.com/qcy-hash/wow-forever-icons-png/releases/download/v1.0.0/png_icons.zip',
  [string]$ListfileUrl = 'https://github.com/wowdev/wow-listfile/releases/latest/download/community-listfile.csv'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

function Say([string]$text, [string]$color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ask([string]$question) {
  if ($Yes) { return $true }
  $answer = Read-Host "$question [Y/N]"
  return ($answer -match '^(y|yes|j|ja|s|si|oui)$')
}
function Finish([int]$code) {
  if (-not $NoPause -and -not $Yes) { Write-Host ''; Read-Host 'Press Enter to close this window' | Out-Null }
  exit $code
}
function Free-Space([string]$path) {
  $root = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($path))
  return ([System.IO.DriveInfo]::new($root)).AvailableFreeSpace
}
function GB([double]$bytes) { return ('{0:N1} GB' -f ($bytes / 1GB)) }
function MB([double]$bytes) { return ('{0:N0} MB' -f ($bytes / 1MB)) }

function Find-Node {
  if ($NodePath) { if (Test-Path -LiteralPath $NodePath) { return $NodePath } else { throw "Node was not found at $NodePath" } }
  # Streonor ships its own Node.js: no extra install needed.
  $dirs = @()
  try {
    $cmd = (Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\StreamDock.sdPlugin\shell\open\command' -ErrorAction Stop).'(default)'
    if ($cmd -match '^"([^"]+)"') { $dirs += Split-Path -Parent $Matches[1] }
  } catch { }
  $dirs += "${env:ProgramFiles(x86)}\Streonor", "$env:ProgramFiles\Streonor"
  foreach ($d in $dirs) {
    if (-not $d) { continue }
    $found = Get-ChildItem -LiteralPath (Join-Path $d 'node') -Filter 'node*.exe' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  $onPath = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($onPath) { return $onPath.Source }
  return $null
}
function Find-Tool {
  if ($Tool) { return $Tool }
  foreach ($p in @((Join-Path $PSScriptRoot 'tools\build-icon-library.js'), (Join-Path $PSScriptRoot '..\scripts\build-icon-library.js'))) {
    if (Test-Path -LiteralPath $p) { return (Resolve-Path -LiteralPath $p).Path }
  }
  return $null
}

# Final URL and size of a download (follows redirects).
function Probe-Url([string]$url) {
  $req = [System.Net.HttpWebRequest]::Create($url)
  $req.Method = 'HEAD'; $req.AllowAutoRedirect = $true; $req.UserAgent = 'StreonorDock-IconBuilder'; $req.Timeout = 30000
  $resp = $req.GetResponse()
  try { return @{ Url = $resp.ResponseUri.AbsoluteUri; Length = [int64]$resp.ContentLength } } finally { $resp.Close() }
}
# Resumable download: file.part is continued with a Range request; finished files are kept.
function Download([string]$url, [string]$dest, [int64]$expected, [string]$label) {
  if ((Test-Path -LiteralPath $dest) -and (Get-Item -LiteralPath $dest).Length -eq $expected) { Say "  $label already downloaded." 'Green'; return }
  $part = "$dest.part"
  $final = (Probe-Url $url).Url
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    $have = if (Test-Path -LiteralPath $part) { (Get-Item -LiteralPath $part).Length } else { 0 }
    if ($have -gt $expected) { Remove-Item -LiteralPath $part -Force; $have = 0 }
    if ($have -eq $expected) { break }
    $req = [System.Net.HttpWebRequest]::Create($final)
    $req.UserAgent = 'StreonorDock-IconBuilder'; $req.Timeout = 60000; $req.ReadWriteTimeout = 60000
    if ($have -gt 0) { $req.AddRange([int64]$have); Say ("  Resuming {0} at {1}" -f $label, (MB $have)) }
    try {
      $resp = $req.GetResponse()
      if ($have -gt 0 -and [int]$resp.StatusCode -ne 206) { $have = 0 }   # server ignored the range: start over
      $mode = if ($have -gt 0) { [System.IO.FileMode]::Append } else { [System.IO.FileMode]::Create }
      $out = [System.IO.File]::Open($part, $mode, [System.IO.FileAccess]::Write)
      $in = $resp.GetResponseStream()
      $buf = New-Object byte[] 262144
      $done = $have; $clock = [Diagnostics.Stopwatch]::StartNew(); $last = -2000
      try {
        while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
          $out.Write($buf, 0, $n); $done += $n
          if ($clock.ElapsedMilliseconds - $last -ge 2000) {
            $last = $clock.ElapsedMilliseconds
            Write-Host ("`r  {0}: {1} of {2} ({3:N0}%)    " -f $label, (MB $done), (MB $expected), (100.0 * $done / $expected)) -NoNewline
          }
        }
      } finally { $out.Dispose(); $in.Dispose(); $resp.Close() }
      Write-Host ''
    } catch {
      Say ("`n  Download interrupted ({0}). Trying again ({1}/5)..." -f $_.Exception.Message, $attempt) 'Yellow'
      Start-Sleep -Seconds 3
    }
  }
  $size = if (Test-Path -LiteralPath $part) { (Get-Item -LiteralPath $part).Length } else { 0 }
  if ($size -ne $expected) { throw "The download of $label did not finish ($size of $expected bytes). Run this again later; it continues where it stopped." }
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }
  Move-Item -LiteralPath $part -Destination $dest
  Say "  $label downloaded." 'Green'
}
# The folder inside the extracted pack that holds the icon PNGs (layout of the zip is not assumed).
function Find-PackDir([string]$root) {
  $best = $null; $bestCount = 0
  foreach ($d in @($root) + @(Get-ChildItem -LiteralPath $root -Recurse -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })) {
    $count = @(Get-ChildItem -LiteralPath $d -Filter *.png -File -ErrorAction SilentlyContinue).Count
    if ($count -gt $bestCount) { $best = $d; $bestCount = $count }
  }
  if ($bestCount -lt 1) { return $null }
  return $best
}

try {
  Say ''
  Say 'StreonorDock - build the icon library' 'Cyan'
  Say ''
  Say 'This lets the Streonor keys show the real icons of your spells and items. Without it the keys show the spell/item'
  Say 'NAME on a coloured tile instead (the plugin works either way).'
  Say ''
  Say 'It will download, from the original sources, onto THIS PC:'
  Say '  1. the WoW: Forever icon pack     github.com/qcy-hash/wow-forever-icons-png   about 1.7 GB'
  Say '  2. the community listfile         github.com/wowdev/wow-listfile              about 150 MB'
  Say 'and turn them into small key images (about 300 MB) in:'
  Say "  $LibraryDir"
  Say 'The downloads (about 4 GB while working) are deleted afterwards. It takes a while; you can close the window and'
  Say 'start it again - it continues where it stopped. The icons are Blizzard artwork for your own use only.'
  Say ''

  $node = Find-Node
  if (-not $node) {
    throw "Node.js was not found.`nStreonor normally includes it: install Streonor first (then run this again).`nOr install Node.js from https://nodejs.org (LTS) and run this again."
  }
  $tool = Find-Tool
  if (-not $tool) { throw 'The icon builder script (tools\build-icon-library.js) was not found next to this file. Extract the whole release zip first.' }
  Say "Using Node.js: $node"

  New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
  $freeWork = Free-Space $WorkDir
  if ($freeWork -lt ($MinFreeGB * 1GB)) {
    throw ("Not enough free disk space on the drive for {0}.`nNeeded: about {1}, free: {2}.`nFree some space or choose another drive." -f $WorkDir, (GB ($MinFreeGB * 1GB)), (GB $freeWork))
  }
  New-Item -ItemType Directory -Force -Path $LibraryDir | Out-Null
  if ((Free-Space $LibraryDir) -lt 1GB) { throw "Less than 1 GB free for the icon library in $LibraryDir." }
  Say ("Free disk space: {0} (needed: about {1})" -f (GB $freeWork), (GB ($MinFreeGB * 1GB))) 'Green'

  $packInfo = Probe-Url $PackUrl
  $listInfo = Probe-Url $ListfileUrl
  Say ("Download sizes: icon pack {0}, listfile {1}" -f (GB $packInfo.Length), (MB $listInfo.Length))
  if ($DryRun) { Say 'Dry run: nothing downloaded or changed.' 'Yellow'; Finish 0 }
  if (-not (Ask ("Download about {0} from github.com now?" -f (GB ($packInfo.Length + $listInfo.Length))))) {
    Say 'Cancelled. Nothing was downloaded.' 'Yellow'
    Finish 0
  }

  $zip = Join-Path $WorkDir 'png_icons.zip'
  $csv = Join-Path $WorkDir 'community-listfile.csv'
  $packDir = Join-Path $WorkDir 'pack'
  $marker = Join-Path $WorkDir 'pack.extracted'

  Say ''
  Say 'Step 1 of 3: downloading (you can stop and continue later)' 'Cyan'
  Download $ListfileUrl $csv $listInfo.Length 'Listfile'
  if (-not (Test-Path -LiteralPath $marker)) { Download $PackUrl $zip $packInfo.Length 'Icon pack' }

  Say ''
  Say 'Step 2 of 3: unpacking the icon pack (a few minutes)' 'Cyan'
  if (-not (Test-Path -LiteralPath $marker)) {
    if (Test-Path -LiteralPath $packDir) { Remove-Item -LiteralPath $packDir -Recurse -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $packDir)
    Set-Content -LiteralPath $marker -Value 'ok' -Encoding ASCII
    Remove-Item -LiteralPath $zip -Force
  } else { Say '  Already unpacked.' 'Green' }
  $pngDir = Find-PackDir $packDir
  if (-not $pngDir) { throw 'No icon images were found in the downloaded pack.' }

  Say ''
  Say 'Step 3 of 3: creating the 144 px key images (several minutes)' 'Cyan'
  & $node $tool --pack $pngDir --listfile $csv --library $LibraryDir --size 144
  $code = $LASTEXITCODE
  if ($code -ne 0 -and $code -ne 2) { throw "The icon builder stopped with an error (code $code). Run this again; finished icons are kept." }
  $count = @(Get-ChildItem -LiteralPath $LibraryDir -Filter *.png -File -ErrorAction SilentlyContinue).Count
  if ($count -lt 1) { throw 'No icons were created.' }

  if (-not $KeepDownloads) {
    Say ''
    Say 'Cleaning up the downloads...'
    Remove-Item -LiteralPath $WorkDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Say ''
  Say "Done: $count icons are ready in $LibraryDir" 'Green'
  Say 'Next: restart Streonor so it reloads the plugin, then /reload in World of Warcraft. Your keys now show real icons.'
  Finish 0
} catch {
  Write-Host ''
  Write-Host ('Something went wrong: ' + $_.Exception.Message) -ForegroundColor Red
  Finish 1
}
