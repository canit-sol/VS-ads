@echo off
title VS Ads Intelligence Dashboard
cd /d "%~dp0"
echo Starting VS Ads Intelligence...
"%APPDATA%\Antigravity\bin\agy-node.cmd" server.js
pause
