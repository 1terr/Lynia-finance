# M3: Run Database Migrations

**Time**: ~5 minutes
**Depends on**: M2 (RDS must be deployed and accessible)
**What this does**: Creates all the database tables, indexes, and initial data that Lynia Finance needs.

## What You Need

- RDS endpoint from M2
- Database password from M2
- Network access to the RDS instance (bastion host, VPN, or SSM tunnel)

## Step-by-Step

### 1. Set up database connection

```bash
export ENV=development

# Paste your values from M2:
export DB_HOST=lynia-development.xxxxx.us-east-1.rds.amazonaws.com
export DB_PORT=5432
export DB_NAME=lynia
export DB_USER=lynia_admin
export DB_PASSWORD=REPLACE_WITH_YOUR_PASSWORD

# Build the connection string
export DB_CONNECTION="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
```

### 2. If you need a tunnel (common for private RDS)

The RDS instance is in a private subnet. You need a tunnel to reach it. The simplest way is AWS SSM Session Manager:

```bash
# Option A: SSM port forwarding (if you have a bastion EC2 instance)
aws ssm start-session \
  --target i-YOUR_BASTION_INSTANCE_ID \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"${DB_HOST}\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5432\"]}"

# Then in a new terminal, use localhost:5432 as the host
export DB_CONNECTION="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
```

```bash
# Option B: If your machine has direct VPC access (VPN, etc.)
# Just use the DB_CONNECTION as-is
```

### 3. Run the migration script

```bash
bash database/deploy-to-rds.sh "${DB_CONNECTION}"
```

This script runs migrations in order:
1. `000_pre_migration.sql` -- Creates auth schema stub, enables extensions
2. `001_initial_schema.sql` through `021_fineract_rbz_reporting.sql` -- All tables
3. `018_remove_rls_for_aws.sql` -- Removes Supabase-specific row-level security

### 4. Verify the migration

```bash
# Connect to the database and check tables exist
psql "${DB_CONNECTION}" -c "\dt"
```

**Expected output**: You should see 19+ tables including:
- `customers`
- `loans`
- `transactions`
- `devices`
- `kyc_verifications`
- `payment_methods`
- `notifications`
- `audit_logs`

### 5. (Optional) Seed test data for development/staging

```bash
# Only do this for non-production environments!
if [ "${ENV}" != "production" ]; then
  psql "${DB_CONNECTION}" -f database/seed/001_test_data.sql
  echo "Test data seeded successfully"
fi
```

## Troubleshooting

**"connection refused" or "timeout"**
You cannot reach the RDS instance directly from your laptop. You need an SSM tunnel or bastion host. See Step 2.

**"password authentication failed"**
Double-check the password from M2. Make sure there are no trailing spaces. Try wrapping in single quotes.

**"database lynia does not exist"**
The RDS template should create the database automatically. If not:
```bash
psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres" \
  -c "CREATE DATABASE lynia;"
```

**Migration fails on a specific file**
If a migration partially ran, note which migration number failed, fix the issue, and re-run just that migration:
```bash
psql "${DB_CONNECTION}" -f database/migrations/NNN_filename.sql
```

## What Happens Next

- Proceed to **M8: Populate Secrets Manager** (needs the same DB credentials)
