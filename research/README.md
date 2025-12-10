# Fineract Research & Testing

This directory contains scripts and documentation for testing Apache Fineract integration with the Lynia Finance platform.

## Quick Start

### Automated Testing (Recommended)

**Option 1: PowerShell Script (Most Reliable)**
```powershell
# Run from project root
.\scripts\start-fineract-local.ps1
```

**Option 2: Batch Script**
```cmd
# Run from project root
.\scripts\start-fineract-local.bat
```

These scripts will:
1. ✅ Check and start Docker Desktop
2. ✅ Launch Fineract containers
3. ✅ Wait for Fineract to be ready
4. ✅ Run comprehensive tests
5. ✅ Display results and helpful commands

### Manual Testing

**Step 1: Start Docker Desktop**
- Open Docker Desktop application
- Wait for it to show "Running" status

**Step 2: Start Fineract**
```bash
docker-compose -f docker-compose-fineract.yml up -d
docker logs fineract-server -f  # Watch until you see "Started Fineract"
```

**Step 3: Run Tests**
```bash
# Local instance
node research/fineract-local-test.js

# Or demo server
node research/fineract-local-test.js demo
```

---

## Files in this Directory

### Test Scripts

| File | Description |
|------|-------------|
| [fineract-local-test.js](fineract-local-test.js) | **Enhanced test script** with local/demo support, auto-wait, and better error handling |
| [fineract-demo-test.js](fineract-demo-test.js) | Original demo server test script |

### Documentation

| File | Description |
|------|-------------|
| [FINERACT-TESTING-GUIDE.md](FINERACT-TESTING-GUIDE.md) | **Comprehensive testing guide** with troubleshooting, manual testing, and Docker commands |
| [README.md](README.md) | This file - overview and quick start |

### Helper Scripts

| File | Description |
|------|-------------|
| [../scripts/start-fineract-local.ps1](../scripts/start-fineract-local.ps1) | PowerShell automation script |
| [../scripts/start-fineract-local.bat](../scripts/start-fineract-local.bat) | Batch automation script |

---

## What Gets Tested

The test scripts validate the complete **device financing loan lifecycle**:

### 1. Connection Test ✅
- Verifies Fineract server accessibility
- Lists configured offices

### 2. Client Creation ✅
- Creates Zimbabwe customer
- Tests National ID storage (`externalId`)
- Tests phone number format (`+263771234567`)

### 3. Loan Product Discovery ✅
- Lists available loan products
- Selects suitable product for device financing

### 4. Loan Creation ✅
- **Amount**: $500 (typical device cost)
- **Term**: 8 months
- **Interest**: 30% annual (2.5% monthly)
- **Structure**: Equal monthly installments

### 5. Loan Approval ✅
- Transitions loan: Pending → Approved

### 6. Loan Disbursement ✅
- Simulates device handover
- Activates the loan (Approved → Active)

### 7. Repayment Schedule ✅
- Retrieves auto-generated payment plan
- Shows due dates and amounts

### 8. Account Details ✅
- Gets complete loan information
- Retrieves account numbers for queries

---

## Test Output Example

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

🔍 Test 3: Getting available loan products...
✅ Found 3 loan product(s)

🔍 Test 4: Creating a device financing loan...
✅ Loan created successfully!
   Loan ID: 1

🔍 Test 5: Approving loan...
✅ Loan approved successfully!

🔍 Test 6: Disbursing loan...
✅ Loan disbursed successfully!

🔍 Test 7: Getting repayment schedule...
✅ Retrieved repayment schedule!
   Total to repay: $562.50
   Monthly installments: 8

   Payment schedule:
     1. 24/11/2025   - $70.31 (Principal: $57.81, Interest: $12.50)
     2. 24/12/2025   - $70.31 (Principal: $59.25, Interest: $11.06)
     ...

🔍 Test 8: Getting complete loan account details...
✅ Loan details retrieved!
   Account Number: 000000001

✅ Testing Completed!
```

---

## Key Findings for Lynia Finance

### Customer Data Management
- **National IDs**: Store in `externalId` field (format: `63-XXXXXX-A-XX`)
- **Phone Numbers**: Use full format with country code (`263771234567`)
- **Client Status**: Can be activated immediately (`active: true`)

### Loan Workflow States
1. **Submitted** - Initial loan application
2. **Pending Approval** - Awaiting approval
3. **Approved** - Ready for disbursement
4. **Active** - Loan disbursed (device handed over)

### Device Financing Configuration
- **Principal Amount**: $500 (typical smartphone)
- **Loan Term**: 8 months
- **Interest Rate**: 30% annual = 2.5% per month
- **Repayment Type**: Equal installments (amortization)
- **Interest Type**: Declining balance (fair for customers)

### API Integration Details
- **Authentication**: Basic Auth (username/password)
- **Multi-tenancy**: Tenant ID passed via header
- **Date Format**: `dd MMMM yyyy` (e.g., "24 November 2025")
- **Account Numbers**: Auto-generated for customer lookups

---

## Troubleshooting

### Issue: Cannot connect to server

**Check Docker Desktop**
```bash
docker ps  # Should list containers
```

**Start Fineract if needed**
```bash
docker-compose -f docker-compose-fineract.yml up -d
```

**Wait for startup (2-3 minutes)**
```bash
docker logs fineract-server -f
# Wait for: "Started Fineract in X seconds"
```

### Issue: No loan products available

**For local testing**: Create products via Fineract UI
- URL: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
- Login: `mifos` / `password`

**Or use demo server**:
```bash
node research/fineract-local-test.js demo
```

### Issue: Tests timing out

**Increase timeout in script**:
Edit `fineract-local-test.js` line 22-23:
```javascript
timeout: 60000 // Increase to 60 seconds
```

### Issue: Docker Desktop won't start

**Manual start**:
1. Open Start Menu
2. Search "Docker Desktop"
3. Click to launch
4. Wait for system tray icon to show "Running"

---

## Docker Commands Reference

```bash
# Start Fineract
docker-compose -f docker-compose-fineract.yml up -d

# Stop Fineract
docker-compose -f docker-compose-fineract.yml down

# View logs
docker logs fineract-server -f

# Check status
docker-compose -f docker-compose-fineract.yml ps

# Restart services
docker-compose -f docker-compose-fineract.yml restart

# Clean up everything (removes data!)
docker-compose -f docker-compose-fineract.yml down -v
```

---

## Next Research Tasks

- [ ] **T002**: Test repayment posting API
  - Record customer payments
  - Update loan balance
  - Test partial payments

- [ ] **T003**: Test account balance queries
  - Check outstanding balance
  - Get payment history
  - Query next due date

- [ ] **T004**: Test payment reminders
  - List overdue accounts
  - Calculate days past due
  - Get customer contact info

- [ ] **T005**: Test delinquency management
  - Mark accounts delinquent
  - Apply late fees
  - Test grace periods

- [ ] **T006**: Integration with WhatsApp bot
  - Balance inquiries via chat
  - Payment confirmations
  - Reminder notifications

- [ ] **T007**: Integration with mobile money
  - EcoCash payment posting
  - Payment verification
  - Transaction reconciliation

---

## Resources

### Local Development
- **API Documentation**: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
- **Container Logs**: `docker logs fineract-server -f`
- **Database Access**: `docker exec -it fineract-postgres psql -U postgres -d fineract_default`

### External Resources
- **Fineract GitHub**: https://github.com/apache/fineract
- **Fineract Wiki**: https://cwiki.apache.org/confluence/display/FINERACT
- **Demo Server**: https://demo.fineract.dev (if accessible)
- **Docker Hub**: https://hub.docker.com/r/apache/fineract

### Documentation
- **Docker Compose Config**: [../docker-compose-fineract.yml](../docker-compose-fineract.yml)
- **Testing Guide**: [FINERACT-TESTING-GUIDE.md](FINERACT-TESTING-GUIDE.md)

---

## Support & Feedback

If you encounter issues:

1. ✅ Check [FINERACT-TESTING-GUIDE.md](FINERACT-TESTING-GUIDE.md) troubleshooting section
2. ✅ Review Docker logs: `docker logs fineract-server`
3. ✅ Ensure Docker Desktop is running
4. ✅ Wait 2-3 minutes for complete startup
5. ✅ Try the automated scripts in `scripts/` directory

---

**Last Updated**: November 24, 2025
**Fineract Version**: 1.8.4
**Environment**: Local Docker + PostgreSQL
