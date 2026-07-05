@echo off
REM Meant to be launched automatically at Windows startup/logon (via the
REM Startup folder or Task Scheduler), NOT run manually for updates.
REM It only serves whatever was already built by start.bat/update.bat —
REM it does not pull, install, or rebuild anything, so it starts quickly.
cd /d "%~dp0"
call npm start
