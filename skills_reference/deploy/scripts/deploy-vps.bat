@echo off
setlocal enabledelayedexpansion

REM ========================================
REM Token00: Deploy on Remote VPS (Windows)
REM Usage: deploy-vps.bat <project-dir>
REM
REM Executes deploy.sh on VPS via SSH.
REM Dependencies: OpenSSH Client
REM ========================================

set PROJECT_DIR=%~1
if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: deploy-vps.bat ^<project-dir^>
    exit /b 1
)

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

if "%VPS_HOST%"=="" (
    echo [ERROR] VPS_HOST not defined in host.conf
    exit /b 2
)
if "%SSH_KEY%"=="" (
    echo [ERROR] SSH_KEY not defined in host.conf
    exit /b 2
)
if "%VPS_USER%"=="" set VPS_USER=root
if "%VPS_PORT%"=="" set VPS_PORT=22
if "%SITE_PATH%"=="" set SITE_PATH=/root/token00

set SSH_OPTS=-i "%SSH_KEY%" -p %VPS_PORT% -o StrictHostKeyChecking=no -o ConnectTimeout=10

echo [DEPLOY] ========================================
echo [DEPLOY]  Token00 VPS Deploy
echo [DEPLOY]  Target: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
echo [DEPLOY]  Path:   %SITE_PATH%
echo [DEPLOY]  Time:   %DATE% %TIME%
echo.

REM Check ssh
where ssh >nul 2>&1
if errorlevel 1 (
    echo [DEPLOY] [ERROR] ssh.exe not found in PATH
    exit /b 3
)

REM Step 1: Check SSH
echo [DEPLOY] Step 1/4: Checking SSH...
ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "echo OK" >nul 2>&1
if errorlevel 1 (
    echo [DEPLOY] [ERROR] Cannot connect to %VPS_USER%@%VPS_HOST%
    exit /b 4
)
echo [DEPLOY]   SSH connected

REM Step 2: Prepare deploy script
echo [DEPLOY] Step 2/4: Preparing deploy.sh...
ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% ^
    "cd '%SITE_PATH%' && sed -i 's/\r$//' deploy.sh 2>/dev/null && chmod +x deploy.sh"
echo [DEPLOY]   deploy.sh ready

REM Step 3: Execute deploy.sh
echo [DEPLOY] Step 3/4: Running deploy.sh (this may take several minutes)...
echo.
ssh %SSH_OPTS% -t %VPS_USER%@%VPS_HOST% "cd '%SITE_PATH%' && ./deploy.sh 2>&1"
set DEPLOY_EXIT=%errorlevel%
echo.

if %DEPLOY_EXIT% neq 0 (
    echo [DEPLOY] [ERROR] deploy.sh failed with exit code %DEPLOY_EXIT%
    exit /b 5
)
echo [DEPLOY]   deploy.sh completed

REM Step 4: Check containers
echo [DEPLOY] Step 4/4: Checking deployed containers...
ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% ^
    "docker ps --filter 'name=token00-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo [DEPLOY] ========================================
echo [DEPLOY]  VPS Deploy Complete!
echo [DEPLOY] ========================================
echo [DEPLOY]   Site: %VPS_USER%@%VPS_HOST%:%SITE_PATH%
echo [DEPLOY] ========================================
exit /b 0
