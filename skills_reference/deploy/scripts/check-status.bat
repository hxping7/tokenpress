@echo off
setlocal enabledelayedexpansion

REM ========================================
REM TokenPress: Check Deployment Status (Windows)
REM Usage: check-status.bat <project-dir> local|vps
REM
REM Dependencies: Docker Desktop (local mode), OpenSSH Client (vps mode), PowerShell 5.1+
REM ========================================

set PROJECT_DIR=%~1
set MODE=%~2
if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: check-status.bat ^<project-dir^> ^<local^|vps^>
    exit /b 1
)
if "%MODE%"=="" set MODE=local

set CONFIG_FILE="%PROJECT_DIR%\deploy.conf"
set HOST_FILE="%PROJECT_DIR%\host.conf"

if exist %CONFIG_FILE% (
    for /f "usebackq tokens=1,* delims==" %%a in (%CONFIG_FILE%) do (
        if not "%%b"=="" set "%%a=%%b"
    )
)
if exist %HOST_FILE% (
    for /f "usebackq tokens=1,* delims==" %%a in (%HOST_FILE%) do (
        if not "%%b"=="" set "%%a=%%b"
    )
)
if "%HTTP_PORT%"=="" set HTTP_PORT=8080
if "%SITE_PATH%"=="" set SITE_PATH=/root/yourdomain

echo [STATUS] ========================================
echo [STATUS]  TokenPress Deployment Status
echo [STATUS]  Mode: %MODE%
echo [STATUS]  Time: %DATE% %TIME%
echo.

if /i "%MODE%"=="local" (
    REM === Local Docker status ===
    docker --version >nul 2>&1
    if errorlevel 1 (
        echo [STATUS] [DOCKER] Not available in PATH
    ) else (
        for /f "tokens=*" %%v in ('docker --version') do echo [STATUS] [DOCKER] %%v
        docker compose version >nul 2>&1 && (
            for /f "tokens=*" %%v in ('docker compose version') do echo [STATUS] [COMPOSE] %%v
        ) || (
            echo [STATUS] [COMPOSE] Not available
        )
    )
    echo.

    echo [STATUS] [IMAGES]---
    for %%i in (yourdomain-backend:latest yourdomain-frontend:latest) do (
        for /f "tokens=*" %%s in ('docker images %%i --format "{{.Size}}" 2^>nul') do echo [STATUS]   %%i: %%s
    )
    echo.

    echo [STATUS] [CONTAINERS]---
    for %%c in (yourdomain-backend yourdomain-frontend yourdomain-nginx) do (
        for /f "tokens=*" %%s in ('docker ps -a --filter "name=%%c" --format "{{.Status}}" 2^>nul') do echo [STATUS]   %%c: %%s
    )
    echo.

    echo [STATUS] [HEALTH] API http://localhost:%HTTP_PORT%/api/v1/health...
    powershell -NoProfile -Command ^
        "try { $r = Invoke-WebRequest -Uri 'http://localhost:%HTTP_PORT%/api/v1/health' -TimeoutSec 5 -UseBasicParsing; echo \"[STATUS]   HTTP $($r.StatusCode) OK\" } catch { echo \"[STATUS]   FAILED ($($_.Exception.Message))\"" 2>nul

) else if /i "%MODE%"=="vps" (
    REM === VPS status ===
    if "%VPS_HOST%"=="" (
        echo [STATUS] [VPS] Host not configured
        exit /b 2
    )
    where ssh >nul 2>&1
    if errorlevel 1 (
        echo [STATUS] [VPS] ssh.exe not found
        exit /b 3
    )

    set SSH_OPTS=-i "%SSH_KEY%" -p %VPS_PORT% -o StrictHostKeyChecking=no -o ConnectTimeout=10

    echo [STATUS] [VPS] %VPS_USER%@%VPS_HOST%:%VPS_PORT%
    ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "echo OK" >nul 2>&1 && (
        echo [STATUS]   SSH: Connected
    ) || (
        echo [STATUS]   SSH: FAILED
        exit /b 1
    )

    for /f "tokens=*" %%v in ('ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "docker --version 2>/dev/null || echo NOT INSTALLED"') do echo [STATUS] [DOCKER] %%v
    echo.

    echo [STATUS] [IMAGES]---
    for %%i in (yourdomain-backend:latest yourdomain-frontend:latest) do (
        for /f "tokens=*" %%s in ('ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "docker images %%i --format '{{.Size}}' 2>/dev/null || echo N/A"') do echo [STATUS]   %%i: %%s
    )
    echo.

    echo [STATUS] [CONTAINERS]---
    for %%c in (yourdomain-backend yourdomain-frontend yourdomain-nginx) do (
        for /f "tokens=*" %%s in ('ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "docker ps -a --filter name=%%c --format '{{.Status}}' 2>/dev/null || echo N/A"') do echo [STATUS]   %%c: %%s
    )
    echo.

    echo [STATUS] [HEALTH] http://%VPS_HOST%:%HTTP_PORT%/api/v1/health...
    powershell -NoProfile -Command ^
        "try { $r = Invoke-WebRequest -Uri 'http://%VPS_HOST%:%HTTP_PORT%/api/v1/health' -TimeoutSec 5 -UseBasicParsing; echo \"[STATUS]   HTTP $($r.StatusCode) OK\" } catch { echo \"[STATUS]   FAILED ($($_.Exception.Message))\"" 2>nul
)

echo [STATUS] ========================================
echo [STATUS]  Status check complete
echo [STATUS] ========================================
exit /b 0
