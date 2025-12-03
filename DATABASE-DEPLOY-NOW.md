# Deploy Database Now - Quick Guide

**Time Required**: 5 minutes
**Task**: P2-T002 - Deploy 19 tables + test data

---

## Step 1: Deploy Schema (2 minutes)

### 1.1 Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Click your project: **ghdrnxlsupbzoddtyxcp**
3. Click **"SQL Editor"** in left sidebar

### 1.2 Create New Query
1. Click **"New Query"** button (top right)

### 1.3 Copy Schema SQL
1. Open: `database/migrations/001_initial_schema.sql`
2. **Select All** (Ctrl+A)
3. **Copy** (Ctrl+C)

### 1.4 Execute
1. **Paste** into SQL Editor (Ctrl+V)
2. Click **"Run"** button (bottom right)
3. Wait ~10 seconds

### 1.5 Verify Success
You should see:
```
Success. No rows returned
```

Or detailed NOTICE messages about tables created.

---

## Step 2: Load Test Data (2 minutes)

### 2.1 Create Another New Query
1. Still in SQL Editor, click **"New Query"** again

### 2.2 Copy Test Data SQL
1. Open: `database/seed/001_test_data.sql`
2. **Select All** (Ctrl+A)
3. **Copy** (Ctrl+C)

### 2.3 Execute
1. **Paste** into SQL Editor (Ctrl+V)
2. Click **"Run"** button
3. Wait ~5 seconds

### 2.4 Verify Success
You should see NOTICE messages:
```
✅ Test seed data inserted successfully!

Test Accounts Created:
- Admin: admin@lynia.finance
- Manager: manager@lynia.finance
- Support: support@lynia.finance

Test Customers:
- Customer 1: +263771111111 (Tier 3, Score 750)
- Customer 2: +263772222222 (Tier 2, Score 700)
- Customer 3: +263773333333 (In onboarding)

Test Loans:
- LN-2025-001: $200 (Active, 1 payment made)
- LN-2025-002: $350 (Approved, deposit paid)

Test Devices: 3 smartphones in stock
Test Agents: 2 distributors (Harare, Bulawayo)
```

---

## Step 3: Verify Tables (1 minute)

### 3.1 Check Tables
1. Click **"Table Editor"** in left sidebar
2. Verify you see **19 tables**:

**Core Tables** (6):
- ✅ customers
- ✅ loan_products
- ✅ loans
- ✅ payments
- ✅ kyc_submissions
- ✅ credit_scores

**Device & Agent** (4):
- ✅ devices
- ✅ device_locks
- ✅ distributors
- ✅ agent_inventory

**Admin & Support** (3):
- ✅ admin_users
- ✅ notifications
- ✅ support_tickets

**Product Management** (2):
- ✅ international_interest
- ✅ product_interest_waitlist

**WhatsApp** (2):
- ✅ whatsapp_sessions
- ✅ whatsapp_messages

**System** (2):
- ✅ audit_log
- ✅ system_config

### 3.2 Check Data
1. Click on **"customers"** table
2. You should see **3 rows**
3. Click on **"loans"** table
4. You should see **2 rows**

---

## Quick Troubleshooting

### "relation already exists"
**Solution**: Tables already created. Skip to Step 2 (test data).

### "syntax error"
**Solution**: Re-copy the SQL file. Don't modify it.

### Tables not showing
**Solution**: Hard refresh browser (Ctrl+Shift+R).

---

## What You Created

### Schema Summary
- **19 tables** for all Lynia Finance operations
- **50+ indexes** for fast queries
- **Row Level Security** enabled on 15 tables
- **Triggers** for auto-updating timestamps
- **Materialized views** for reporting
- **Default configurations** loaded

### Test Data Summary
- **3 admin users** (admin, manager, support)
- **2 distributors** (Harare, Bulawayo)
- **3 customers** (2 completed onboarding, 1 in progress)
- **2 loans** (1 active with payment, 1 approved pending disbursement)
- **3 devices** (Samsung and Redmi smartphones)
- **3 payments** (2 deposits, 1 installment)
- **2 KYC submissions** (both approved)
- **2 credit scores** (Tier 3: 750, Tier 2: 700)
- **2 notifications** (SMS and WhatsApp)
- **2 international interests** (Kenya, South Africa)
- **2 product waitlist entries** (Digital Credit)

---

## After Deployment

✅ **P2-T002 Complete!**

Next steps:
1. Update GitHub Issue #120 as complete
2. Move to **P2-T003: AWS Lambda Setup**
3. Then **P2-T004: Credit Scoring Service** (HIGHEST PRIORITY)

---

**Ready?** Open Supabase SQL Editor and deploy! 🚀

Takes only 5 minutes total.
