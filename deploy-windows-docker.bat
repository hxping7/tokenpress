@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set PROJECT_DIR=%~dp0
set DEPLOY_CONF=%PROJECT_DIR%deploy.conf

echo ========================================
echo   Token00 Local Docker Deployment
echo ========================================
echo.

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not running
    pause
    exit /b 1
)

REM Check deploy.conf
if not exist "%DEPLOY_CONF%" (
    echo [ERROR] deploy.conf not found
    echo Please copy deploy.conf.sample to deploy.conf
    pause
    exit /b 1
)

REM Read deploy.conf
for /f "usebackq tokens=1,* delims==" %%a in ("%DEPLOY_CONF%") do (
    set "%%a=%%b"
)

if not defined JWT_SECRET (
    echo [ERROR] JWT_SECRET not defined in deploy.conf
    pause
    exit /b 1
)

REM Set defaults
if not defined HTTP_PORT set HTTP_PORT=8080
if not defined HTTPS_PORT set HTTPS_PORT=8443
if not defined SITE_URL set SITE_URL=http://localhost:%HTTP_PORT%

echo HTTP Port: %HTTP_PORT%
echo HTTPS Port: %HTTPS_PORT%
echo Site URL: %SITE_URL%
echo.

REM Check port
netstat -ano | findstr ":%HTTP_PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [WARNING] Port %HTTP_PORT% is in use, cleaning up...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%HTTP_PORT%" ^| findstr "LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    ping -n 3 127.0.0.1 >nul
)

echo [1/3] Generating config...

REM Generate .env file only if not exists
if not exist .env (
    echo HTTP_PORT=%HTTP_PORT%> .env
    echo HTTPS_PORT=%HTTPS_PORT%>> .env
    echo JWT_SECRET=%JWT_SECRET%>> .env
    echo SITE_URL=%SITE_URL%>> .env
    echo FRONTEND_URL=%SITE_URL%>> .env
    echo NEXT_PUBLIC_API_URL=/api/v1>> .env
    echo NEXT_PUBLIC_SITE_URL=%SITE_URL%>> .env
    echo .env file created
) else (
    echo .env already exists, skipping generation
)

echo.
echo [2/3] Building and starting...
echo.

docker-compose down >nul 2>&1
docker-compose up --build -d
if errorlevel 1 (
    echo [ERROR] Failed to start
    pause
    exit /b 1
)

echo.
echo [3/3] Waiting for services...
echo.

REM Wait for backend health check
set RETRY=0
:wait_loop
timeout /t 2 /nobreak >nul
docker inspect --format={{.State.Health.Status}} token00-backend 2>nul | findstr "healthy" >nul
if errorlevel 1 (
    set /a RETRY+=1
    if !RETRY! LSS 15 (
        echo Waiting for backend... (!RETRY!/15)
        goto wait_loop
    )
    echo [ERROR] Backend not healthy
    docker logs token00-backend --tail 20
    pause
    exit /b 1
)

REM Check frontend is responding
set RETRY=0
:wait_frontend
curl -s -o /dev/null -w "" http://localhost:%HTTP_PORT%/ 2>nul
if errorlevel 1 (
    set /a RETRY+=1
    if !RETRY! LSS 10 (
        echo Waiting for frontend... (!RETRY!/10)
        timeout /t 2 /nobreak >nul
        goto wait_frontend
    )
    echo [WARNING] Frontend may not be ready, but continuing...
)

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo   HTTP:   http://localhost:%HTTP_PORT%
echo   HTTPS:  https://localhost:%HTTPS_PORT% (need SSL)
echo   Login:  admin / admin123 (CHANGE PASSWORD ON FIRST LOGIN!)
echo.
echo   Stop:  docker-compose down
echo   Logs:  docker logs token00-backend
echo ========================================
pause
