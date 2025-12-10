# Docker Desktop Troubleshooting Guide

## Issue: Docker Desktop Not Starting

Docker Desktop has been attempting to start for over 2.5 minutes without becoming ready. This document provides solutions.

---

## Quick Solutions (Try These First)

### Solution 1: Restart Docker Desktop

**Step 1: Close Docker Desktop**
```powershell
# Kill all Docker processes
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "com.docker.backend" -Force -ErrorAction SilentlyContinue
```

**Step 2: Wait 10 seconds**

**Step 3: Start Docker Desktop Again**
- Click Start Menu → Search "Docker Desktop" → Click to open
- Or run: `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`

**Step 4: Wait 2-3 minutes and check**
```bash
docker ps
```

---

### Solution 2: Check WSL2 (Most Common Issue)

Docker Desktop on Windows requires WSL2 (Windows Subsystem for Linux).

**Check WSL Status:**
```powershell
wsl --list --verbose
```

**Expected output:**
```
  NAME                   STATE           VERSION
* docker-desktop         Running         2
  docker-desktop-data    Running         2
```

**If WSL is not running:**
```powershell
# Start WSL
wsl --update

# Restart Docker Desktop
Restart-Computer  # Or manually restart
```

---

### Solution 3: Restart Windows (Nuclear Option)

Sometimes Windows networking or WSL gets into a bad state:

```powershell
Restart-Computer
```

After restart:
1. Start Docker Desktop
2. Wait 2-3 minutes
3. Run: `docker ps`

---

## Alternative: Use Demo Server Instead

While Docker is being fixed, you can test against the public demo server:

```bash
node research/fineract-local-test.js demo
```

**Note**: The demo server may not be accessible from your network, but it's worth trying.

---

## Detailed Diagnostic Steps

### Step 1: Check Docker Desktop Service

```powershell
Get-Service *docker* | Format-Table -AutoSize
```

**Expected**: Services should be "Running"

**If stopped**, start them:
```powershell
Start-Service com.docker.service
```

---

### Step 2: Check Docker Desktop Logs

**Location**: `%APPDATA%\Docker\log.txt`

**View logs:**
```powershell
Get-Content "$env:APPDATA\Docker\log.txt" -Tail 50
```

Look for errors related to:
- WSL
- Hyper-V
- Network
- Port conflicts

---

### Step 3: Check System Requirements

Docker Desktop for Windows requires:
- ✅ Windows 10 64-bit (Pro, Enterprise, Education) or Windows 11
- ✅ WSL 2 feature enabled
- ✅ BIOS-level hardware virtualization support enabled
- ✅ At least 4 GB RAM (8 GB recommended)

**Check virtualization:**
```powershell
Get-ComputerInfo | Select-Object HyperVisorPresent, HyperVRequirementVirtualizationFirmwareEnabled
```

Should show `True` for both.

---

### Step 4: Reset Docker Desktop

**If nothing else works:**

1. Open Docker Desktop
2. Click Settings (gear icon)
3. Troubleshoot → Reset to factory defaults
4. Wait for reset to complete
5. Restart Docker Desktop

**⚠️ Warning**: This deletes all containers, images, and volumes!

---

## Known Issues

### Issue: Port 2375 or 2376 Already in Use

**Solution:**
```powershell
# Find process using port
netstat -ano | findstr ":2375"
netstat -ano | findstr ":2376"

# Kill the process (replace <PID> with the number from above)
Stop-Process -Id <PID> -Force
```

---

### Issue: WSL2 Not Installed

**Install WSL2:**
```powershell
# Run as Administrator
wsl --install

# Restart computer
Restart-Computer
```

---

### Issue: Hyper-V Conflicts

**If using VirtualBox or VMware:**
- Docker Desktop and VirtualBox/VMware can conflict
- Choose one virtualization platform
- Or use Docker Toolbox (older version)

---

## Working Around Docker Issues

### Option 1: Use Fineract Demo Server

```bash
node research/fineract-local-test.js demo
```

Pros:
- ✅ No local setup needed
- ✅ Pre-configured loan products

Cons:
- ❌ May not be accessible from your network
- ❌ Shared with other users
- ❌ Rate limits

---

### Option 2: Use Fineract Test Directory

You have the full Fineract source code in `fineract-test/` directory:

```bash
cd fineract-test

# Build and run tests (requires Java 17)
./gradlew clean build integrationTest
```

This runs Fineract's own test suite without Docker.

---

### Option 3: Cloud-Based Docker

**GitHub Codespaces / Gitpod:**
- Create a cloud development environment
- Docker works out of the box
- Run the same scripts remotely

---

## Manual Docker Desktop Reinstall

**If all else fails:**

### Step 1: Uninstall Docker Desktop
1. Settings → Apps → Docker Desktop → Uninstall
2. Delete remaining files:
   ```powershell
   Remove-Item -Recurse -Force "$env:APPDATA\Docker"
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Docker"
   ```

### Step 2: Uninstall WSL Distributions
```powershell
wsl --unregister docker-desktop
wsl --unregister docker-desktop-data
```

### Step 3: Reinstall Docker Desktop
1. Download from: https://www.docker.com/products/docker-desktop
2. Run installer
3. Choose "Use WSL 2 instead of Hyper-V"
4. Restart computer
5. Start Docker Desktop
6. Wait for initialization (3-5 minutes on first run)

---

## Next Steps After Docker is Fixed

Once Docker is running (`docker ps` works without errors):

### Quick Test:
```bash
# Start Fineract
docker-compose -f docker-compose-fineract.yml up -d

# Wait for startup
docker logs fineract-server -f

# Run tests
node research/fineract-local-test.js
```

### Or Use Automation:
```powershell
.\scripts\start-fineract-local.ps1
```

---

## Getting Help

### Docker Desktop Support
- Documentation: https://docs.docker.com/desktop/troubleshoot/overview/
- GitHub Issues: https://github.com/docker/for-win/issues
- Stack Overflow: https://stackoverflow.com/questions/tagged/docker-desktop

### Check Docker Status
```bash
# Version info
docker version

# System info
docker info

# Check if daemon is running
docker ps
```

---

## Summary

**Most Common Fix**: Restart Docker Desktop
```powershell
Stop-Process -Name "Docker Desktop" -Force
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
# Wait 2-3 minutes
docker ps
```

**If that doesn't work**: Restart Windows

**Alternative**: Use demo server while troubleshooting
```bash
node research/fineract-local-test.js demo
```

---

**Last Updated**: November 24, 2025
