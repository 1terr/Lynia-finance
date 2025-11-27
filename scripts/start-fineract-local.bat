@echo off
echo ========================================
echo  Starting Fineract Local Test Environment
echo ========================================
echo.

REM Check if Docker Desktop is installed
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo.
    echo Please install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [1/4] Checking Docker Desktop status...
echo.

REM Try to start Docker Desktop if not running
docker ps >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Docker Desktop is not running. Starting it now...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo.
    echo Waiting for Docker Desktop to start (this may take 1-2 minutes)...
    echo.

    REM Wait for Docker to be ready
    set /a count=0
    :wait_loop
    timeout /t 5 /nobreak >nul
    docker ps >nul 2>nul
    if %ERRORLEVEL% EQU 0 goto docker_ready

    set /a count+=1
    echo    Attempt %count%/24 - Still waiting...

    if %count% LSS 24 goto wait_loop

    echo.
    echo ERROR: Docker Desktop did not start within 2 minutes
    echo Please start Docker Desktop manually and run this script again
    pause
    exit /b 1
)

:docker_ready
echo [✓] Docker Desktop is running!
echo.

echo [2/4] Starting Fineract containers...
echo.
cd /d "%~dp0\.."
docker-compose -f docker-compose-fineract.yml up -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to start Fineract containers
    pause
    exit /b 1
)

echo.
echo [✓] Fineract containers started!
echo.

echo [3/4] Waiting for Fineract to be ready...
echo        This takes about 2-3 minutes on first start
echo.

REM Wait for Fineract to be ready
set /a count=0
:fineract_wait_loop
timeout /t 10 /nobreak >nul

docker logs fineract-server 2>&1 | findstr /C:"Started Fineract" >nul
if %ERRORLEVEL% EQU 0 goto fineract_ready

set /a count+=1
echo    Waiting %count%/18 - Fineract is starting...

if %count% LSS 18 goto fineract_wait_loop

echo.
echo WARNING: Fineract may still be starting
echo Check logs with: docker logs fineract-server -f
goto continue_anyway

:fineract_ready
echo [✓] Fineract is ready!
echo.

:continue_anyway
echo [4/4] Running test script...
echo.
node research/fineract-local-test.js local

echo.
echo ========================================
echo  Testing Complete!
echo ========================================
echo.
echo Useful commands:
echo   View logs:    docker logs fineract-server -f
echo   Stop:         docker-compose -f docker-compose-fineract.yml down
echo   API Docs:     http://localhost:8080/fineract-provider/api-docs/apiLive.htm
echo   Credentials:  mifos / password
echo.
pause
