@echo off
setlocal enabledelayedexpansion

REM ========================================
REM Token00: Verify Deployment Health (Windows)
REM Usage: verify-health.bat <project-dir> local|vps
REM
REM Exit codes: 0=healthy, 1=degraded, 2=failed
REM Dependencies: PowerShell 5.1+, Docker Desktop (local), OpenSSH (vps)
REM ========================================

set PROJECT_DIR=%~1
set MODE=%~2
if "%PROJECT_DIR%"=="" (
    echo [ERROR] Usage: verify-health.bat ^<project-dir^> ^<local^|vps^>
    exit /b 2
)
if "%MODE%"=="" set MODE=local

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

set VERDICT=pass
set REPORT_FILE=%STATE_DIR%\verify-%MODE%-report.txt

echo [VERIFY] ========================================
echo [VERIFY]  Token00 Deployment Health
echo [VERIFY]  Mode: %MODE%
echo [VERIFY]  Time: %DATE% %TIME%
echo.

if /i "%MODE%"=="local" (
    REM === Local health check ===
    echo [VERIFY] [1/5] Containers...
    set ALL_OK=true
    for %%c in (token00-backend token00-frontend token00-nginx) do (
        docker ps --filter "name=%%c" --filter "status=running" --format "{{.Names}}" | findstr "%%c" >nul 2>&1
        if errorlevel 1 (
            echo [VERIFY]   [WARN] %%c NOT RUNNING
            set ALL_OK=false
        ) else ( echo [VERIFY]   [OK] %%c running )
    )
    if "!ALL_OK!"=="false" set VERDICT=warn
    echo.

    echo [VERIFY] [2/5] API health...
    for /f "usebackq delims=" %%c in (`powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%HTTP_PORT%/api/v1/health' -TimeoutSec 10 -UseBasicParsing; echo $r.StatusCode } catch { echo '000' }"`) do set API_CODE=%%c
    if "!API_CODE!"=="200" ( echo [VERIFY]   [OK] HTTP !API_CODE! ) else ( echo [VERIFY]   [ERROR] HTTP !API_CODE! & set VERDICT=fail )
    echo.

    echo [VERIFY] [3/5] Frontend...
    for /f "usebackq delims=" %%c in (`powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%HTTP_PORT%/' -TimeoutSec 10 -UseBasicParsing -Method Head; echo $r.StatusCode } catch { try { $r = Invoke-WebRequest -Uri 'http://localhost:%HTTP_PORT%/' -TimeoutSec 10 -UseBasicParsing; echo $r.StatusCode } catch { echo '000' } }"`) do set FRONT_CODE=%%c
    if "!FRONT_CODE!"=="200" ( echo [VERIFY]   [OK] HTTP !FRONT_CODE! ) else if "!FRONT_CODE!"=="301" ( echo [VERIFY]   [OK] HTTP !FRONT_CODE! (redirect^) ) else if "!FRONT_CODE!"=="302" ( echo [VERIFY]   [OK] HTTP !FRONT_CODE! (redirect^) ) else ( echo [VERIFY]   [WARN] HTTP !FRONT_CODE! & if not "!VERDICT!"=="fail" set VERDICT=warn )
    echo.

    echo [VERIFY] [4/5] Response time...
    for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "$sw=[System.Diagnostics.Stopwatch]::StartNew(); try { $r=Invoke-WebRequest -Uri 'http://localhost:%HTTP_PORT%/api/v1/health' -TimeoutSec 10 -UseBasicParsing; $sw.Stop(); echo $sw.ElapsedMilliseconds } catch { echo 'timeout' }"`) do set API_TIME=%%t
    if "!API_TIME!"=="timeout" ( echo [VERIFY]   [WARN] timeout & if not "!VERDICT!"=="fail" set VERDICT=warn
    ) else if !API_TIME! leq 500 ( echo [VERIFY]   [OK] !API_TIME!ms
    ) else if !API_TIME! leq 2000 ( echo [VERIFY]   [OK] !API_TIME!ms (acceptable^) ) else ( echo [VERIFY]   [WARN] !API_TIME!ms (slow^) & if not "!VERDICT!"=="fail" set VERDICT=warn )

) else if /i "%MODE%"=="vps" (
    REM === VPS health check ===
    set SSH_OPTS=-i "%SSH_KEY%" -p %VPS_PORT% -o StrictHostKeyChecking=no -o ConnectTimeout=10

    echo [VERIFY] [1/5] VPS containers...
    set ALL_OK=true
    for %%c in (token00-backend token00-frontend token00-nginx) do (
        for /f "tokens=*" %%s in ('ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "docker ps --filter name=%%c --filter status=running --format '{{.Names}}' 2>/dev/null"') do (
            if "%%s"=="%%c" ( echo [VERIFY]   [OK] %%c running ) else ( echo [VERIFY]   [WARN] %%c NOT RUNNING & set ALL_OK=false )
        )
    )
    if "!ALL_OK!"=="false" set VERDICT=warn
    echo.

    set API_URL=http://%VPS_HOST%:%HTTP_PORT%/api/v1/health
    echo [VERIFY] [2/5] API health...
    for /f "usebackq delims=" %%c in (`powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%API_URL%' -TimeoutSec 15 -UseBasicParsing; echo $r.StatusCode } catch { echo '000' }"`) do set API_CODE=%%c
    if "!API_CODE!"=="200" ( echo [VERIFY]   [OK] HTTP !API_CODE! ) else ( echo [VERIFY]   [ERROR] HTTP !API_CODE! & set VERDICT=fail )
    echo.

    echo [VERIFY] [3/5] Frontend...
    for /f "usebackq delims=" %%c in (`powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://%VPS_HOST%:%HTTP_PORT%/' -TimeoutSec 15 -UseBasicParsing -Method Head; echo $r.StatusCode } catch { try { Invoke-WebRequest -Uri 'http://%VPS_HOST%:%HTTP_PORT%/' -TimeoutSec 15 -UseBasicParsing } catch { echo '000' } }"`) do set FRONT_CODE=%%c
    if "!FRONT_CODE!"=="200" ( echo [VERIFY]   [OK] HTTP !FRONT_CODE! ) else if "!FRONT_CODE!"=="301" ( echo [VERIFY]   [OK] HTTP !FRONT_CODE! (redirect^) ) else if "!FRONT_CODE!"=="302" ( echo [VERIFY]   [OK] HTTP !FRONT_CODE! (redirect^) ) else ( echo [VERIFY]   [WARN] HTTP !FRONT_CODE! & if not "!VERDICT!"=="fail" set VERDICT=warn )
    echo.

    echo [VERIFY] [4/5] VPS disk...
    for /f "tokens=*" %%s in ('ssh %SSH_OPTS% %VPS_USER%@%VPS_HOST% "df -h / | tail -1 | awk '{print \$5 \" used / \" \$4 \" free\"}' 2>/dev/null || echo N/A"') do echo [VERIFY]   Disk: %%s
)

echo [VERIFY] [5/5] Overall: %VERDICT%
if "%VERDICT%"=="fail" (
    echo [VERIFY]   Check logs: docker logs token00-backend --tail 50
)
echo [VERIFY] ========================================
echo [VERIFY]  Done (%VERDICT%)
echo [VERIFY] ========================================

REM Save report
(echo Health: %VERDICT% & echo Mode: %MODE% & echo API: %API_CODE% & echo Frontend: %FRONT_CODE%) > "%REPORT_FILE%"

if "%VERDICT%"=="fail" exit /b 2
if "%VERDICT%"=="warn" exit /b 1
exit /b 0
