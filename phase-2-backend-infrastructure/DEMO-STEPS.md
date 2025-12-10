# Fineract Demo Testing - Step by Step Guide

This is the **simplest guide** to demo test Apache Fineract for Lynia Finance.

## Prerequisites

- ✅ Windows 10/11
- ✅ Docker Desktop installed
- ✅ Node.js installed
- ✅ `node-fetch` package (`npm install node-fetch`)

---

## Method 1: Fully Automated (Easiest) 🚀

Just run this PowerShell script - it does everything automatically:

```powershell
.\scripts\start-fineract-local.ps1
```

**What it does:**
1. Checks if Docker Desktop is running (starts it if needed)
2. Waits for Docker to be ready
3. Starts Fineract containers
4. Waits for Fineract to be ready (~3 minutes)
5. Runs all 8 tests automatically
6. Shows results and useful commands

**Time**: 3-5 minutes total (mostly waiting for startup)

---

## Method 2: Manual Step-by-Step

If you prefer to see each step:

### Step 1: Start Docker Desktop (1-2 minutes)

**Option A: Click Start Menu → Docker Desktop**

**Option B: Run from command line**
```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

**Wait for**: System tray icon to show "Docker Desktop is running"

---

### Step 2: Start Fineract (30 seconds)

```bash
docker-compose -f docker-compose-fineract.yml up -d
```

**Expected output:**
```
[+] Running 3/3
 ✔ Network lynia-finance-dev_default        Created
 ✔ Container fineract-postgres              Started
 ✔ Container fineract-server                Started
```

---

### Step 3: Wait for Fineract to Start (2-3 minutes)

**Watch the logs:**
```bash
docker logs fineract-server -f
```

**Look for this message:**
```
... Started Fineract in XX.XXX seconds
```

**Then press**: `Ctrl+C` to stop watching

---

### Step 4: Run Tests (30 seconds)

```bash
node research/fineract-local-test.js
```

**What you'll see:**
```
======================================================================
  Fineract API Research - Local Development Testing
  Environment: Local Docker Instance
======================================================================

📡 Using environment: Local Docker Instance
   URL: http://localhost:8080/fineract-provider/api/v1

✅ Fineract is ready!

🔍 Test 1: Checking Fineract server connection...
✅ Fineract server is accessible!
   Found 1 office(s)
   First office: Head Office (ID: 1)

🔍 Test 2: Creating a Zimbabwe client...
✅ Client created successfully!
   Client ID: 1
   Resource ID: 1

📝 Key Finding: Zimbabwe National ID can be stored in externalId field

[... continues through 8 tests ...]

✅ Testing Completed!
```

---

## What Each Test Does

| Test | Action | What It Proves |
|------|--------|----------------|
| **1. Connection** | GET /offices | Server is accessible and responding |
| **2. Client Creation** | POST /clients | Can create Zimbabwe customers with National IDs |
| **3. Loan Products** | GET /loanproducts | Can discover available loan products |
| **4. Loan Creation** | POST /loans | Can create $500 device financing loan |
| **5. Loan Approval** | POST /loans/{id}?command=approve | Can approve loans (workflow) |
| **6. Loan Disbursement** | POST /loans/{id}?command=disburse | Can disburse loans (device handover) |
| **7. Repayment Schedule** | GET /loans/{id}?associations=repaymentSchedule | Schedule is auto-generated |
| **8. Account Details** | GET /loans/{id} | Can retrieve account info for queries |

---

## Expected Test Results

### ✅ Success Scenario

All 8 tests pass:

```
✅ Testing Completed!

📊 Summary:
   ✅ Client created (ID: 1)
   ✅ Loan created (ID: 1)
   ✅ Loan approved and disbursed
   ✅ Repayment schedule retrieved
   ✅ Account details retrieved

📝 Key Findings for Lynia Finance:
   • Zimbabwe National IDs → externalId field
   • Phone numbers → mobileNo (with +263 prefix)
   • Loan workflow: Submitted → Approved → Active
   • Interest: 30% annual = 2.5% monthly
   • Repayment schedule auto-generated
   • Date format: "dd MMMM yyyy"
   • Account numbers available for customer queries
```

### ⚠️ Common Issues

**Issue 1: "Cannot connect to Fineract server"**

**Cause**: Fineract not fully started yet

**Solution**:
```bash
# Check if still starting
docker logs fineract-server -f

# Wait for "Started Fineract" message
# Then run test again
node research/fineract-local-test.js
```

---

**Issue 2: "No loan products available"**

**Cause**: Fresh Fineract instance has no loan products

**Solution Option A** - Create via UI:
1. Open: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
2. Login: `mifos` / `password`
3. Navigate to loan products
4. Create a product with:
   - Principal: $500
   - Interest: 30% annual
   - Term: 8 months

**Solution Option B** - Use demo server (if accessible):
```bash
node research/fineract-local-test.js demo
```

---

**Issue 3: Docker Desktop not starting**

**Solution**:
1. Open Task Manager (`Ctrl+Shift+Esc`)
2. End any Docker processes
3. Start Docker Desktop again
4. Wait 1-2 minutes
5. Run: `docker ps` to verify

---

## Quick Commands Reference

```bash
# Start everything
docker-compose -f docker-compose-fineract.yml up -d

# Stop everything
docker-compose -f docker-compose-fineract.yml down

# Watch logs
docker logs fineract-server -f

# Check status
docker ps

# Run tests
node research/fineract-local-test.js

# Run tests against demo
node research/fineract-local-test.js demo
```

---

## After Testing - Explore the API

### Open Fineract API Documentation

**URL**: http://localhost:8080/fineract-provider/api-docs/apiLive.htm

**Login**:
- Username: `mifos`
- Password: `password`

### Try Manual API Calls

**Get all clients:**
```bash
curl -u mifos:password \
  -H "Fineract-Platform-TenantId: default" \
  http://localhost:8080/fineract-provider/api/v1/clients
```

**Get specific loan:**
```bash
curl -u mifos:password \
  -H "Fineract-Platform-TenantId: default" \
  http://localhost:8080/fineract-provider/api/v1/loans/1
```

**Get loan repayment schedule:**
```bash
curl -u mifos:password \
  -H "Fineract-Platform-TenantId: default" \
  "http://localhost:8080/fineract-provider/api/v1/loans/1?associations=repaymentSchedule"
```

---

## Clean Up After Testing

**Stop containers (keeps data):**
```bash
docker-compose -f docker-compose-fineract.yml down
```

**Remove everything including data:**
```bash
docker-compose -f docker-compose-fineract.yml down -v
```

---

## Demo for Stakeholders

If you're demonstrating to others:

### Preparation (5 minutes before demo)
1. Start Docker Desktop
2. Run: `docker-compose -f docker-compose-fineract.yml up -d`
3. Wait for Fineract to start (check logs)
4. Have browser open to API docs

### During Demo (10 minutes)
1. **Show the test script running** (2 min)
   ```bash
   node research/fineract-local-test.js
   ```

2. **Explain each test as it runs** (3 min)
   - Client creation with Zimbabwe data
   - Loan creation with device financing terms
   - Workflow: Submit → Approve → Disburse
   - Auto-generated repayment schedule

3. **Show API documentation** (3 min)
   - Open: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
   - Browse available endpoints
   - Show loan repayment schedule

4. **Show how it fits Lynia Finance** (2 min)
   - WhatsApp bot → API calls
   - Customer queries → Account lookups
   - Payment posting → Balance updates
   - Reminders → Overdue queries

---

## Next Steps After Demo

- [ ] Test repayment posting (customer makes payment)
- [ ] Test balance queries (WhatsApp bot integration)
- [ ] Test payment reminders (overdue accounts)
- [ ] Set up Supabase → Fineract integration
- [ ] Build WhatsApp bot proof of concept

---

## Summary - TL;DR

**Fastest way to demo test:**
```powershell
# 1. Run this script (does everything):
.\scripts\start-fineract-local.ps1

# 2. Wait 3-5 minutes

# 3. See results!
```

**Manual way (4 steps):**
```bash
# 1. Start Docker Desktop (GUI or command)

# 2. Start Fineract
docker-compose -f docker-compose-fineract.yml up -d

# 3. Wait for startup (2-3 min)
docker logs fineract-server -f

# 4. Run tests
node research/fineract-local-test.js
```

**Time required**: ~5 minutes total (mostly waiting for Docker/Fineract to start)

**What you prove**: Complete device financing workflow works end-to-end

---

**Questions? Issues?**

See [FINERACT-TESTING-GUIDE.md](FINERACT-TESTING-GUIDE.md) for detailed troubleshooting.
