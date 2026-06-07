@echo off
setlocal enabledelayedexpansion

REM ========================================
REM TokenPress: Backup Database (Windows)
REM Usage: backup-db.bat <project-dir> local|vps
REM
REM Dependencies: Docker Desktop (local mode), OpenSSH Client (vps mode), PowerShell 5.1+
REM ========================================

set PROJECT_DIR=%~1
set MODE=%~2
if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: backup-db.bat ^<project-dir^> ^<local^|vps^>
    exit /b 1
)
if "%MODE%"=="" set MODE=local

set CONFIG_FILE="%PROJECT_DIR%\deploy.conf"
set HOST_FILE="%PROJECT_DIR%\host.conf"
set BACKUP_DIR=%PROJECT_DIR%\data\backups

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
if "%SITE_PATH%"=="" set SITE_PATH=/root/yourdomain

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM ISO-like timestamp via PowerShell
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"`) do set TIMESTAMP=%%t

set BACKUP_FILE=%PROJECT_DIR%\data\backups\yourdomain-db-backup-%TIMESTAMP%.db

echo [BACKUP] ========================================
echo [BACKUP]  TokenPress Database Backup
echo [BACKUP]  Mode: %MODE%
echo [BACKUP]  Time: %DATE% %TIME%
echo.

if /i "%MODE%"=="local" (
    REM === Local Docker backup ===
    echo [BACKUP] Step 1/3: Checking local containers...
    docker ps --format "{{.Names}}" | findstr "yourdomain-backend" >nul 2>&1
    if errorlevel 1 (
        echo [BACKUP] [WARN] yourdomain-backend container not running
        if exist "%PROJECT_DIR%\data\yourdomain.db" (
            echo [BACKUP]   Found local database file
            copy /Y "%PROJECT_DIR%\data\yourdomain.db" "%BACKUP_FILE%" >nul
            goto backup_done
        )
        echo [BACKUP] [WARN] No database found to backup
        exit /b 0
    )

    echo [BACKUP] Step 2/3: Copying database from container...
    docker cp yourdomain-backend:/app/data/yourdomain.db "%BACKUP_FILE%" 2>nul
    if errorlevel 1 (
        docker cp yourdomain-backend:/usr/src/app/data/yourdomain.db "%BACKUP_FILE%" 2>nul
    )
    if errorlevel 1 (
        echo [BACKUP] [ERROR] Failed to copy database from container
        exit /b 10
    )
    echo [BACKUP]   Database exported from container

) else if /i "%MODE%"=="vps" (
    REM === VPS backup ===
    if "%VPS_HOST%"=="" (
        echo [BACKUP] [ERROR] VPS_HOST not defined in host.conf
        exit /b 2
    )
    where ssh >nul 2>&1
    if errorlevel 1 (
        echo [BACKUP] [ERROR] ssh.exe not found in PATH
        exit /b 3
    )

    set SSH_OPTS=-i "%SSH_KEY%" -p %VPS_PORT% -o StrictHostKeyChecking=no -o ConnectTimeout=10

    echo [BACKUP] Step 1/3: Checking VPS connectivity...
    ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "echo OK" >nul 2>&1
    if errorlevel 1 (
        echo [BACKUP] [ERROR] Cannot connect to VPS %VPS_USER%@%VPS_HOST%
        exit /b 4
    )
    echo [BACKUP]   SSH connected

    echo [BACKUP] Step 2/3: Copying database from VPS...
    ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% ^
        "docker cp yourdomain-backend:/app/data/yourdomain.db /tmp/yourdomain-db-temp.db 2>/dev/null || docker cp yourdomain-backend:/usr/src/app/data/yourdomain.db /tmp/yourdomain-db-temp.db 2>/dev/null || (test -f %SITE_PATH%/data/yourdomain.db && cp %SITE_PATH%/data/yourdomain.db /tmp/yourdomain-db-temp.db)" >nul 2>&1

    scp %SSH_OPTS% %VPS_USER%@%VPS_HOST%:/tmp/yourdomain-db-temp.db "%BACKUP_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [BACKUP] [WARN] No database found on VPS
        if exist "%BACKUP_FILE%" del "%BACKUP_FILE%" 2>nul
        exit /b 0
    )
    ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "rm -f /tmp/yourdomain-db-temp.db" >nul 2>&1
    echo [BACKUP]   Database downloaded from VPS
)

:backup_done
REM Step 3: Generate SHA256 checksum
echo [BACKUP] Step 3/3: Generating checksum...
for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "(Get-FileHash -Path '%BACKUP_FILE%' -Algorithm SHA256).Hash.ToLower()"`) do (
    echo %%s  yourdomain-db-backup-%TIMESTAMP%.db > "%BACKUP_FILE%.sha256"
)
for %%A in ("%BACKUP_FILE%") do echo [BACKUP]   Size: %%~zA bytes
echo [BACKUP]   SHA256 saved

REM Cleanup old backups (keep 10 newest)
echo [BACKUP] Cleaning old backups...
pushd "%PROJECT_DIR%\data\backups"
set COUNT=0
for /f "delims=" %%f in ('dir /b /o-d yourdomain-db-backup-*.db 2^>nul') do (
    set /a COUNT+=1
    if !COUNT! gtr 10 (
        if exist "%%f" del "%%f" >nul 2>&1
        if exist "%%f.sha256" del "%%f.sha256" >nul 2>&1
    )
)
popd

echo [BACKUP] ========================================
echo [BACKUP]  Backup Complete!
echo [BACKUP]  File: %BACKUP_FILE%
echo [BACKUP] ========================================
exit /b 0
