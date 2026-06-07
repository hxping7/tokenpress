@echo off
setlocal enabledelayedexpansion

REM ========================================
REM TokenPress: Deploy to Local Docker (Windows)
REM Usage: deploy-local.bat <project-dir>
REM
REM Dependencies: Docker Desktop, PowerShell 5.1+
REM ========================================

set PROJECT_DIR=%~1
if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: deploy-local.bat ^<project-dir^>
    exit /b 1
)

set CONFIG_FILE="%PROJECT_DIR%\deploy.conf"
if exist %CONFIG_FILE% (
    for /f "usebackq tokens=1,* delims==" %%a in (%CONFIG_FILE%) do (
        if not "%%b"=="" set "%%a=%%b"
    )
)
if "%HTTP_PORT%"=="" set HTTP_PORT=8080
if "%HTTPS_PORT%"=="" set HTTPS_PORT=8443
if "%SITE_URL%"=="" set SITE_URL=http://localhost:%HTTP_PORT%

set STATE_DIR=%PROJECT_DIR%\.deploy-state
if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

echo [DEPLOY] ========================================
echo [DEPLOY]  TokenPress Local Docker Deployment
echo [DEPLOY]  Time: %DATE% %TIME%
echo.

REM Step 1: Check Docker
echo [DEPLOY] Step 1/5: Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [DEPLOY] [ERROR] Docker Desktop not found
    exit /b 2
)
docker compose version >nul 2>&1
if errorlevel 1 (
    echo [DEPLOY] [ERROR] Docker Compose not available
    exit /b 3
)
echo [DEPLOY]   Docker OK

REM Step 2: Load pre-built images
echo [DEPLOY] Step 2/5: Loading images from archives...
if exist "%PROJECT_DIR%\yourdomain-backend.tar" (
    echo [DEPLOY]   Loading backend...
    docker load -i "%PROJECT_DIR%\yourdomain-backend.tar" >nul 2>&1
    if errorlevel 1 echo [DEPLOY]   [WARN] Backend load failed, will build
)
if exist "%PROJECT_DIR%\yourdomain-frontend.tar" (
    echo [DEPLOY]   Loading frontend...
    docker load -i "%PROJECT_DIR%\yourdomain-frontend.tar" >nul 2>&1
    if errorlevel 1 echo [DEPLOY]   [WARN] Frontend load failed, will build
)
echo.

REM Step 3: Generate .env
echo [DEPLOY] Step 3/5: Generating .env...
(
    echo HTTP_PORT=%HTTP_PORT%
    echo HTTPS_PORT=%HTTPS_PORT%
    echo JWT_SECRET=%JWT_SECRET%
    echo SITE_URL=%SITE_URL%
    echo FRONTEND_URL=%SITE_URL%
    echo NEXT_PUBLIC_API_URL=/api/v1
    echo NEXT_PUBLIC_SITE_URL=%SITE_URL%
) > "%PROJECT_DIR%\.env"
echo [DEPLOY]   .env generated

REM Step 4: Start services
echo [DEPLOY] Step 4/5: Starting services...
cd /d "%PROJECT_DIR%"
docker compose down --remove-orphans >nul 2>&1

if exist "%PROJECT_DIR%\yourdomain-backend.tar" (
    docker compose up -d
) else (
    docker compose up --build -d
)
if errorlevel 1 (
    echo [DEPLOY] [ERROR] Failed to start services
    exit /b 4
)

REM Step 5: Wait for health
echo [DEPLOY] Step 5/5: Waiting for backend health (max 90s)...
set MAX_WAIT=90
set WAITED=0

:health_wait
if !WAITED! geq %MAX_WAIT% goto health_timeout

for /f "tokens=*" %%s in ('docker inspect --format="{{.State.Health.Status}}" yourdomain-backend 2^>nul') do set HEALTH=%%s
if "!HEALTH!"=="healthy" (
    echo [DEPLOY]   Backend healthy after !WAITED!s
    goto deploy_done
)

REM Also try direct HTTP check
for /f "usebackq delims=" %%c in (`powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:%HTTP_PORT%/api/v1/health' -TimeoutSec 3 -UseBasicParsing).StatusCode } catch { echo '000' }"`) do set HTTP_CODE=%%c
echo [DEPLOY]   [!WAITED!s] Backend: !HEALTH! / HTTP: !HTTP_CODE!

ping -n 6 127.0.0.1 >nul
set /a WAITED+=5
goto health_wait

:health_timeout
echo [DEPLOY] [WARN] Backend not healthy after %MAX_WAIT%s
docker ps -a --filter "name=yourdomain-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker logs yourdomain-backend --tail 30 2>nul

:deploy_done
echo [DEPLOY] ========================================
echo [DEPLOY]  Deploy Complete!
echo [DEPLOY] ========================================
echo [DEPLOY]   HTTP:   http://localhost:%HTTP_PORT%
echo [DEPLOY]   Frontend: http://localhost:%HTTP_PORT%/
echo [DEPLOY]   Login:  hxp / hxp123
echo [DEPLOY] ========================================
exit /b 0
