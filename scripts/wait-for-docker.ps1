# Wait for Docker Desktop to be ready
$maxAttempts = 30
$attempt = 0

Write-Host "Waiting for Docker Desktop to be ready..." -ForegroundColor Yellow

while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "Attempt $attempt/$maxAttempts - Checking Docker..." -ForegroundColor Gray

    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS: Docker is ready!" -ForegroundColor Green
            exit 0
        }
    } catch {
        # Continue waiting
    }

    Start-Sleep -Seconds 5
}

Write-Host "ERROR: Docker not ready after 2.5 minutes" -ForegroundColor Red
exit 1
