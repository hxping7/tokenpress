@echo off
setlocal enabledelayedexpansion

REM ========================================
REM TokenPress: Generate Deployment Report (Windows)
REM Usage: generate-report.bat <project-dir> <mode> <build> <backup> <upload> <deploy> <verify>
REM
REM Parameters:
REM   mode: local|vps
REM   build/backup/upload/deploy: success|failed|skipped|N/A
REM   verify: true|false|skipped
REM
REM Output: markdown file saved to .deploy-state/
REM ========================================

set PROJECT_DIR=%~1
set MODE=%~2
set BUILD_RESULT=%~3
set BACKUP_RESULT=%~4
set UPLOAD_RESULT=%~5
set DEPLOY_RESULT=%~6
set VERIFY_RESULT=%~7

if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: generate-report.bat ^<project-dir^> ^<mode^> ^<build^> ^<backup^> ^<upload^> ^<deploy^> ^<verify^>
    exit /b 1
)
if "%MODE%"=="" set MODE=local
if "%BUILD_RESULT%"=="" set BUILD_RESULT=skipped
if "%BACKUP_RESULT%"=="" set BACKUP_RESULT=skipped
if "%UPLOAD_RESULT%"=="" set UPLOAD_RESULT=N/A
if "%DEPLOY_RESULT%"=="" set DEPLOY_RESULT=skipped
if "%VERIFY_RESULT%"=="" set VERIFY_RESULT=skipped

set CONFIG_FILE="%PROJECT_DIR%\deploy.conf"
set HOST_FILE="%PROJECT_DIR%\host.conf"
set STATE_DIR=%PROJECT_DIR%\.deploy-state

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
if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

REM Timestamp via PowerShell
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"`) do set TIMESTAMP=%%t

REM Git info
set GIT_COMMIT=N/A
set GIT_BRANCH=N/A
if exist "%PROJECT_DIR%\.git" (
    for /f "usebackq delims=" %%c in (`cd /d "%PROJECT_DIR%" && git rev-parse --short HEAD 2^>nul`) do set GIT_COMMIT=%%c
    for /f "usebackq delims=" %%b in (`cd /d "%PROJECT_DIR%" && git rev-parse --abbrev-ref HEAD 2^>nul`) do set GIT_BRANCH=%%b
)

REM Image sizes
set BACKEND_SIZE=N/A
set FRONTEND_SIZE=N/A
if exist "%PROJECT_DIR%\yourdomain-backend.tar.gz" (
    for %%A in ("%PROJECT_DIR%\yourdomain-backend.tar.gz") do set BACKEND_SIZE=%%~zA bytes
) else if exist "%PROJECT_DIR%\yourdomain-backend.tar" (
    for %%A in ("%PROJECT_DIR%\yourdomain-backend.tar") do set BACKEND_SIZE=%%~zA bytes (uncompressed^)
)
if exist "%PROJECT_DIR%\yourdomain-frontend.tar.gz" (
    for %%A in ("%PROJECT_DIR%\yourdomain-frontend.tar") do set FRONTEND_SIZE=%%~zA bytes
) else if exist "%PROJECT_DIR%\yourdomain-frontend.tar" (
    for %%A in ("%PROJECT_DIR%\yourdomain-frontend.tar") do set FRONTEND_SIZE=%%~zA bytes (uncompressed^)
)

REM Determine overall
set OVERALL=PASS
set "FAILED_STEPS="
for %%s in (BUILD BACKUP UPLOAD DEPLOY) do (
    set "VAR=!%%s_RESULT!"
    if "!VAR!"=="failed" (
        set OVERALL=FAIL
        set "FAILED_STEPS=!FAILED_STEPS! %%s"
    )
)
if "%VERIFY_RESULT%"=="false" (
    set OVERALL=FAIL
    set "FAILED_STEPS=!FAILED_STEPS! VERIFY"
)

REM Write report
set REPORT_FILE=%STATE_DIR%\deploy-report-%MODE%-%TIMESTAMP%.md

(
echo # TokenPress Deployment Report
echo.
echo ^| Field ^| Value ^|
echo ^|------^|-------^|
echo ^| Deployment Mode ^| %MODE% ^|
echo ^| Target ^| %VPS_USER%@%VPS_HOST%:%VPS_PORT% ^|
echo ^| Site Path ^| %SITE_PATH% ^|
echo ^| HTTP Port ^| %HTTP_PORT% ^|
echo ^| Domain ^| %DOMAIN% ^|
echo ^| Date ^| %DATE% %TIME% ^|
echo ^| Git Branch ^| %GIT_BRANCH% ^|
echo ^| Git Commit ^| %GIT_COMMIT% ^|
echo.
echo ## Step Results
echo.
echo ^| Step ^| Result ^|
echo ^|------^|--------^|
echo ^| 1. Build ^| %BUILD_RESULT% ^|
echo ^| 2. Backup DB ^| %BACKUP_RESULT% ^|
echo ^| 3. Upload ^| %UPLOAD_RESULT% ^|
echo ^| 4. Deploy ^| %DEPLOY_RESULT% ^|
echo ^| 5. Health Check ^| %VERIFY_RESULT% ^|
echo.
echo ## Overall
echo.
echo **%OVERALL%**
) > "%REPORT_FILE%"

if not "%FAILED_STEPS%"=="" (
    echo **Failed steps:**%FAILED_STEPS% >> "%REPORT_FILE%"
)

(
echo.
echo ## Artifacts
echo.
echo ^| Image ^| Size ^|
echo ^|------^|------^|
echo ^| yourdomain-backend ^| %BACKEND_SIZE% ^|
echo ^| yourdomain-frontend ^| %FRONTEND_SIZE% ^|
) >> "%REPORT_FILE%"

echo [REPORT] ========================================
echo [REPORT]  Deployment Report
echo [REPORT]  File: %REPORT_FILE%
echo [REPORT]  Result: %OVERALL%
echo [REPORT] ========================================
echo.
type "%REPORT_FILE%"

exit /b 0
