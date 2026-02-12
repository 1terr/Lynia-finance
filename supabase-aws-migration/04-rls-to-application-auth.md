# 04 - RLS to Application-Layer Authorization

## Current State: Row Level Security

Supabase enforces data access at the PostgreSQL level using RLS policies. Every
table has policies that reference `auth.uid()` (the Supabase-managed user ID
from the JWT).

### Current RLS Pattern

```sql
-- Customers can only see their own data
CREATE POLICY "Customers view own data" ON customers
  FOR SELECT USING (customer_id = auth.uid());

-- Admins can see everything
CREATE POLICY "Admins manage all" ON customers
  FOR ALL USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Distributors see their own inventory
CREATE POLICY "Distributors view own inventory" ON agent_inventory
  FOR SELECT USING (distributor_id = auth.uid());
```

### Why RLS Won't Work on RDS

1. `auth.uid()` is a Supabase-specific function -- it doesn't exist on standard PostgreSQL
2. RLS requires the database connection to carry user identity. Supabase injects this via the JWT in the anon key connection. On RDS, Lambda connects with a single service account.
3. Backend services already bypass RLS using the `service_role_key` -- so all actual data access is already application-controlled.

### The Good News

**Backend services already bypass RLS.** Every Lambda function uses
`SUPABASE_SERVICE_ROLE_KEY`, which skips all RLS policies. The authorization
logic that matters is in the application code. RLS is only enforced on
frontend direct-to-Supabase queries.

**Frontend migration removes direct database access.** After migration,
frontends call Lambda APIs (through API Gateway) instead of querying Supabase
directly. Authorization moves entirely to the API layer.

## Target State: Application-Layer Authorization

```
┌─────────────┐    JWT Token    ┌──────────────┐    Auth Check    ┌──────────┐
│   Frontend   │ ──────────────▶│ API Gateway  │ ──────────────▶  │  Lambda  │
│  (Cognito)   │                │  (Cognito    │                  │ Function │
│              │                │  Authorizer) │                  │          │
└─────────────┘                └──────────────┘                  └────┬─────┘
                                                                      │
                                                              ┌───────▼───────┐
                                                              │ Authorization │
                                                              │  Middleware   │
                                                              │               │
                                                              │ checkRole()   │
                                                              │ checkOwner()  │
                                                              │ filterData()  │
                                                              └───────┬───────┘
                                                                      │
                                                              ┌───────▼───────┐
                                                              │  PostgreSQL   │
                                                              │  (no RLS)     │
                                                              └───────────────┘
```

## Implementation

### Step 1: Authorization Middleware

Create `services/shared/middleware/authorization.ts`:

```typescript
import { APIGatewayProxyEvent } from 'aws-lambda';

// Roles that mirror the current RLS helper functions
type Role = 'admin' | 'manager' | 'support' | 'reports_viewer' | 'distributor' | 'customer';

interface AuthContext {
  userId: string;
  email: string;
  roles: Role[];
}

/**
 * Extract auth context from Cognito-validated API Gateway event.
 * Replaces auth.uid() from Supabase.
 */
export function getAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) {
    throw createAuthError('AUTH_TOKEN_001', 'Missing authentication');
  }

  return {
    userId: claims.sub,
    email: claims.email,
    roles: parseGroups(claims['cognito:groups']),
  };
}

/**
 * Replaces: is_admin_or_manager() SQL function
 */
export function isAdminOrManager(auth: AuthContext): boolean {
  return auth.roles.some(r => r === 'admin' || r === 'manager');
}

/**
 * Replaces: is_admin_staff() SQL function
 */
export function isAdminStaff(auth: AuthContext): boolean {
  return auth.roles.some(r =>
    ['admin', 'manager', 'support', 'reports_viewer'].includes(r)
  );
}

/**
 * Enforce role requirement. Throws 403 if not authorized.
 * Replaces RLS USING clauses.
 */
export function requireRole(auth: AuthContext, ...allowedRoles: Role[]): void {
  const hasRole = auth.roles.some(r => allowedRoles.includes(r));
  if (!hasRole) {
    throw createAuthError(
      'AUTH_ROLE_001',
      'Insufficient permissions'
    );
  }
}

/**
 * Enforce resource ownership. Replaces RLS "customer_id = auth.uid()".
 */
export function requireOwnership(
  auth: AuthContext,
  resourceOwnerId: string,
  allowAdminOverride = true
): void {
  if (auth.userId === resourceOwnerId) return;
  if (allowAdminOverride && isAdminOrManager(auth)) return;

  throw createAuthError(
    'AUTH_OWNER_001',
    'Access denied: you do not own this resource'
  );
}

/**
 * Build a WHERE clause for data filtering.
 * Replaces RLS row-level filtering.
 *
 * Admin/manager: no filter (see all rows)
 * Distributor: filter by distributor_id
 * Customer: filter by customer_id
 */
export function buildAccessFilter(
  auth: AuthContext,
  ownerColumn: string
): { clause: string; params: unknown[] } {
  if (isAdminOrManager(auth)) {
    return { clause: '1=1', params: [] };  // No filter
  }

  if (isAdminStaff(auth)) {
    return { clause: '1=1', params: [] };  // Support/reports can read
  }

  // Distributor or customer: filter by their own ID
  return {
    clause: `${ownerColumn} = $1`,
    params: [auth.userId],
  };
}

function parseGroups(groups: string | undefined): Role[] {
  if (!groups) return [];
  return groups.split(',').filter(Boolean) as Role[];
}

function createAuthError(code: string, message: string) {
  const error = new Error(message);
  (error as any).code = code;
  (error as any).statusCode = 403;
  return error;
}
```

### Step 2: Apply Authorization in Lambda Handlers

**Before (Supabase RLS handles this implicitly):**
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  const supabase = getSupabaseClient();
  // RLS automatically filters by auth.uid()
  const { data } = await supabase.from('customers').select('*');
  return { statusCode: 200, body: JSON.stringify(data) };
};
```

**After (explicit authorization):**
```typescript
import { getAuthContext, requireRole, buildAccessFilter } from '../shared/middleware/authorization';
import { query } from '../shared/clients/database';

export const handler = async (event: APIGatewayProxyEvent) => {
  const auth = getAuthContext(event);

  // GET /customers -- admins see all, customers see own
  const filter = buildAccessFilter(auth, 'id');
  const { data, error } = await query(
    `SELECT id, full_name, phone, kyc_status, credit_tier
     FROM customers
     WHERE ${filter.clause}`,
    filter.params
  );

  if (error) return errorResponse(500, error.message);
  return { statusCode: 200, body: JSON.stringify({ data }) };
};
```

### Step 3: Map Every RLS Policy to Application Logic

| RLS Policy | Table | New Application Logic |
|-----------|-------|----------------------|
| Customers view own data | `customers` | `buildAccessFilter(auth, 'id')` |
| Admins manage all customers | `customers` | `requireRole(auth, 'admin', 'manager')` for write ops |
| Distributors view own inventory | `agent_inventory` | `buildAccessFilter(auth, 'distributor_id')` |
| Distributors view own commissions | `distributor_commissions` | `buildAccessFilter(auth, 'distributor_id')` |
| Customers view own loans | `loans` | `buildAccessFilter(auth, 'customer_id')` |
| Customers view own payments | `payments` | `buildAccessFilter(auth, 'customer_id')` |
| Staff view all KYC | `kyc_submissions` | `requireRole(auth, 'admin', 'manager', 'support')` |
| Admin-only audit log | `audit_log` | `requireRole(auth, 'admin')` |
| Admin-only system config | `system_config` | `requireRole(auth, 'admin')` |
| Active products for auth users | `loan_products` | No filter needed (auth check via API Gateway) |

### Step 4: Testing the Authorization Layer

```typescript
// tests/unit/authorization.test.ts
describe('Authorization Middleware', () => {
  const adminAuth: AuthContext = {
    userId: 'admin-uuid',
    email: 'admin@lynia.co.zw',
    roles: ['admin'],
  };

  const customerAuth: AuthContext = {
    userId: 'customer-uuid',
    email: 'customer@example.com',
    roles: ['customer'],
  };

  describe('requireRole', () => {
    it('allows admin access to admin-only routes', () => {
      expect(() => requireRole(adminAuth, 'admin')).not.toThrow();
    });

    it('blocks customer from admin routes', () => {
      expect(() => requireRole(customerAuth, 'admin')).toThrow();
    });
  });

  describe('buildAccessFilter', () => {
    it('returns no filter for admins', () => {
      const filter = buildAccessFilter(adminAuth, 'customer_id');
      expect(filter.clause).toBe('1=1');
      expect(filter.params).toHaveLength(0);
    });

    it('filters by owner for customers', () => {
      const filter = buildAccessFilter(customerAuth, 'customer_id');
      expect(filter.clause).toBe('customer_id = $1');
      expect(filter.params).toEqual(['customer-uuid']);
    });
  });

  describe('requireOwnership', () => {
    it('allows owner access', () => {
      expect(() =>
        requireOwnership(customerAuth, 'customer-uuid')
      ).not.toThrow();
    });

    it('allows admin override', () => {
      expect(() =>
        requireOwnership(adminAuth, 'other-uuid', true)
      ).not.toThrow();
    });

    it('blocks non-owner non-admin', () => {
      expect(() =>
        requireOwnership(customerAuth, 'other-uuid')
      ).toThrow();
    });
  });
});
```

## Security Considerations

### What We Lose

- **Database-level enforcement**: RLS is a defense-in-depth layer. Without it,
  a bug in application code could expose unauthorized data.

### How We Compensate

1. **Centralized authorization middleware** -- all access checks go through
   `authorization.ts`, not scattered across handlers
2. **Unit tests for every policy** -- test matrix covering all role/resource
   combinations
3. **API Gateway Cognito authorizer** -- unauthenticated requests never reach
   Lambda
4. **Audit logging** -- log every data access with user ID and action
5. **Code review checklist** -- authorization check required on every endpoint

### Defense in Depth (Optional)

If you want database-level enforcement on RDS, you can still use RLS with
application-set session variables:

```typescript
// Set user context before each query
await client.query(`SET LOCAL app.current_user_id = $1`, [auth.userId]);
await client.query(`SET LOCAL app.current_user_roles = $1`, [auth.roles.join(',')]);
// Then RLS policies reference current_setting('app.current_user_id')
```

This is more complex to maintain but preserves the defense-in-depth approach.
Consider adding this for production after the initial migration stabilizes.
