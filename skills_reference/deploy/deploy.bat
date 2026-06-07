@echo off
setlocal enabledelayedexpansion

REM ========================================
REM TokenPress Deploy (Windows Main Entry)
REM Usage: deploy.bat <local|vps> [skip-build]
REM
REM Orchestrates full deployment workflow:
REM   1. Build images          (skip with "skip-build")
REM   2. Check current status
REM   3. Backup database
REM   4. Upload / Deploy
REM   5. Health check
REM   6. Generate report
REM ========================================

set "MODE=%~1"
set "SKIP_BUILD=%~2"
if "%MODE%"=="" (
    echo ========================================
    echo  TokenPress Deployment Tool
    echo ========================================
    echo.
    echo Usage:  deploy.bat ^<mode^> [skip-build]
    echo.
    echo Modes:
    echo   local     Deploy to local Docker
    echo   vps       Build locally, upload to VPS
    echo.
    echo Options:
    echo   skip-build  Skip Docker build (use existing images)
    echo.
    echo Examples:
    echo   deploy.bat local
    echo   deploy.bat vps
    echo   deploy.bat vps skip-build
    echo ========================================
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0scripts"
set "PROJECT_DIR=%~dp0.."
set "RESULT_DIR=%PROJECT_DIR%\.deploy-state"
set "START_TIME=%DATE% %TIME%"

if not exist "%RESULT_DIR%" mkdir "%RESULT_DIR%"

echo ========================================
echo  TokenPress Deployment
echo  Mode: %MODE%
echo  Start: %START_TIME%
echo ========================================
echo.

REM ---- Step 1: Build ----
set BUILD_RESULT=skipped
if /i "%SKIP_BUILD%" NEQ "skip-build" (
    echo [1/6] Building Docker images...
    call "%SCRIPT_DIR%\build-images.bat" "%PROJECT_DIR%"
    if errorlevel 1 (
        set BUILD_RESULT=failed
        echo [FATAL] Build failed. Aborting.
        call "%SCRIPT_DIR%\generate-report.bat" "%PROJECT_DIR%" "%MODE%" %BUILD_RESULT% skipped skipped skipped skipped
        exit /b 1
    )
    set BUILD_RESULT=success
) else (
    echo [1/6] Skipped (skip-build flag)
)
echo.

REM ---- Step 2: Check status ----
echo [2/6] Checking current deployment status...
call "%SCRIPT_DIR%\check-status.bat" "%PROJECT_DIR%" "%MODE%"
echo.

REM ---- Step 3: Backup DB ----
set BACKUP_RESULT=skipped
echo [3/6] Backing up database...
call "%SCRIPT_DIR%\backup-db.bat" "%PROJECT_DIR%" "%MODE%"
set BACKUP_RESULT=success
echo.

REM ---- Step 4: Upload / Deploy ----
set UPLOAD_RESULT=N/A
set DEPLOY_RESULT=skipped

if /i "%MODE%"=="vps" (
    echo [4/6] Uploading to VPS...
    call "%SCRIPT_DIR%\upload-vps.bat" "%PROJECT_DIR%"
    if errorlevel 1 (
        set UPLOAD_RESULT=failed
        echo [FATAL] Upload failed.
        call "%SCRIPT_DIR%\generate-report.bat" "%PROJECT_DIR%" "%MODE%" %BUILD_RESULT% %BACKUP_RESULT% %UPLOAD_RESULT% skipped skipped
        exit /b 1
    )
    set UPLOAD_RESULT=success

    echo [5/6] Deploying on VPS...
    call "%SCRIPT_DIR%\deploy-vps.bat" "%PROJECT_DIR%"
    if errorlevel 1 (
        set DEPLOY_RESULT=failed
    ) else (
        set DEPLOY_RESULT=success
    )
) else (
    echo [4/6] Deploying locally...
    call "%SCRIPT_DIR%\deploy-local.bat" "%PROJECT_DIR%"
    if errorlevel 1 (
        set DEPLOY_RESULT=failed
    ) else (
        set DEPLOY_RESULT=success
    )
)
echo.

REM ---- Step 5: Health check ----
set VERIFY_RESULT=skipped
echo [5/6] Running health check...
call "%SCRIPT_DIR%\verify-health.bat" "%PROJECT_DIR%" "%MODE%"
if errorlevel 2 (
    set VERIFY_RESULT=false
) else if errorlevel 1 (
    set VERIFY_RESULT=warning
) else (
    set VERIFY_RESULT=true
)
echo.

REM ---- Step 6: Generate report ----
echo [6/6] Generating deployment report...
call "%SCRIPT_DIR%\generate-report.bat" "%PROJECT_DIR%" "%MODE%" %BUILD_RESULT% %BACKUP_RESULT% %UPLOAD_RESULT% %DEPLOY_RESULT% %VERIFY_RESULT%

echo ========================================
echo  Deployment Completed
echo  Started: %START_TIME%
echo  Ended:   %DATE% %TIME%
echo  Result:  Build=%BUILD_RESULT% / Deploy=%DEPLOY_RESULT% / Health=%VERIFY_RESULT%
echo ========================================
pause
