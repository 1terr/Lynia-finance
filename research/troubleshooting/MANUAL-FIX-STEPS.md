# Manual Fix Steps for Fineract Local Testing

## Issue Found

The Fineract container is failing with: **"RSA public key is not available client side"**

This is a MySQL 8.0 authentication compatibility issue with the MariaDB JDBC driver.

---

## Quick Fix Options

### **Option 1: Add Connection Parameters (Recommended)**

Edit `docker-compose-fineract.yml` and update line 35 to add connection parameters:

**Change this line:**
```yaml
- FINERACT_HIKARI_JDBC_URL=jdbc:mariadb://fineractdb:3306/fineract_tenants
```

**To this:**
```yaml
- FINERACT_HIKARI_JDBC_URL=jdbc:mariadb://fineractdb:3306/fineract_tenants?allowPublicKeyRetrieval=true&useSSL=false
```

Then restart:
```bash
docker-compose -f docker-compose-fineract.yml down
docker-compose -f docker-compose-fineract.yml up -d
```

---

### **Option 2: Use MySQL Native Authentication**

Change MySQL to use the older authentication method.

Edit `docker-compose-fineract.yml` line 18:

**Change this:**
```yaml
command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

**To this:**
```yaml
command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --default-authentication-plugin=mysql_native_password
```

Then restart:
```bash
docker-compose -f docker-compose-fineract.yml down -v
docker-compose -f docker-compose-fineract.yml up -d
```

---

### **Option 3: Use MariaDB Instead of MySQL**

Change line 9 in `docker-compose-fineract.yml`:

**Change this:**
```yaml
image: mysql:8.0
```

**To this:**
```yaml
image: mariadb:10.11
```

Also update the healthcheck on line 20:

**Change this:**
```yaml
test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-pmysql"]
```

**To this:**
```yaml
test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
```

Then restart:
```bash
docker-compose -f docker-compose-fineract.yml down -v
docker-compose -f docker-compose-fineract.yml up -d
```

---

## Complete Manual Testing Steps

### Step 1: Choose and apply one of the fixes above

### Step 2: Start the containers
```bash
docker-compose -f docker-compose-fineract.yml up -d
```

### Step 3: Monitor Fineract startup (2-3 minutes)
```bash
docker logs fineract-server -f
```

**Wait for:** `Started Fineract in XX.XXX seconds`

Press `Ctrl+C` when you see that message.

### Step 4: Run the tests
```bash
node research/fineract-local-test.js
```

---

## Expected Test Output

```
======================================================================
  Fineract API Research - Local Development Testing
  Environment: Local Docker Instance
======================================================================

📡 Using environment: Local Docker Instance
   URL: http://localhost:8080/fineract-provider/api/v1

🔍 Test 1: Checking Fineract server connection...
✅ Fineract server is accessible!
   Found 1 office(s)
   First office: Head Office (ID: 1)

🔍 Test 2: Creating a Zimbabwe client...
✅ Client created successfully!
   Client ID: 1

🔍 Test 3: Getting available loan products...
✅ Found X loan product(s)

🔍 Test 4: Creating a device financing loan...
✅ Loan created successfully!
   Loan ID: 1

🔍 Test 5: Approving loan...
✅ Loan approved successfully!

🔍 Test 6: Disbursing loan...
✅ Loan disbursed successfully!

🔍 Test 7: Getting repayment schedule...
✅ Retrieved repayment schedule!

🔍 Test 8: Getting complete loan account details...
✅ Loan details retrieved!

✅ Testing Completed!
```

---

## Troubleshooting

### Container keeps restarting
```bash
# Check logs
docker logs fineract-server --tail 100

# Check if MySQL is healthy
docker ps
```

### MySQL not healthy
```bash
# Wait longer (MySQL takes 30-60 seconds to start)
docker logs fineract-mysql
```

### Port conflicts
```bash
# Check if ports 3306 or 8080 are in use
netstat -ano | findstr ":3306"
netstat -ano | findstr ":8080"
```

### Reset everything
```bash
# Complete reset
docker-compose -f docker-compose-fineract.yml down -v
docker system prune -f
docker-compose -f docker-compose-fineract.yml up -d
```

---

## Quick Commands Reference

```bash
# Start containers
docker-compose -f docker-compose-fineract.yml up -d

# Stop containers
docker-compose -f docker-compose-fineract.yml down

# View logs
docker logs fineract-server -f
docker logs fineract-mysql

# Check status
docker-compose -f docker-compose-fineract.yml ps
docker ps

# Reset (removes data)
docker-compose -f docker-compose-fineract.yml down -v

# Run tests
node research/fineract-local-test.js
```

---

## Alternative: Test Against Demo Server

If local setup continues to have issues, try the demo server:

```bash
node research/fineract-local-test.js demo
```

**Note:** This may not work due to network restrictions, but worth trying.

---

## Next Steps After Successful Test

1. ✅ Review test output
2. ✅ Explore Fineract API: http://localhost:8080/fineract-provider/api-docs/apiLive.htm
3. ✅ Test repayment posting (T002)
4. ✅ Test account queries (T003)
5. ✅ Plan WhatsApp bot integration

---

**Recommended:** Try **Option 1** first (add connection parameters) - it's the quickest fix!
