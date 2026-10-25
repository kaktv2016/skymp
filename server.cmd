@echo off
node "%~dp0rp-gamemode\scripts\start-server.cjs" %*
exit /b %errorlevel%
