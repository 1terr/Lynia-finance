# 08 - Backend Changes

## Scope

6 Lambda services need their database client replaced:

| Service | Supabase Usage | Complexity |
|---------|---------------|------------|
| `scoring-service` | Read customers, credit scores; write scores | Medium |
| `whatsapp-service` | Read/write sessions, messages, customers | Medium |
| `kyc-service` | Read/write kyc_submissions, update customers | Medium |
| `payment-service` | Read/write payments, transaction limits | High (financial) |
| `lock-service` | Read/write device_locks, devices | Medium |
| `notification-service` | Read customers, write notifications | Low |

All services import from `services/shared/clients/supabase.ts`.

## Migration Strategy

### Phase 1: Create Drop-in Database Client

Build a new `database.ts` client that provides a similar API to Supabase's
query builder, so service code changes are minimal.

**Create** `services/shared/clients/database.ts`:

```typescript
import { Pool, PoolConfig } from 'pg';
import { getSecret } from '../utils/secrets';

let pool: Pool | null = null;

interface DBSecret {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

async function getPool(): Promise<Pool> {
  if (pool) return pool;

  // Load credentials from Secrets Manager
  const secret = await getSecret<DBSecret>(
    `${process.env.NODE_ENV}/lynia/database`
  );

  const config: PoolConfig = {
    host: secret.host,
    port: parseInt(secret.port),
    database: secret.database,
    user: secret.username,
    password: secret.password,
    ssl: { rejectUnauthorized: true },
    max: 5,                     // Safe for Lambda concurrency
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 5000,
  };

  pool = new Pool(config);
  return pool;
}

/**
 * Query builder that provides a Supabase-like interface.
 * This minimizes code changes across services.
 *
 * Before: supabase.from('customers').select('*').eq('id', customerId)
 * After:  db.from('customers').select('*').eq('id', customerId).execute()
 */
export class QueryBuilder<T = any> {
  private table: string;
  private selectClause = '*';
  private whereClauses: string[] = [];
  private whereParams: unknown[] = [];
  private orderClause = '';
  private limitClause = '';
  private operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' = 'SELECT';
  private insertData: Record<string, unknown> | null = null;
  private updateData: Record<string, unknown> | null = null;
  private returnSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*'): this {
    this.selectClause = columns;
    this.operation = 'SELECT';
    return this;
  }

  insert(data: Record<string, unknown>): this {
    this.operation = 'INSERT';
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.operation = 'UPDATE';
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.operation = 'DELETE';
    return this;
  }

  upsert(data: Record<string, unknown>): this {
    this.operation = 'UPSERT';
    this.insertData = data;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} = $${this.whereParams.length}`);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} != $${this.whereParams.length}`);
    return this;
  }

  gt(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} > $${this.whereParams.length}`);
    return this;
  }

  gte(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} >= $${this.whereParams.length}`);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} < $${this.whereParams.length}`);
    return this;
  }

  lte(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} <= $${this.whereParams.length}`);
    return this;
  }

  in(column: string, values: unknown[]): this {
    const placeholders = values.map((v) => {
      this.whereParams.push(v);
      return `$${this.whereParams.length}`;
    });
    this.whereClauses.push(`${column} IN (${placeholders.join(', ')})`);
    return this;
  }

  is(column: string, value: null | boolean): this {
    if (value === null) {
      this.whereClauses.push(`${column} IS NULL`);
    } else {
      this.whereClauses.push(`${column} IS ${value ? 'TRUE' : 'FALSE'}`);
    }
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.whereParams.push(pattern);
    this.whereClauses.push(`${column} ILIKE $${this.whereParams.length}`);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    const dir = options?.ascending === false ? 'DESC' : 'ASC';
    this.orderClause = ` ORDER BY ${column} ${dir}`;
    return this;
  }

  limit(count: number): this {
    this.limitClause = ` LIMIT ${count}`;
    return this;
  }

  single(): this {
    this.returnSingle = true;
    this.limitClause = ' LIMIT 1';
    return this;
  }

  maybeSingle(): this {
    this.returnSingle = true;
    this.limitClause = ' LIMIT 1';
    return this;
  }

  async execute(): Promise<{ data: T | T[] | null; error: Error | null }> {
    const p = await getPool();
    const where = this.whereClauses.length > 0
      ? ` WHERE ${this.whereClauses.join(' AND ')}`
      : '';

    try {
      let sql: string;
      let params: unknown[];

      switch (this.operation) {
        case 'SELECT':
          sql = `SELECT ${this.selectClause} FROM ${this.table}${where}${this.orderClause}${this.limitClause}`;
          params = this.whereParams;
          break;

        case 'INSERT': {
          const keys = Object.keys(this.insertData!);
          const values = Object.values(this.insertData!);
          const placeholders = keys.map((_, i) => `$${i + 1}`);
          sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
          params = values;
          break;
        }

        case 'UPDATE': {
          const setClauses: string[] = [];
          const allParams: unknown[] = [];
          let idx = 1;
          for (const [key, val] of Object.entries(this.updateData!)) {
            setClauses.push(`${key} = $${idx++}`);
            allParams.push(val);
          }
          // Re-index where params
          const adjustedWhere = this.whereClauses.map((clause) => {
            return clause.replace(/\$(\d+)/g, () => `$${idx++}`);
          });
          allParams.push(...this.whereParams);
          sql = `UPDATE ${this.table} SET ${setClauses.join(', ')} WHERE ${adjustedWhere.join(' AND ')} RETURNING *`;
          params = allParams;
          break;
        }

        case 'DELETE':
          sql = `DELETE FROM ${this.table}${where} RETURNING *`;
          params = this.whereParams;
          break;

        case 'UPSERT': {
          const keys = Object.keys(this.insertData!);
          const values = Object.values(this.insertData!);
          const placeholders = keys.map((_, i) => `$${i + 1}`);
          const updates = keys.map((k, i) => `${k} = $${i + 1}`);
          sql = `INSERT INTO ${this.table} (${keys.join(', ')})
                 VALUES (${placeholders.join(', ')})
                 ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}
                 RETURNING *`;
          params = values;
          break;
        }

        default:
          throw new Error(`Unknown operation: ${this.operation}`);
      }

      const result = await p.query(sql, params);

      if (this.returnSingle) {
        return { data: result.rows[0] || null, error: null };
      }
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

/**
 * Database client with Supabase-compatible API.
 *
 * Usage:
 *   const { data, error } = await db.from('customers').select('*').eq('id', id).execute();
 */
export const db = {
  from: <T = any>(table: string) => new QueryBuilder<T>(table),
};
```

### Phase 2: Migrate Each Service

The migration for each service is mechanical: replace `getSupabaseClient()`
with `db` and add `.execute()` at the end of each query chain.

**Example -- Scoring Service:**

Before:
```typescript
import { getSupabaseClient } from '../../shared/clients/supabase';

const supabase = getSupabaseClient();
const { data: customer, error } = await supabase
  .from('customers')
  .select('*')
  .eq('id', customerId)
  .single();
```

After:
```typescript
import { db } from '../../shared/clients/database';

const { data: customer, error } = await db
  .from('customers')
  .select('*')
  .eq('id', customerId)
  .single()
  .execute();
```

The change is minimal: import source changes, and `.execute()` is appended.

### Phase 3: Service-by-Service Migration Order

Migrate in order of risk (lowest risk first):

1. **notification-service** -- read-only on customers, lowest risk
2. **lock-service** -- device management, isolated from financial data
3. **whatsapp-service** -- conversation state, can tolerate brief inconsistency
4. **kyc-service** -- KYC submissions, important but not financial
5. **scoring-service** -- credit scoring, read-heavy
6. **payment-service** -- financial transactions, highest risk, migrate last

### Phase 4: Update Dependencies

```bash
# In each service directory:
pnpm remove @supabase/supabase-js
pnpm add pg
pnpm add -D @types/pg
```

For the shared package:
```bash
cd services/shared
pnpm remove @supabase/supabase-js
pnpm add pg
pnpm add -D @types/pg
```

### Phase 5: Update Environment Variables in template.yaml

```yaml
Globals:
  Function:
    Environment:
      Variables:
        NODE_ENV: !Ref Environment
        # Remove these:
        # SUPABASE_URL: !Ref SupabaseUrl
        # SUPABASE_SERVICE_ROLE_KEY: !Ref SupabaseServiceRoleKey
        # Add this (credentials loaded from Secrets Manager at runtime):
        DB_SECRET_NAME: !Sub "${Environment}/lynia/database"
```

### Phase 6: Update SAM Parameters

Remove Supabase parameters from `template.yaml`:

```yaml
Parameters:
  # REMOVE:
  # SupabaseUrl:
  #   Type: String
  # SupabaseServiceRoleKey:
  #   Type: String
  #   NoEcho: true
```

Remove from `samconfig.toml`:

```toml
# REMOVE from all profiles:
# SupabaseUrl = "https://ghdrnxlsupbzoddtyxcp.supabase.co"
# SupabaseServiceRoleKey = "..."
```

### Phase 7: Update Lambda IAM Policies

Lambda functions need VPC access and Secrets Manager read for database
credentials:

```yaml
# Add to each function's Policies section:
- Statement:
    - Effect: Allow
      Action:
        - secretsmanager:GetSecretValue
      Resource:
        - !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:${Environment}/lynia/database-*"
```

VPC configuration (already defined in `template.yaml` as optional, make it
required for production):

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

## Testing Strategy

### Unit Tests

Update test mocks to use the new database client:

```typescript
// tests/helpers/mock-database.ts
jest.mock('../../shared/clients/database', () => ({
  db: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));
```

### Integration Tests

Run the existing integration test suite against the RDS database:

```bash
# Set RDS connection for tests
DB_HOST=localhost DB_PORT=5432 DB_NAME=lynia_test DB_USER=test DB_PASSWORD=test pnpm test:integration
```

Use a local PostgreSQL instance or a test RDS instance (not production).

### Smoke Tests

After deployment to staging:
1. Trigger each Lambda via test events in `events/` directory
2. Verify data is written to RDS (not Supabase)
3. Verify no Supabase connection attempts in CloudWatch logs
4. Run existing E2E tests

## Rollback Plan

Keep `services/shared/clients/supabase.ts` in the codebase during migration.
If a service fails after migration:

1. Revert the import in the failing service back to `supabase.ts`
2. Re-add Supabase env vars to `template.yaml`
3. Deploy the reverted service

Each service can be independently rolled back without affecting others.

## Cold Start Impact

| Component | Cold Start Impact |
|-----------|------------------|
| `@supabase/supabase-js` removed | -50ms (HTTP client overhead) |
| `pg` added | +20ms (TCP connection) |
| VPC attachment | +1-2s (ENI creation) |
| Secrets Manager fetch | +100ms (first call, then cached) |
| **Net impact** | **+1-2s on cold start** |

Mitigate with:
- Provisioned concurrency on Payment and Scoring (already configured)
- Keep-alive Lambda invocations via CloudWatch scheduled events
- NAT Gateway + VPC endpoint to reduce ENI cold starts
