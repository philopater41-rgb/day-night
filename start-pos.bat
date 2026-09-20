@echo off
setlocal enabledelayedexpansion
title Day ^& Night POS Launcher
cd /d "%~dp0"

echo ====================================================
echo      Day ^& Night POS - Starting Application
echo ====================================================
echo.

:: 1. Check if POS Server is already running on port 3002
netstat -ano | findstr :3002 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] Day ^& Night POS Server is already running.
    goto launch_ui
)

:: 2. Free port 3002 if lingering process exists
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3002 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 3. Launch server in background minimized window
echo [+] Starting POS Server on port 3002...
start "Day & Night POS Server" /min node "node_modules\next\dist\bin\next" start -p 3002

:: 4. Wait until server is listening on port 3002
echo [+] Waiting for server to initialize...
set count=0
:wait_loop
set /a count+=1
powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
netstat -ano | findstr :3002 | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [+] Server is ready!
    goto launch_ui
)
if !count! geq 30 goto timeout_ui
goto wait_loop

:timeout_ui
echo [!] Server took longer than expected to initialize. Opening browser...

:launch_ui
echo [+] Opening Day ^& Night POS application window...

:: Launch with Microsoft Edge (Kiosk Printing)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\DayNightPOS\edge-pos-profile" --app=http://localhost:3002
    exit
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\DayNightPOS\edge-pos-profile" --app=http://localhost:3002
    exit
)

:: Launch with Google Chrome (Kiosk Printing)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\DayNightPOS\chrome-pos-profile" --app=http://localhost:3002
    exit
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\DayNightPOS\chrome-pos-profile" --app=http://localhost:3002
    exit
)

:: Fallback
start msedge --kiosk-printing --user-data-dir="%LOCALAPPDATA%\DayNightPOS\edge-pos-profile" --app=http://localhost:3002 2>nul || start http://localhost:3002
exit
