@echo off
setlocal
cd /d "%~dp0"
echo Removing the StreonorDock plugin from Streonor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-StreonorDock.ps1" -Uninstall
exit /b %errorlevel%
