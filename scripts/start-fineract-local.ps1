# Fineract Local Test Environment Startup Script
# This script starts Docker Desktop, launches Fineract, and runs tests

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting Fineract Local Test Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

# ============================================================================
# Step 1: Check Docker Installation
# ============================================================================
Write-Host "[1/4] Checking Docker Desktop status..." -ForegroundColor Yellow
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Docker Desktop from:" -ForegroundColor Yellow
    Write-Host "https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# ============================================================================
# Step 2: Start Docker Desktop if needed
# ============================================================================
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[✓] Docker Desktop is already running!" -ForegroundColor Green
    }
} catch {
    Write-Host "Docker Desktop is not running. Starting it now..." -ForegroundColor Yellow

    # Try to start Docker Desktop
    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process -FilePath $dockerPath
        Write-Host ""
        Write-Host "Waiting for Docker Desktop to start (this may take 1-2 minutes)..." -ForegroundColor Yellow
        Write-Host ""

        # Wait for Docker to be ready (max 2 minutes)
        $maxAttempts = 24
        $attempt = 0
        $dockerReady = $false

        while ($attempt -lt $maxAttempts) {
            Start-Sleep -Seconds 5
            $attempt++

            try {
                $null = docker ps 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $dockerReady = $true
                    break
                }
            } catch {
                # Continue waiting
            }

            Write-Host "   Attempt $attempt/$maxAttempts - Still waiting..." -ForegroundColor Gray
        }

        if (-not $dockerReady) {
            Write-Host ""
            Write-Host "ERROR: Docker Desktop did not start within 2 minutes" -ForegroundColor Red
            Write-Host "Please start Docker Desktop manually and run this script again" -ForegroundColor Yellow
            Write-Host ""
            Read-Host "Press Enter to exit"
            exit 1
        }

        Write-Host ""
        Write-Host "[✓] Docker Desktop is running!" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Docker Desktop executable not found at: $dockerPath" -ForegroundColor Red
        Write-Host "Please start Docker Desktop manually and run this script again" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""

# ============================================================================
# Step 3: Start Fineract Containers
# ============================================================================
Write-Host "[2/4] Starting Fineract containers..." -ForegroundColor Yellow
Write-Host ""

try {
    docker-compose -f docker-compose-fineract.yml up -d

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start containers"
    }

    Write-Host ""
    Write-Host "[✓] Fineract containers started!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to start Fineract containers" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# ============================================================================
# Step 4: Wait for Fineract to be Ready
# ============================================================================
Write-Host "[3/4] Waiting for Fineract to be ready..." -ForegroundColor Yellow
Write-Host "       This takes about 2-3 minutes on first start" -ForegroundColor Gray
Write-Host ""

$maxAttempts = 18
$attempt = 0
$fineractReady = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 10
    $attempt++

    try {
        $logs = docker logs fineract-server 2>&1 | Out-String
        if ($logs -match "Started Fineract") {
            $fineractReady = $true
            break
        }
    } catch {
        # Continue waiting
    }

    Write-Host "   Waiting $attempt/$maxAttempts - Fineract is starting..." -ForegroundColor Gray
}

if ($fineractReady) {
    Write-Host ""
    Write-Host "[✓] Fineract is ready!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "WARNING: Fineract may still be starting" -ForegroundColor Yellow
    Write-Host "Check logs with: docker logs fineract-server -f" -ForegroundColor Gray
}

Write-Host ""

# ============================================================================
# Step 5: Run Test Script
# ============================================================================
Write-Host "[4/4] Running test script..." -ForegroundColor Yellow
Write-Host ""

try {
    node research/fineract-local-test.js local

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "WARNING: Tests encountered some issues" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to run test script" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs:    docker logs fineract-server -f" -ForegroundColor Gray
Write-Host "  Stop:         docker-compose -f docker-compose-fineract.yml down" -ForegroundColor Gray
Write-Host "  Restart:      docker-compose -f docker-compose-fineract.yml restart" -ForegroundColor Gray
Write-Host ""
Write-Host "Fineract API:" -ForegroundColor Yellow
Write-Host "  URL:          http://localhost:8080/fineract-provider/api-docs/apiLive.htm" -ForegroundColor Cyan
Write-Host "  Credentials:  mifos / password" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
