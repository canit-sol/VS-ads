@echo off
title CANIT Skope Dashboard
cd /d "%~dp0"
echo Starting CANIT Skope...
"%APPDATA%\Antigravity\bin\agy-node.cmd" server.js
pause
