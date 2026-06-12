@echo off
setlocal enabledelayedexpansion

REM ========================================
REM TokenPress: Build Docker Images (Windows)
REM Usage: build-images.bat <project-dir>
REM
REM Encoding: ASCII-safe output only.
REM   All non-ASCII output goes through PowerShell.
REM Dependency: Docker Desktop, PowerShell 5.1+
REM ========================================

set PROJECT_DIR=%~1
if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: build-images.bat ^<project-dir^>
    exit /b 1
)

set CONFIG_FILE="%PROJECT_DIR%\deploy.conf"
if exist %CONFIG_FILE% (
    for /f "usebackq tokens=1,* delims==" %%a in (%CONFIG_FILE%) do (
        if not "%%b"=="" set "%%a=%%b"
    )
)

echo [BUILD] ========================================
echo [BUILD]  TokenPress Docker Image Build (Windows)
echo [BUILD]  Time: %DATE% %TIME%
echo.

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [BUILD] [ERROR] Docker Desktop not found in PATH
    echo [BUILD] [INFO]  Start Docker Desktop and ensure docker.exe is in PATH
    exit /b 2
)
echo [BUILD]   Docker OK

REM ============================================================
REM PowerShell gzip: uses separate .ps1 script to avoid
REM escaping issues with GZipStream constructor in inline mode
REM ============================================================

REM Step 1/2: Build backend
echo [BUILD] Step 1/2: Building backend image...
cd /d "%PROJECT_DIR%"
docker build --target backend -t tokenpress-backend:latest .
if errorlevel 1 (
    echo [BUILD] [ERROR] Backend build FAILED
    echo [BUILD] [INFO]  Fix compilation errors then rebuild
    exit /b 3
)
echo [BUILD]   Backend built successfully

REM Export + compress backend
echo [BUILD]   Exporting backend image...
docker save tokenpress-backend:latest -o "%PROJECT_DIR%\tokenpress-backend.tar"
if %errorlevel% equ 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gzip-compress.ps1" "%PROJECT_DIR%\tokenpress-backend.tar" "%PROJECT_DIR%\tokenpress-backend.tar.gz"
    if errorlevel 1 (
        echo [BUILD] [WARN] PowerShell gzip failed, using uncompressed .tar
    ) else (
        if exist "%PROJECT_DIR%\tokenpress-backend.tar" del "%PROJECT_DIR%\tokenpress-backend.tar"
    )
)
echo.

REM Step 2/2: Build frontend
echo [BUILD] Step 2/2: Building frontend image...
docker build --no-cache --target frontend -t tokenpress-frontend:latest .
if errorlevel 1 (
    echo [BUILD] [ERROR] Frontend build FAILED
    echo [BUILD] [INFO]  Fix compilation errors then rebuild
    exit /b 4
)
echo [BUILD]   Frontend built successfully

REM Export + compress frontend
echo [BUILD]   Exporting frontend image...
docker save tokenpress-frontend:latest -o "%PROJECT_DIR%\tokenpress-frontend.tar"
if %errorlevel% equ 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gzip-compress.ps1" "%PROJECT_DIR%\tokenpress-frontend.tar" "%PROJECT_DIR%\tokenpress-frontend.tar.gz"
    if errorlevel 1 (
        echo [BUILD] [WARN] PowerShell gzip failed, using uncompressed .tar
    ) else (
        if exist "%PROJECT_DIR%\tokenpress-frontend.tar" del "%PROJECT_DIR%\tokenpress-frontend.tar"
    )
)
echo.

REM Generate SHA256 checksums via PowerShell (certutil alternative)
echo [BUILD] Generating SHA256 checksums...
if exist "%PROJECT_DIR%\tokenpress-backend.tar.gz" (
    for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "(Get-FileHash -Path '%PROJECT_DIR%\tokenpress-backend.tar.gz' -Algorithm SHA256).Hash.ToLower()"`) do (
        echo %%s  tokenpress-backend.tar.gz > "%PROJECT_DIR%\tokenpress-backend.tar.gz.sha256"
    )
) else if exist "%PROJECT_DIR%\tokenpress-backend.tar" (
    for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "(Get-FileHash -Path '%PROJECT_DIR%\tokenpress-backend.tar' -Algorithm SHA256).Hash.ToLower()"`) do (
        echo %%s  tokenpress-backend.tar > "%PROJECT_DIR%\tokenpress-backend.tar.sha256"
    )
)

if exist "%PROJECT_DIR%\tokenpress-frontend.tar.gz" (
    for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "(Get-FileHash -Path '%PROJECT_DIR%\tokenpress-frontend.tar.gz' -Algorithm SHA256).Hash.ToLower()"`) do (
        echo %%s  tokenpress-frontend.tar.gz > "%PROJECT_DIR%\tokenpress-frontend.tar.gz.sha256"
    )
) else if exist "%PROJECT_DIR%\tokenpress-frontend.tar" (
    for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "(Get-FileHash -Path '%PROJECT_DIR%\tokenpress-frontend.tar' -Algorithm SHA256).Hash.ToLower()"`) do (
        echo %%s  tokenpress-frontend.tar > "%PROJECT_DIR%\tokenpress-frontend.tar.sha256"
    )
)

REM Show sizes
echo [BUILD]   Artifacts:
if exist "%PROJECT_DIR%\tokenpress-backend.tar.gz" (
    for %%A in ("%PROJECT_DIR%\tokenpress-backend.tar.gz") do echo [BUILD]     backend.tar.gz: %%~zA bytes
)
if exist "%PROJECT_DIR%\tokenpress-frontend.tar.gz" (
    for %%A in ("%PROJECT_DIR%\tokenpress-frontend.tar.gz") do echo [BUILD]     frontend.tar.gz: %%~zA bytes
)
if exist "%PROJECT_DIR%\tokenpress-backend.tar" (
    for %%A in ("%PROJECT_DIR%\tokenpress-backend.tar") do echo [BUILD]     backend.tar: %%~zA bytes ^(uncompressed^)
)
if exist "%PROJECT_DIR%\tokenpress-frontend.tar" (
    for %%A in ("%PROJECT_DIR%\tokenpress-frontend.tar") do echo [BUILD]     frontend.tar: %%~zA bytes ^(uncompressed^)
)

echo.
echo [BUILD] ========================================
echo [BUILD]  Build Complete!
echo [BUILD] ========================================
exit /b 0
