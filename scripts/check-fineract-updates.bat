@echo off
REM Check for Apache Fineract Updates
REM Usage: scripts\check-fineract-updates.bat

echo ==========================================
echo Apache Fineract Update Checker
echo ==========================================
echo.

REM Fetch latest tags from Apache Fineract
echo Fetching latest Apache Fineract releases...
git fetch apache-fineract --tags --quiet

REM Get the latest version
for /f "delims=" %%i in ('git tag --list "1.*" --sort^=-v:refname') do (
    set LATEST_VERSION=%%i
    goto :break1
)
:break1

echo Latest Apache Fineract version: %LATEST_VERSION%
echo.

REM Get current branch
for /f "delims=" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
echo Current branch: %CURRENT_BRANCH%
echo.

REM Show recent versions
echo Recent Apache Fineract versions:
git tag --list "1.*" --sort=-v:refname | findstr /n "^" | findstr "^[1-9]:" | findstr /v "^1[0-9]:"
echo.

echo ==========================================
echo Checking for updates...
echo.

REM Get the last integrated version from tags
for /f "delims=" %%i in ('git tag --list "lynia-*-fineract-*" --sort^=-v:refname') do (
    set LAST_INTEGRATED=%%i
    goto :break2
)
:break2

if "%LAST_INTEGRATED%"=="" (
    echo No Lynia integration tags found.
    echo Tip: Tag your current integration with:
    echo    git tag -a lynia-v1.0.0-fineract-1.13.0 -m "Description"
) else (
    echo Last integrated version tag: %LAST_INTEGRATED%
)

echo.
echo ==========================================
echo Quick Actions:
echo.
echo 1. View changes in latest version:
echo    git log --oneline %LATEST_VERSION% | head -20
echo.
echo 2. Create integration branch:
echo    git checkout -b fineract-v1.X.X-integration %LATEST_VERSION%
echo.
echo 3. Compare versions:
echo    git log --oneline 1.13.0..%LATEST_VERSION%
echo.
echo 4. View release notes:
echo    Visit: https://github.com/apache/fineract/releases/tag/%LATEST_VERSION%
echo.
echo ==========================================

pause
