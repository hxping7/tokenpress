@echo off
setlocal enabledelayedexpansion

REM ========================================
REM tokenpress VPS Deployment Script
REM gzip + split + SCP chunked (resume)
REM ========================================

cd /d "%~dp0"

echo ========================================
echo   tokenpress VPS Deployment
echo ========================================
echo.

REM Load host.conf
if not exist "host.conf" (
    echo [ERROR] host.conf not found
    pause
    exit /b 1
)

REM Load deploy.conf
if not exist "deploy.conf" (
    echo [ERROR] deploy.conf not found
    pause
    exit /b 1
)

REM Parse config files
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("host.conf") do (
    set "%%a=%%b"
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in ("deploy.conf") do (
    set "%%a=%%b"
)

REM Validate
if not defined VPS_HOST (
    echo [ERROR] VPS_HOST not defined in host.conf
    pause
    exit /b 1
)
if not defined SSH_KEY (
    echo [ERROR] SSH_KEY not defined in host.conf
    pause
    exit /b 1
)
if not defined JWT_SECRET (
    echo [ERROR] JWT_SECRET not defined in deploy.conf
    pause
    exit /b 1
)

REM Defaults
if not defined VPS_USER set VPS_USER=root
if not defined VPS_PORT set VPS_PORT=22
if not defined SITE_PATH set SITE_PATH=/root/tokenpress
if not defined CHUNK_MB set CHUNK_MB=50

set SSH_CMD=ssh -i "%SSH_KEY%" -p %VPS_PORT% -o StrictHostKeyChecking=no -o ConnectTimeout=10
set SCP_CMD=scp -i "%SSH_KEY%" -P %VPS_PORT% -o StrictHostKeyChecking=no -o ConnectTimeout=10

echo VPS: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
if defined DOMAIN echo Domain: %DOMAIN%
echo Site Path: %SITE_PATH%
echo Chunk Size: %CHUNK_MB%MB
echo.

if "%~1"=="" goto all
if "%~1"=="build" goto build
if "%~1"=="upload" goto upload
if "%~1"=="deploy" goto deploy
if "%~1"=="update" goto update
if "%~1"=="all" goto all
goto usage

:build
echo [1/3] Building Docker images...
echo.

echo Building backend image...
docker build --no-cache --target backend -t tokenpress-backend:latest .
if errorlevel 1 (
    echo [ERROR] Backend build failed
    pause
    exit /b 1
)
echo Backend image built successfully.

echo Building frontend image...
docker build --no-cache --target frontend -t tokenpress-frontend:latest .
if errorlevel 1 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)
echo Frontend image built successfully.

echo.
echo Compressing images (gzip)...
docker save tokenpress-backend:latest | gzip > tokenpress-backend.tar.gz
if errorlevel 1 (
    echo [ERROR] Failed to compress backend
    pause
    exit /b 1
)
for %%A in (tokenpress-backend.tar.gz) do echo   backend: %%~zA bytes

docker save tokenpress-frontend:latest | gzip > tokenpress-frontend.tar.gz
if errorlevel 1 (
    echo [ERROR] Failed to compress frontend
    pause
    exit /b 1
)
for %%A in (tokenpress-frontend.tar.gz) do echo   frontend: %%~zA bytes

if exist "tokenpress-backend.tar" del "tokenpress-backend.tar"
if exist "tokenpress-frontend.tar" del "tokenpress-frontend.tar"

echo.
echo [1/3] Build complete!
echo.
goto end

:upload
echo [2/3] Uploading to VPS (chunked + resume)...
echo.

if not exist "tokenpress-backend.tar.gz" (
    echo [ERROR] tokenpress-backend.tar.gz not found. Run 'build' first.
    pause
    exit /b 1
)
if not exist "tokenpress-frontend.tar.gz" (
    echo [ERROR] tokenpress-frontend.tar.gz not found. Run 'build' first.
    pause
    exit /b 1
)

REM Create VPS upload directory
%SSH_CMD% %VPS_USER%@%VPS_HOST% "mkdir -p /root/tokenpress-upload"

REM Split and upload each image
call :upload_image tokenpress-backend.tar.gz backend
if errorlevel 1 goto upload_fail
call :upload_image tokenpress-frontend.tar.gz frontend
if errorlevel 1 goto upload_fail

REM Upload config files
echo Uploading config files...
%SCP_CMD% deploy.sh docker-compose.yml deploy.conf Dockerfile nginx.conf %VPS_USER%@%VPS_HOST%:%SITE_PATH%/

REM Merge chunks on VPS
echo Merging chunks on VPS...
%SSH_CMD% %VPS_USER%@%VPS_HOST% "cd /root/tokenpress-upload && cat backend_* > /root/tokenpress-backend.tar.gz && cat frontend_* > /root/tokenpress-frontend.tar.gz && cd /root && rm -rf tokenpress-upload && echo 'Merge done'"

echo.
echo [2/3] Upload complete!
echo.
goto end

:upload_fail
echo [ERROR] Upload failed
pause
exit /b 1

:upload_image
REM %1=filename, %2=prefix
set IMG_FILE=%~1
set IMG_PREFIX=%~2
set CHUNK_SIZE=%CHUNK_MB%m

echo Splitting %IMG_FILE% into %CHUNK_SIZE% chunks...
del /q %IMG_PREFIX%_part_* 2>nul
bash -c "split -b %CHUNK_SIZE% -d --suffix-length=3 %IMG_FILE% %IMG_PREFIX%_part_"
if errorlevel 1 (
    echo [ERROR] Failed to split %IMG_FILE%
    exit /b 1
)

set TOTAL=0
for %%F in (%IMG_PREFIX%_part_*) do set /a TOTAL+=1
echo   %TOTAL% chunks to upload

REM Upload each chunk with resume check
set COUNT=0
for %%F in (%IMG_PREFIX%_part_*) do (
    set /a COUNT+=1
    set CHUNK_NAME=%%F

    REM Check if chunk already exists on VPS (same size = skip)
    %SSH_CMD% %VPS_USER%@%VPS_HOST% "test -f /root/tokenpress-upload/!CHUNK_NAME! && stat -c %%s /root/tokenpress-upload/!CHUNK_NAME!" > _vps_size.txt 2>nul
    set VPS_SIZE=
    for /f %%S in (_vps_size.txt) do set VPS_SIZE=%%S
    set LOCAL_SIZE=%%~zF

    if "!VPS_SIZE!"=="!LOCAL_SIZE!" (
        echo   [!COUNT!/%TOTAL%] !CHUNK_NAME! already uploaded, skipping
    ) else (
        echo   [!COUNT!/%TOTAL%] Uploading !CHUNK_NAME!...
        %SCP_CMD% !CHUNK_NAME! %VPS_USER%@%VPS_HOST%:/root/tokenpress-upload/
        if errorlevel 1 (
            echo   [WARN] Upload failed, retrying...
            %SCP_CMD% !CHUNK_NAME! %VPS_USER%@%VPS_HOST%:/root/tokenpress-upload/
            if errorlevel 1 (
                echo [ERROR] Failed to upload !CHUNK_NAME!
                del _vps_size.txt 2>nul
                del /q %IMG_PREFIX%_part_* 2>nul
                exit /b 1
            )
        )
    )
)
del _vps_size.txt 2>nul
del /q %IMG_PREFIX%_part_* 2>nul
echo   %IMG_PREFIX% upload done.
exit /b 0

:deploy
echo [3/3] Deploying on VPS...
echo.

%SSH_CMD% %VPS_USER%@%VPS_HOST% "cd %SITE_PATH% && sed -i 's/\r$//' deploy.sh && chmod +x deploy.sh && ./deploy.sh"
if errorlevel 1 (
    echo [ERROR] Remote deployment failed
    pause
    exit /b 1
)

echo [3/3] Deploy complete!
echo.
goto end

:update
echo [UPDATE] Full update cycle...
echo.
call :build
call :upload
call :deploy
echo Update complete!
goto end

:all
call :build
call :upload
call :deploy
goto end

:usage
echo Usage: %~nx0 {build^|upload^|deploy^|update^|all}
echo.
echo Commands:
echo   build  - Build Docker images + gzip compress
echo   upload - Split + SCP chunked upload with resume
echo   deploy - Run deploy.sh on VPS
echo   update - Build + Upload + Deploy
echo   all    - Same as update (default)
pause
exit /b 1

:end
echo ========================================
echo   Deployment Complete
echo ========================================
pause
