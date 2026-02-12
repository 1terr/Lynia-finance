# 02 - Database Migration

## Current State

- **Host**: Supabase managed PostgreSQL (`ghdrnxlsupbzoddtyxcp.supabase.co`)
- **Tables**: 35+ tables across 17 migrations
- **Size**: ~100 MB (estimated Year 1)
- **Connection**: `@supabase/supabase-js` client with `service_role_key` (bypasses RLS)
- **Pooling**: Supabase built-in PgBouncer
- **Extensions**: `uuid-ossp`, `pg_trgm` (trigram search)

## Target State

- **Host**: Amazon RDS PostgreSQL 16 (`db.t4g.micro` in `eu-west-2`)
- **Tables**: Same 35+ tables, identical schema
- **Connection**: `pg` (node-postgres) with connection pooling
- **Pooling**: RDS Proxy or application-level pooling via `pg.Pool`
- **Extensions**: Same -- RDS supports `uuid-ossp` and `pg_trgm`

## Step-by-Step Migration

### Step 1: Provision RDS Instance

Add to `infrastructure/aws/rds.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Lynia Finance - RDS PostgreSQL Database

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, production]
  DBMasterUsername:
    Type: String
    Default: lynia_admin
    NoEcho: true
  DBMasterPassword:
    Type: String
    NoEcho: true

Conditions:
  IsProduction: !Equals [!Ref Environment, production]

Resources:
  DatabaseSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Lynia Finance DB subnets
      SubnetIds:
        - !ImportValue
          Fn::Sub: "${Environment}-lynia-private-subnet-1"
        - !ImportValue
          Fn::Sub: "${Environment}-lynia-private-subnet-2"

  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: RDS access from Lambda functions
      VpcId: !ImportValue
        Fn::Sub: "${Environment}-lynia-vpc-id"
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !ImportValue
            Fn::Sub: "${Environment}-lynia-lambda-sg"

  DatabaseInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub "${Environment}-lynia-db"
      Engine: postgres
      EngineVersion: "16.4"
      DBInstanceClass: !If [IsProduction, db.t4g.small, db.t4g.micro]
      AllocatedStorage: 20
      MaxAllocatedStorage: 100  # Auto-scaling up to 100 GB
      StorageType: gp3
      MasterUsername: !Ref DBMasterUsername
      MasterUserPassword: !Ref DBMasterPassword
      DBName: lynia
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      DBSubnetGroupName: !Ref DatabaseSubnetGroup
      MultiAZ: !If [IsProduction, true, false]
      BackupRetentionPeriod: !If [IsProduction, 35, 7]
      StorageEncrypted: true
      DeletionProtection: !If [IsProduction, true, false]
      EnablePerformanceInsights: !If [IsProduction, true, false]
      PubliclyAccessible: false
      CopyTagsToSnapshot: true
      Tags:
        - Key: Environment
          Value: !Ref Environment
        - Key: Service
          Value: lynia-finance

Outputs:
  DatabaseEndpoint:
    Value: !GetAtt DatabaseInstance.Endpoint.Address
    Export:
      Name: !Sub "${Environment}-lynia-db-endpoint"
  DatabasePort:
    Value: !GetAtt DatabaseInstance.Endpoint.Port
    Export:
      Name: !Sub "${Environment}-lynia-db-port"
```

### Step 2: Run Existing Migrations

The 17 migration files in `database/migrations/` are standard SQL. They run
against any PostgreSQL instance, not just Supabase. The key change: remove
Supabase-specific auth functions.

```bash
# Connect to new RDS instance and run migrations in order
for migration in database/migrations/*.sql; do
  psql "$RDS_CONNECTION_STRING" -f "$migration"
done
```

**Modifications needed in migrations:**

1. **Remove `auth.uid()` references** -- Supabase's `auth.uid()` is a
   Supabase-specific function. Replace with application-level user context
   (see [04-rls-to-application-auth.md](./04-rls-to-application-auth.md)).

2. **Remove RLS policies** -- These reference `auth.uid()` and Supabase-specific
   helpers. Authorization moves to application layer.

3. **Keep everything else** -- Table definitions, indexes, triggers, constraints,
   partitioning, and functions like `update_updated_at_column()` work on any
   PostgreSQL.

Create a migration adapter script:

```sql
-- database/migrations/aws/000_pre_migration.sql
-- Run BEFORE other migrations on RDS

-- Create a stub for auth.uid() during migration
-- (will be removed after RLS policies are dropped)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true)::uuid;
END;
$$ LANGUAGE plpgsql;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

```sql
-- database/migrations/aws/018_remove_rls_for_aws.sql
-- Run AFTER all Supabase migrations to strip RLS

-- Disable RLS on all tables (authorization moves to app layer)
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END;
$$;

-- Drop Supabase-specific helper functions
DROP FUNCTION IF EXISTS public.is_admin_or_manager();
DROP FUNCTION IF EXISTS public.is_admin_staff();
DROP SCHEMA IF EXISTS auth CASCADE;
```

### Step 3: Replace Supabase Client in Backend Services

**Current** (`services/shared/clients/supabase.ts`):
```typescript
import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

**New** (`services/shared/clients/database.ts`):
```typescript
import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'lynia',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: true },
      max: 5,              // Lambda concurrency-safe
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// Thin query helper that mirrors Supabase's interface
export async function query<T>(
  text: string,
  params?: unknown[]
): Promise<{ data: T[]; error: Error | null }> {
  try {
    const result = await getPool().query(text, params);
    return { data: result.rows as T[], error: null };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

// Single-row fetch
export async function queryOne<T>(
  text: string,
  params?: unknown[]
): Promise<{ data: T | null; error: Error | null }> {
  const result = await query<T>(text, params);
  return { data: result.data[0] || null, error: result.error };
}

// Insert helper
export async function insert<T>(
  table: string,
  data: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const sql = `INSERT INTO ${table} (${keys.join(', ')})
               VALUES (${placeholders.join(', ')})
               RETURNING *`;
  return queryOne<T>(sql, values);
}

// Update helper
export async function update<T>(
  table: string,
  data: Record<string, unknown>,
  where: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  const setClauses: string[] = [];
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    setClauses.push(`${key} = $${idx++}`);
    values.push(val);
  }
  for (const [key, val] of Object.entries(where)) {
    whereClauses.push(`${key} = $${idx++}`);
    values.push(val);
  }

  const sql = `UPDATE ${table} SET ${setClauses.join(', ')}
               WHERE ${whereClauses.join(' AND ')}
               RETURNING *`;
  return queryOne<T>(sql, values);
}
```

### Step 4: Data Migration (Supabase → RDS)

```bash
# 1. Export from Supabase using pg_dump
pg_dump "postgresql://postgres:[password]@db.ghdrnxlsupbzoddtyxcp.supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=realtime \
  --exclude-schema=supabase_functions \
  > data_export.sql

# 2. Import into RDS
psql "$RDS_CONNECTION_STRING" -f data_export.sql

# 3. Verify row counts match
psql "$RDS_CONNECTION_STRING" -c "
  SELECT schemaname, relname, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
"
```

### Step 5: Connection Pooling

**Option A: Application-level pooling (Recommended for start)**

The `pg.Pool` in the database client above handles this. Set `max: 5` per
Lambda instance. With 100 concurrent Lambda executions, that's 500 max
connections -- well within RDS limits.

**Option B: RDS Proxy (Recommended for production)**

Add to CloudFormation when connection count becomes a concern:

```yaml
RDSProxy:
  Type: AWS::RDS::DBProxy
  Properties:
    DBProxyName: !Sub "${Environment}-lynia-proxy"
    EngineFamily: POSTGRESQL
    Auth:
      - AuthScheme: SECRETS
        IAMAuth: REQUIRED
        SecretArn: !Ref DatabaseSecret
    RoleArn: !GetAtt RDSProxyRole.Arn
    VpcSubnetIds:
      - !ImportValue
        Fn::Sub: "${Environment}-lynia-private-subnet-1"
      - !ImportValue
        Fn::Sub: "${Environment}-lynia-private-subnet-2"
    VpcSecurityGroupIds:
      - !Ref DatabaseSecurityGroup
```

Cost: ~$18/month for `db.t4g.micro`. Skip this initially and add when needed.

### Step 6: Update Environment Variables

**Remove:**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

**Add:**
```
DB_HOST=<rds-endpoint>.eu-west-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=lynia
DB_USER=lynia_admin
DB_PASSWORD=<stored-in-secrets-manager>
```

Store credentials in Secrets Manager (update `infrastructure/aws/secrets-manager.yaml`):

```yaml
DatabaseSecret:
  Type: AWS::SecretsManager::Secret
  Properties:
    Name: !Sub "${Environment}/lynia/database"
    SecretString: !Sub |
      {
        "host": "${DatabaseInstance.Endpoint.Address}",
        "port": "5432",
        "database": "lynia",
        "username": "${DBMasterUsername}",
        "password": "${DBMasterPassword}"
      }
```

### Step 7: Update Lambda VPC Configuration

Lambda functions need VPC access to reach the private RDS instance. Update
`template.yaml` globals:

```yaml
Globals:
  Function:
    VpcConfig:
      SecurityGroupIds:
        - !ImportValue
          Fn::Sub: "${Environment}-lynia-lambda-sg"
      SubnetIds:
        - !ImportValue
          Fn::Sub: "${Environment}-lynia-private-subnet-1"
        - !ImportValue
          Fn::Sub: "${Environment}-lynia-private-subnet-2"
```

**Cold start impact**: VPC-attached Lambda functions have ~1-2s additional cold
start. Mitigate with provisioned concurrency on critical paths (Payment,
Scoring) which is already configured in `lambda-autoscaling.yaml`.

## Backup Strategy

| Aspect | Configuration |
|--------|---------------|
| Automated backups | 35-day retention (production) |
| Manual snapshots | Before each migration, before major releases |
| Point-in-time recovery | Enabled (RDS default) |
| Cross-region backup | Optional -- enable for disaster recovery |

## Monitoring

Add RDS metrics to the existing CloudWatch technical dashboard:

- `CPUUtilization` -- alert at > 80%
- `FreeableMemory` -- alert at < 100 MB
- `DatabaseConnections` -- alert at > 80% of max
- `ReadLatency` / `WriteLatency` -- alert at > 20ms
- `FreeStorageSpace` -- alert at < 2 GB

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| RDS `db.t4g.micro` (on-demand) | $13.14 |
| 20 GB gp3 storage | $2.30 |
| Automated backups (20 GB) | $0.00 (included) |
| Data transfer (intra-VPC) | $0.00 |
| **Total** | **~$15.50/month** |

With AWS Free Tier (first 12 months): **$0.00/month** for `db.t4g.micro` with
20 GB storage.

Compare to Supabase Pro: $25/month with limited control over backups,
extensions, and scaling.
