@echo off
setlocal
cd /d "%~dp0"
title StreonorDock - build icon library
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build-IconLibrary.ps1"
exit /b %errorlevel%
