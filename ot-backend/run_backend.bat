@echo off
setlocal

echo.
echo   OT Backend - Local Dev
echo   ---------------------------------
echo   URL     : http://localhost:8085
echo   Profile : local (application-local.properties)
echo   DB      : Supabase
echo   Press Ctrl+C to stop
echo.

where java >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java is not installed. Install Java 21 from https://adoptium.net
    pause
    exit /b 1
)

cd /d "%~dp0"

call mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local

pause
