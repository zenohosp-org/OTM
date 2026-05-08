@echo off
setlocal

echo.
echo   OT Frontend - Local Dev
echo   ---------------------------------
echo   URL     : http://localhost:3002
echo   Backend : http://localhost:8085
echo   Auth    : mock (no SSO needed)
echo   Press Ctrl+C to stop
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed. Install from https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

call npm run dev

pause
