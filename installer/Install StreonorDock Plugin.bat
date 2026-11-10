@echo off
setlocal
cd /d "%~dp0"
echo Installing the StreonorDock plugin for Streonor...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-StreonorDock.ps1"
exit /b %errorlevel%
