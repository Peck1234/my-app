@echo off
REM One command to get the app working: starts the backend + Cloudflare tunnel
REM (detached, survives this window closing), then starts Expo in tunnel mode.
REM Just double-click this file, or run "start.bat" from cmd.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"
