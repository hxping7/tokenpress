@echo off
setlocal enabledelayedexpansion

REM ========================================
REM TokenPress: Upload to VPS with resume (Windows)
REM Usage: upload-vps.bat <project-dir>
REM
REM Features:
REM   - Chunked upload with SHA256 integrity verification
REM   - Cross-session resume via fixed temp dir + manifest
REM   - Auto-retry with backoff (3 attempts per chunk)
REM   - Pure Windows (PowerShell for SHA256/chunking, no gzip/split needed)
REM
REM Dependencies: PowerShell 5.1+, OpenSSH Client
REM ========================================

set PROJECT_DIR=%~1
if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: upload-vps.bat ^<project-dir^>
    exit /b 1
)

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
if "%SITE_PATH%"=="" set SITE_PATH=/root/yourdomain
if "%CHUNK_MB%"=="" set CHUNK_MB=50

set REMOTE_UPLOAD_DIR=/root/yourdomain-upload
set MAX_RETRIES=3
set TIMESTAMP=%DATE:/=-%_%TIME::=-%
set TIMESTAMP=%TIMESTAMP: =%

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

echo [UPLOAD] ========================================
echo [UPLOAD]  TokenPress VPS Uploader (Full Resume)
echo [UPLOAD]  Target: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
echo [UPLOAD]  Chunk:  %CHUNK_MB%MB ^| Retries: %MAX_RETRIES%
echo [UPLOAD]  SSH Key: %SSH_KEY%
echo.

REM Check prerequisites
where ssh >nul 2>&1
if errorlevel 1 (
    echo [UPLOAD] [ERROR] ssh.exe not found in PATH
    echo [UPLOAD] [INFO]  Install OpenSSH Client: 'Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0'
    exit /b 3
)
where scp >nul 2>&1
if errorlevel 1 (
    echo [UPLOAD] [ERROR] scp.exe not found in PATH
    exit /b 3
)

REM Check source files
if not exist "%PROJECT_DIR%\yourdomain-backend.tar.gz" if not exist "%PROJECT_DIR%\yourdomain-backend.tar" (
    echo [UPLOAD] [ERROR] yourdomain-backend.tar.gz/tar not found. Run build first.
    exit /b 4
)
if not exist "%PROJECT_DIR%\yourdomain-frontend.tar.gz" if not exist "%PROJECT_DIR%\yourdomain-frontend.tar" (
    echo [UPLOAD] [ERROR] yourdomain-frontend.tar.gz/tar not found. Run build first.
    exit /b 4
)

set SSH_OPTS=-i "%SSH_KEY%" -p %VPS_PORT% -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o ServerAliveInterval=30

REM Step 1: Create remote directories
echo [UPLOAD] Step 1/5: Preparing remote directories...
ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "mkdir -p %REMOTE_UPLOAD_DIR% && mkdir -p %SITE_PATH%"
echo [UPLOAD]   Remote temp: %REMOTE_UPLOAD_DIR%
echo.

REM Step 2-3: Upload each file
set FILE_LIST=yourdomain-backend yourdomain-frontend
for %%f in (%FILE_LIST%) do (
    set PREFIX=%%f

    REM Determine file extension (.tar.gz or .tar)
    if exist "%PROJECT_DIR%\%%f.tar.gz" (
        set EXT=.tar.gz
    ) else if exist "%PROJECT_DIR%\%%f.tar" (
        set EXT=.tar
    ) else (
        echo [UPLOAD]   %%f: no archive found, skipping
        continue
    )

    set LOCAL_FILE=%PROJECT_DIR%\%%f!EXT!
    set REMOTE_FILE=%REMOTE_UPLOAD_DIR%/%%f.tar.gz
    set REMOTE_MANIFEST=%REMOTE_UPLOAD_DIR%/%%f_manifest.txt

    echo [UPLOAD] ===== File: %%f!EXT! =====
    for %%S in ("!LOCAL_FILE!") do echo [UPLOAD] Size: %%~zS bytes

    REM Get local SHA256 (PowerShell)
    for /f "usebackq delims=" %%s in (`powershell -NoProfile -Command "(Get-FileHash -Path '!LOCAL_FILE!' -Algorithm SHA256).Hash.ToLower()"`) do set LOCAL_SHA=%%s

    REM Phase A: Check if file already fully uploaded on VPS
    for /f "usebackq delims=" %%s in (`ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "sha256sum !REMOTE_FILE! 2>/dev/null || echo MISSING"`) do set REMOTE_SHA_LINE=%%s
    for /f %%a in ("!REMOTE_SHA_LINE!") do set REMOTE_SHA=%%a

    if "!REMOTE_SHA!"=="!LOCAL_SHA!" (
        echo [UPLOAD]   File already uploaded, skipping
        echo.
        continue
    )
    echo [UPLOAD]   Need upload (remote: !REMOTE_SHA:~0,16!...)

    REM Phase B: Split into chunks using PowerShell
    echo [UPLOAD]   Splitting into %CHUNK_MB%MB chunks...
    if exist "%STATE_DIR%\%%f_part_*" del /q "%STATE_DIR%\%%f_part_*" 2>nul

    REM Build a temporary PowerShell script for chunking
    set CHUNK_PS=%STATE_DIR%\chunk_%%f.ps1
    (
        echo $chunkSize = %CHUNK_MB% * 1MB
        echo $file = '!LOCAL_FILE:\=\\!'
        echo $outPrefix = '%STATE_DIR:\=\\%\\%%f_part_'
        echo $buf = New-Object byte[] ([Math]::Min($chunkSize, 100MB^)^)
        echo $fs = [System.IO.File]::OpenRead($file^)
        echo $part = 0
        echo try {
        echo     while (($read = $fs.Read($buf, 0, $buf.Length^)) -gt 0^) {
        echo         $name = $outPrefix + $part.ToString('000'^)
        echo         [System.IO.File]::WriteAllBytes($name, $buf[0..($read-1^)]^)
        echo         $part++
        echo     }
        echo } finally { $fs.Close(^) }
        echo Write-Host "Split done: $part chunks"
    ) > "!CHUNK_PS!"

    for /f "tokens=3" %%c in ('powershell -NoProfile -ExecutionPolicy Bypass -File "!CHUNK_PS!"') do set TOTAL_CHUNKS=%%c
    del "!CHUNK_PS!" 2>nul
    if not defined TOTAL_CHUNKS (
        echo [UPLOAD] [ERROR] PowerShell chunking failed
        exit /b 5
    )

    REM Generate chunk checksums
    set CHUNK_CHECKSUMS=%STATE_DIR%\%%f_checksums.txt
    if exist "!CHUNK_CHECKSUMS!" del "!CHUNK_CHECKSUMS!" 2>nul

    set CHKSUM_PS=%STATE_DIR%\cksum_%%f.ps1
    (
        echo $outDir = '%STATE_DIR:\=\\%'
        echo $prefix = '%%f_part_'
        echo $outFile = '%STATE_DIR:\=\\%\\%%f_checksums.txt'
        echo $files = Get-ChildItem -Path $outDir -Filter "$prefix*" ^| Sort-Object Name
        echo foreach ($f in $files^) {
        echo     $hash = (Get-FileHash -Path $f.FullName -Algorithm SHA256^).Hash.ToLower(^)
        echo     ('{0} {1}' -f $f.Name, $hash^) ^| Out-File -Append -FilePath $outFile -Encoding ascii
        echo }
        echo Write-Host "$($files.Count^) chunks indexed"
    ) > "!CHKSUM_PS!"

    for /f "tokens=1" %%c in ('powershell -NoProfile -ExecutionPolicy Bypass -File "!CHKSUM_PS!"') do (
        if not defined TOTAL_CHUNKS_VER set TOTAL_CHUNKS_VER=%%c
    )
    del "!CHKSUM_PS!" 2>nul

    echo [UPLOAD]   !TOTAL_CHUNKS! chunks total

    REM Phase C: Upload chunks with resume
    set NEED_UPLOAD=0
    set COUNT=0
    for %%c in ("%STATE_DIR%\%%f_part_*") do (
        if exist "%%c" (
            set /a COUNT+=1
            for %%n in ("%%~nxc") do set CHUNK_NAME=%%~nxn
            set "CHUNK_PATH=%%c"

            REM Get expected SHA from local checksum file
            set CHK_CMD=
            for /f "usebackq tokens=2" %%s in (`findstr /b "!CHUNK_NAME!" "!CHUNK_CHECKSUMS!"`) do set CHUNK_SHA=%%s

            REM Check remote chunk (resume)
            for /f "usebackq delims=" %%s in (`ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "sha256sum %REMOTE_UPLOAD_DIR%/!CHUNK_NAME! 2>/dev/null || echo MISSING"`) do set REMOTE_CHUNK_LINE=%%s
            for /f %%a in ("!REMOTE_CHUNK_LINE!") do set REMOTE_CHUNK_SHA=%%a

            if "!REMOTE_CHUNK_SHA!"=="!CHUNK_SHA!" (
                echo   [!COUNT!/!TOTAL_CHUNKS!] !CHUNK_NAME! verified ^(skip^)
            ) else (
                call :upload_chunk "!CHUNK_PATH!" "!CHUNK_NAME!" "!CHUNK_SHA!" "!COUNT!" "!TOTAL_CHUNKS!"
                if errorlevel 1 set /a NEED_UPLOAD+=1
            )
        )
    )

    if !NEED_UPLOAD! gtr 0 (
        echo [UPLOAD] [ERROR] !NEED_UPLOAD! chunks failed
        exit /b 6
    )

    REM Phase D: Upload manifest to VPS
    echo [UPLOAD]   Uploading manifest...
    scp %SSH_OPTS% "!CHUNK_CHECKSUMS!" %VPS_USER%@%VPS_HOST%:!REMOTE_MANIFEST!

    REM Phase E: Verify all chunks on VPS, then merge
    echo [UPLOAD]   Verifying all chunks on VPS...
    set MISSING=0
    for /f "usebackq tokens=1,*" %%a in ("!CHUNK_CHECKSUMS!") do (
        ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "test -f %REMOTE_UPLOAD_DIR%/%%a" >nul 2>&1
        if errorlevel 1 (
            echo   [WARN] Missing chunk: %%a
            set /a MISSING+=1
        )
    )

    if !MISSING! gtr 0 (
        echo [UPLOAD] [ERROR] !MISSING! chunks missing on VPS
        exit /b 7
    )

    echo [UPLOAD]   All chunks present, merging...
    ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "cat %REMOTE_UPLOAD_DIR%/%%f_part_* > !REMOTE_FILE!"

    REM Verify final integrity
    for /f "usebackq delims=" %%s in (`ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "sha256sum !REMOTE_FILE! 2>/dev/null || echo MISSING"`) do set FINAL_LINE=%%s
    for /f %%a in ("!FINAL_LINE!") do set FINAL_SHA=%%a

    if not "!FINAL_SHA!"=="!LOCAL_SHA!" (
        echo [UPLOAD] [ERROR] Integrity check FAILED for %%f!EXT!
        echo [UPLOAD]   Local:  !LOCAL_SHA!
        echo [UPLOAD]   Remote: !FINAL_SHA!
        ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "rm -f !REMOTE_FILE!" >nul 2>&1
        exit /b 8
    )
    echo [UPLOAD]   File integrity verified ^(SHA256 match^)

    REM Cleanup remote chunks + local chunks
    ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "rm -f %REMOTE_UPLOAD_DIR%/%%f_part_* !REMOTE_MANIFEST!" >nul 2>&1
    if exist "%STATE_DIR%\%%f_part_*" del /q "%STATE_DIR%\%%f_part_*" 2>nul
    if exist "!CHUNK_CHECKSUMS!" del "!CHUNK_CHECKSUMS!" 2>nul
    echo.
)

REM Step 4: Upload config files
echo [UPLOAD] Step 4/5: Uploading deployment files...
for %%f in (deploy.sh docker-compose.yml deploy.conf Dockerfile nginx.conf) do (
    if exist "%PROJECT_DIR%\%%f" (
        echo [UPLOAD]   Uploading %%f...
        scp %SSH_OPTS% "%PROJECT_DIR%\%%f" %VPS_USER%@%VPS_HOST%:%SITE_PATH%/ >nul 2>&1
    )
)
echo.

REM Step 5: Cleanup remote temp
echo [UPLOAD] Step 5/5: Cleaning up...
ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "rmdir %REMOTE_UPLOAD_DIR% 2>/dev/null; exit 0" >nul 2>&1

echo [UPLOAD] ========================================
echo [UPLOAD]  Upload Complete!
echo [UPLOAD]  Target: %VPS_USER%@%VPS_HOST%:%SITE_PATH%
echo [UPLOAD] ========================================
exit /b 0

REM ============================================================
REM Helper: upload a single chunk with retry + integrity check
REM ============================================================
:upload_chunk
set CHUNK_PATH=%~1
set CHUNK_NAME=%~2
set CHUNK_SHA=%~3
set COUNT=%~4
set TOTAL=%~5
set ATTEMPT=0

:retry_loop
set /a ATTEMPT+=1
echo  [!COUNT!/%TOTAL%] Uploading %CHUNK_NAME% ^(attempt !ATTEMPT!/%MAX_RETRIES%^)...
scp %SSH_OPTS% "%CHUNK_PATH%" %VPS_USER%@%VPS_HOST%:%REMOTE_UPLOAD_DIR%/ >nul 2>&1

if not errorlevel 1 (
    for /f "usebackq delims=" %%s in (`ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "sha256sum %REMOTE_UPLOAD_DIR%/%CHUNK_NAME% 2>/dev/null || echo FAIL"`) do set UPLOADED_LINE=%%s
    for /f %%a in ("!UPLOADED_LINE!") do set UPLOADED_SHA=%%a

    if "!UPLOADED_SHA!"=="%CHUNK_SHA%" (
        echo  [!COUNT!/%TOTAL%] %CHUNK_NAME% uploaded and verified
        exit /b 0
    ) else (
        echo  [!COUNT!/%TOTAL%] Checksum mismatch ^(!UPLOADED_SHA:~0,8!...^)
    )
) else (
    echo  [!COUNT!/%TOTAL%] SCP failed
)
if !ATTEMPT! lss %MAX_RETRIES% (
    ping -n 3 127.0.0.1 >nul
    goto retry_loop
)
echo  [!COUNT!/%TOTAL%] [ERROR] Failed after %MAX_RETRIES% attempts
exit /b 1
