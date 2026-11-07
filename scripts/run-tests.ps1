param()
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
 foreach($runtime in @('C:\Program Files\nodejs\node.exe','C:\Program Files (x86)\Streonor\node\node20.exe')){
  if(-not (Test-Path -LiteralPath $runtime)){throw "Missing runtime: $runtime"}
  & $runtime --version
  & $runtime --test tests
  if($LASTEXITCODE -ne 0){throw "Tests failed: $runtime"}
 }
}finally{Pop-Location}
