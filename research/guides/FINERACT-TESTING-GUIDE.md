# Fineract Demo Testing Guide

This guide provides step-by-step instructions for testing Apache Fineract for the Lynia Finance platform.

## Overview

You have two test scripts available:

1. **[fineract-demo-test.js](fineract-demo-test.js)** - Tests against public demo server
2. **[fineract-local-test.js](fineract-local-test.js)** - Tests local Docker instance OR demo server

## Quick Start

### Option 1: Test with Local Docker Instance (Recommended)

**Step 1: Start Docker Desktop**
- Open Docker Desktop on Windows
- Wait for it to be running (check system tray)

**Step 2: Start Fineract**
```bash
# Start containers
docker-compose -f docker-compose-fineract.yml up -d

# Monitor startup (wait for "Started Fineract" message)
docker logs fineract-server -f
# Press Ctrl+C when you see the startup complete message
```

**Step 3: Run Tests**
```bash
# Run tests against local instance
node research/fineract-local-test.js local

# Or simply (local is default):
node research/fineract-local-test.js
```

**Step 4: Explore Fineract API**
- Open: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
- Login: `mifos` / `password`

---

### Option 2: Test with Public Demo Server

```bash
# Run tests against demo server
node research/fineract-local-test.js demo
```

---

## What Gets Tested

The test script validates the complete loan lifecycle:

### 1. **Connection Test**
- Verifies Fineract server is accessible
- Lists available offices

### 2. **Client Creation**
- Creates a Zimbabwe customer
- Tests National ID storage (`externalId`)
- Tests Zimbabwe phone number format (`+263`)

### 3. **Loan Product Discovery**
- Lists available loan products
- Selects product suitable for device financing

### 4. **Loan Creation**
- Creates $500 loan
- 8-month term
- 30% annual interest (2.5% monthly)
- Equal monthly installments

### 5. **Loan Approval**
- Transitions loan from "Pending" to "Approved"

### 6. **Loan Disbursement**
- Simulates device handover
- Activates the loan

### 7. **Repayment Schedule**
- Retrieves auto-generated payment schedule
- Shows monthly payment amounts

### 8. **Account Details**
- Gets complete loan account information
- Retrieves account numbers for customer queries

---

## Expected Output

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

[... continues through all 8 tests ...]

✅ Testing Completed!
```

---

## Troubleshooting

### Issue: "Cannot connect to Fineract server"

**Solution 1: Check Docker**
```bash
# Check if Docker is running
docker --version
docker ps

# If no containers, start them:
docker-compose -f docker-compose-fineract.yml up -d
```

**Solution 2: Wait for Startup**
Fineract takes 2-3 minutes to start completely:
```bash
# Watch logs until you see "Started Fineract"
docker logs fineract-server -f
```

**Solution 3: Check Container Health**
```bash
# Check container status
docker-compose -f docker-compose-fineract.yml ps

# Should show "healthy" status
```

---

### Issue: "No loan products available"

For local testing, you need to create loan products first.

**Solution: Use Fineract UI**
1. Open: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
2. Login: `mifos` / `password`
3. Navigate to loan products section
4. Create a new loan product with device financing terms

Or use the demo server which has pre-configured products:
```bash
node research/fineract-local-test.js demo
```

---

### Issue: Docker Desktop not installed

**Install Docker Desktop for Windows:**
1. Download from: https://www.docker.com/products/docker-desktop
2. Install and restart your computer
3. Start Docker Desktop
4. Run the test script

---

## Manual API Testing

If you want to test individual endpoints:

### Test Connection
```bash
curl -u mifos:password \
  -H "Fineract-Platform-TenantId: default" \
  http://localhost:8080/fineract-provider/api/v1/offices
```

### List Loan Products
```bash
curl -u mifos:password \
  -H "Fineract-Platform-TenantId: default" \
  http://localhost:8080/fineract-provider/api/v1/loanproducts
```

### Create Client
```bash
curl -X POST http://localhost:8080/fineract-provider/api/v1/clients \
  -u mifos:password \
  -H "Fineract-Platform-TenantId: default" \
  -H "Content-Type: application/json" \
  -d '{
    "officeId": 1,
    "firstname": "Test",
    "lastname": "Customer",
    "externalId": "63-123456-A-12",
    "mobileNo": "263771234567",
    "active": true,
    "dateFormat": "dd MMMM yyyy",
    "locale": "en",
    "activationDate": "24 November 2025"
  }'
```

---

## Docker Commands Reference

```bash
# Start Fineract
docker-compose -f docker-compose-fineract.yml up -d

# Stop Fineract
docker-compose -f docker-compose-fineract.yml down

# View logs
docker logs fineract-server -f

# Restart Fineract
docker-compose -f docker-compose-fineract.yml restart

# Check status
docker-compose -f docker-compose-fineract.yml ps

# Clean up (removes data!)
docker-compose -f docker-compose-fineract.yml down -v
```

---

## Key Findings for Lynia Finance

### Customer Data
- **National IDs**: Store in `externalId` field
- **Phone Numbers**: Format as `263771234567` (with country code)
- **Activation**: Clients can be activated immediately

### Loan Workflow
1. **Submitted** - Loan application created
2. **Pending Approval** - Awaiting approval
3. **Approved** - Ready for disbursement
4. **Active** - Loan disbursed (device handed over)

### Device Financing
- **Principal**: $500 (typical device cost)
- **Term**: 8 months
- **Interest**: 30% annual = 2.5% monthly
- **Repayment**: Equal monthly installments
- **Schedule**: Auto-generated with due dates

### API Integration
- **Authentication**: Basic Auth (username/password)
- **Tenant**: Multi-tenant support via header
- **Date Format**: "dd MMMM yyyy" (e.g., "24 November 2025")
- **Account Numbers**: Auto-generated for customer queries

---

## Next Steps

1. **T002**: Test repayment posting API
2. **T003**: Test account balance queries
3. **T004**: Test payment reminders
4. **T005**: Test delinquency management
5. **Integration**: Connect to WhatsApp bot
6. **Integration**: Connect to mobile money APIs

---

## Resources

- **Local API Docs**: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
- **Demo Server API Docs**: https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm
- **Fineract GitHub**: https://github.com/apache/fineract
- **Docker Compose Config**: [docker-compose-fineract.yml](../docker-compose-fineract.yml)

---

## Support

If you encounter issues:

1. Check Docker Desktop is running
2. Review container logs: `docker logs fineract-server`
3. Wait 2-3 minutes for full startup
4. Try demo server: `node research/fineract-local-test.js demo`
5. Check this guide's troubleshooting section
