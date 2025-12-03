# Database Schema Deployment Guide

**Task**: P2-T002 - Deploy Database Schema (19 tables)
**Duration**: 5 minutes
**Prerequisites**: Supabase project created and connection tested ✅

---

## Method 1: Manual Deployment (Recommended) ⭐

This is the most reliable method for initial schema deployment.

### Step 1: Open Supabase SQL Editor

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Click on your project: **lynia-finance-dev**
3. In the left sidebar, click **"SQL Editor"** (icon looks like </> )

### Step 2: Create New Query

1. Click **"New Query"** button (top right, or + icon)
2. You'll see an empty SQL editor

### Step 3: Copy Schema SQL

1. Open file: `database/migrations/001_initial_schema.sql`
2. Select ALL content (Ctrl+A)
3. Copy (Ctrl+C)

### Step 4: Paste and Execute

1. Paste into Supabase SQL Editor (Ctrl+V)
2. Click **"Run"** button (bottom right, or Ctrl+Enter)
3. Wait 10-15 seconds for execution

### Step 5: Verify Success

You should see:
```
Success. No rows returned
```

Or detailed output with NOTICE messages:
```
✅ Database schema created successfully!
📊 Total tables: 19
🔒 RLS enabled on 15 tables
...
```

### Step 6: Verify Tables Created

1. In left sidebar, click **"Table Editor"**
2. You should see 19 tables:
   - customers
   - loan_products
   - loans
   - payments
   - kyc_submissions
   - credit_scores
   - devices
   - device_locks
   - distributors
   - agent_inventory
   - admin_users
   - notifications
   - support_tickets
   - international_interest
   - product_interest_waitlist
   - whatsapp_sessions
   - whatsapp_messages
   - audit_log
   - system_config

---

## Method 2: Automated Script (Alternative)

If you prefer automation, try the deployment script:

```bash
node scripts/deploy-schema.js
```

**Note**: This may not work on all Supabase plans. If it fails, use Method 1 (manual deployment).

---

## What Gets Created

### 19 Database Tables

| # | Table Name | Description |
|---|------------|-------------|
| 1 | customers | Customer accounts and profiles |
| 2 | loan_products | Loan product configurations |
| 3 | loans | Loan applications and status |
| 4 | payments | Payment transactions |
| 5 | kyc_submissions | KYC verification submissions |
| 6 | credit_scores | Credit scoring results |
| 7 | devices | Device inventory |
| 8 | device_locks | Device lock/unlock events |
| 9 | distributors | Agent/distributor accounts |
| 10 | agent_inventory | Agent inventory management |
| 11 | admin_users | Admin dashboard users |
| 12 | notifications | SMS/WhatsApp notifications |
| 13 | support_tickets | Customer support tickets |
| 14 | international_interest | Non-Zimbabwe inquiries |
| 15 | product_interest_waitlist | "Launching soon" waitlist |
| 16 | whatsapp_sessions | WhatsApp conversation sessions |
| 17 | whatsapp_messages | WhatsApp message history |
| 18 | audit_log | System audit trail |
| 19 | system_config | System configuration |

### Additional Features

- **UUID Extension**: Enabled for unique IDs
- **Indexes**: 50+ indexes for query performance
- **Row Level Security (RLS)**: Enabled on 15 sensitive tables
- **RLS Policies**: Basic policies for customer and admin access
- **Triggers**: Auto-update `updated_at` fields
- **Materialized Views**: Portfolio summary for reporting
- **Default Data**:
  - 1 loan product: "Smartphone Financing"
  - 5 system config entries

---

## Troubleshooting

### Error: "relation already exists"

**Cause**: Tables already exist from previous run.

**Solution**:
1. Drop all tables first (dangerous - only for fresh setup):
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
2. Re-run the schema migration

### Error: "permission denied"

**Cause**: Using wrong API key.

**Solution**: Ensure you're using the **service_role** key, not the anon key.

### Error: "syntax error near..."

**Cause**: SQL copied incorrectly.

**Solution**:
1. Re-copy the entire file
2. Ensure no extra characters added
3. Don't modify the SQL

### Tables not showing in Table Editor

**Cause**: Browser cache or page not refreshed.

**Solution**:
1. Hard refresh page (Ctrl+Shift+R)
2. Clear browser cache
3. Try different browser

---

## Verification Checklist

After deployment, verify:

- [ ] All 19 tables visible in Table Editor
- [ ] `loan_products` table has 1 row (Smartphone Financing)
- [ ] `system_config` table has 5 rows
- [ ] No error messages in SQL Editor
- [ ] Can view table structure (click any table name)

---

## Next Steps

After successful schema deployment:

1. ✅ **Load Test Data** (P2-T002 continued)
   - Run: `node scripts/load-test-data.js`
   - Or manually execute: `database/seed/001_test_data.sql`

2. ✅ **Verify Database Setup**
   - Check test customers created
   - Verify test loans exist
   - Confirm data relationships

3. ✅ **Update GitHub Issue**
   - Comment on [Issue #120](https://github.com/1terr/Lynia-finance/issues/120)
   - Mark schema deployment complete

4. ⏭️ **Move to P2-T003: AWS Lambda Setup**

---

## Database Schema Details

### Key Design Decisions

1. **Multi-Product Architecture**: `loan_products` table supports future products
2. **Zimbabwe-Only Policy**: `international_interest` table captures non-ZW leads
3. **5-Component Credit Scoring**: `credit_scores` tracks all scoring components
4. **Device Management**: Separate tables for `devices` and `device_locks`
5. **WhatsApp State Machine**: `whatsapp_sessions` stores conversation state
6. **Audit Trail**: `audit_log` tracks all system actions

### Foreign Key Relationships

```
customers (1) ──→ (many) loans
customers (1) ──→ (many) kyc_submissions
customers (1) ──→ (many) credit_scores
customers (1) ──→ (many) payments
customers (1) ──→ (many) whatsapp_sessions

loans (1) ──→ (many) payments
loans (1) ──→ (1) devices
loans (1) ──→ (many) device_locks

loan_products (1) ──→ (many) loans

distributors (1) ──→ (many) agent_inventory
devices (1) ──→ (many) device_locks

admin_users (1) ──→ (many) loans [approved_by]
admin_users (1) ──→ (many) kyc_submissions [reviewed_by]
admin_users (1) ──→ (many) support_tickets [assigned_to]
```

---

## Support

**Need Help?**
- Check [SUPABASE-SETUP-GUIDE.md](SUPABASE-SETUP-GUIDE.md)
- Review Supabase docs: https://supabase.com/docs/guides/database
- Check GitHub issue [#120](https://github.com/1terr/Lynia-finance/issues/120)

---

**Ready?** Open Supabase SQL Editor and deploy the schema! 🚀
