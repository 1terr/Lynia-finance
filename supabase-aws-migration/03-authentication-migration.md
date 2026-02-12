# 03 - Authentication Migration

## Current State: Supabase Auth

### What's Being Used

| Feature | Location | Details |
|---------|----------|---------|
| Email/password login | `frontend/admin-portal/src/lib/auth/context.tsx` | `supabase.auth.signInWithPassword()` |
| Session management | `frontend/admin-portal/src/lib/supabase/middleware.ts` | Cookie-based via `@supabase/ssr` |
| JWT tokens | All Lambda services | Validated via `SUPABASE_SERVICE_ROLE_KEY` |
| Auth state listener | `frontend/distributor-dashboard/src/components/layout/auth-provider.tsx` | `supabase.auth.onAuthStateChange()` |
| Server-side auth | `frontend/admin-portal/src/lib/supabase/server.ts` | `createServerClient()` with cookies |
| Role-based access | RLS policies | `auth.uid()` in PostgreSQL policies |

### User Types

1. **Admin users** -- staff members (admin, manager, support, reports_viewer roles)
2. **Distributors** -- field agents with inventory and commission access
3. **Customers** -- end users (primarily via WhatsApp, not web auth)

## Target State: Amazon Cognito

### Why Cognito

- **Free tier**: 50,000 MAUs free (indefinitely, not time-limited)
- **JWT compatible**: Issues standard JWT tokens, works with API Gateway authorizer
- **MFA built-in**: SMS and TOTP support
- **Groups**: Maps directly to roles (admin, manager, support, distributor)
- **Hosted UI**: Optional login page reduces frontend work
- **AWS integration**: Native API Gateway authorizer, no custom Lambda needed

### Cost at Scale

| MAUs | Cognito Cost | Supabase Pro Cost |
|------|-------------|-------------------|
| 0 - 50,000 | $0.00 | $25/month (base) |
| 50,001 - 100,000 | $0.0055/MAU = $275 | $25 + usage |
| 100,001+ | $0.0046/MAU | Custom pricing |

For Lynia's current scale (< 1,000 admin + distributor users), Cognito is
**free indefinitely**.

## Migration Steps

### Step 1: Create Cognito User Pool

Add `infrastructure/aws/cognito.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Lynia Finance - Cognito User Pool

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, production]

Resources:
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: !Sub "${Environment}-lynia-users"
      AutoVerifiedAttributes:
        - email
      UsernameAttributes:
        - email
      MfaConfiguration: OPTIONAL  # Enable MFA for admins
      Policies:
        PasswordPolicy:
          MinimumLength: 12
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: true
      Schema:
        - Name: email
          Required: true
          Mutable: true
        - Name: role
          AttributeDataType: String
          Mutable: true
        - Name: display_name
          AttributeDataType: String
          Mutable: true
        - Name: organization_id
          AttributeDataType: String
          Mutable: true
      AccountRecoverySetting:
        RecoveryMechanisms:
          - Name: verified_email
            Priority: 1
      UserPoolAddOns:
        AdvancedSecurityMode: ENFORCED  # Detects compromised creds

  # App client for admin portal
  AdminPortalClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      ClientName: !Sub "${Environment}-admin-portal"
      UserPoolId: !Ref UserPool
      GenerateSecret: false  # Public client (SPA)
      ExplicitAuthFlows:
        - ALLOW_USER_SRP_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
      PreventUserExistenceErrors: ENABLED
      AccessTokenValidity: 1     # 1 hour
      IdTokenValidity: 1         # 1 hour
      RefreshTokenValidity: 30   # 30 days
      TokenValidityUnits:
        AccessToken: hours
        IdToken: hours
        RefreshToken: days

  # App client for distributor dashboard
  DistributorClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      ClientName: !Sub "${Environment}-distributor-dashboard"
      UserPoolId: !Ref UserPool
      GenerateSecret: false
      ExplicitAuthFlows:
        - ALLOW_USER_SRP_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
      PreventUserExistenceErrors: ENABLED
      AccessTokenValidity: 1
      IdTokenValidity: 1
      RefreshTokenValidity: 7    # Shorter for field agents

  # User groups matching current roles
  AdminGroup:
    Type: AWS::Cognito::UserPoolGroup
    Properties:
      GroupName: admin
      UserPoolId: !Ref UserPool
      Description: Full system administrators
      Precedence: 0

  ManagerGroup:
    Type: AWS::Cognito::UserPoolGroup
    Properties:
      GroupName: manager
      UserPoolId: !Ref UserPool
      Description: Operations managers
      Precedence: 1

  SupportGroup:
    Type: AWS::Cognito::UserPoolGroup
    Properties:
      GroupName: support
      UserPoolId: !Ref UserPool
      Description: Customer support staff
      Precedence: 2

  ReportsViewerGroup:
    Type: AWS::Cognito::UserPoolGroup
    Properties:
      GroupName: reports_viewer
      UserPoolId: !Ref UserPool
      Description: Read-only reports access
      Precedence: 3

  DistributorGroup:
    Type: AWS::Cognito::UserPoolGroup
    Properties:
      GroupName: distributor
      UserPoolId: !Ref UserPool
      Description: Field agents and distributors
      Precedence: 4

Outputs:
  UserPoolId:
    Value: !Ref UserPool
    Export:
      Name: !Sub "${Environment}-lynia-user-pool-id"
  UserPoolArn:
    Value: !GetAtt UserPool.Arn
    Export:
      Name: !Sub "${Environment}-lynia-user-pool-arn"
  AdminClientId:
    Value: !Ref AdminPortalClient
    Export:
      Name: !Sub "${Environment}-lynia-admin-client-id"
  DistributorClientId:
    Value: !Ref DistributorClient
    Export:
      Name: !Sub "${Environment}-lynia-distributor-client-id"
```

### Step 2: Migrate Existing Users

**Option A: Batch CSV import (recommended for < 10k users)**

```bash
# Export users from Supabase
psql "$SUPABASE_DB_URL" -c "
  COPY (
    SELECT
      email,
      raw_user_meta_data->>'role' as role,
      raw_user_meta_data->>'display_name' as display_name,
      created_at
    FROM auth.users
    WHERE deleted_at IS NULL
  ) TO STDOUT WITH CSV HEADER;
" > users_export.csv

# Import into Cognito via AWS CLI
aws cognito-idp admin-create-user \
  --user-pool-id <pool-id> \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
                    Name=custom:role,Value=admin \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS  # Don't send welcome email yet
```

**Option B: Lazy migration (for larger user bases)**

Keep Supabase Auth running temporarily. On login attempt:
1. Try Cognito first
2. If user not found, verify against Supabase
3. If Supabase succeeds, create user in Cognito
4. Return Cognito tokens

```typescript
// services/shared/utils/auth-migration.ts
async function lazyMigrateUser(email: string, password: string) {
  try {
    // Try Cognito first
    return await cognitoSignIn(email, password);
  } catch (err) {
    if (err.code === 'UserNotFoundException') {
      // Fall back to Supabase
      const supabaseResult = await supabase.auth.signInWithPassword({
        email, password
      });
      if (supabaseResult.data.user) {
        // Create in Cognito with same password
        await createCognitoUser(email, password, supabaseResult.data.user);
        return await cognitoSignIn(email, password);
      }
    }
    throw err;
  }
}
```

### Step 3: Replace Frontend Auth Code

**Current** (`frontend/admin-portal/src/lib/auth/context.tsx`):
```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password });
const { data: { session } } = await supabase.auth.getSession();
await supabase.auth.signOut();
```

**New** (`frontend/admin-portal/src/lib/auth/cognito-context.tsx`):
```typescript
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
});

// Sign in
async function signIn(email: string, password: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  const authDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        // session.getIdToken().getJwtToken() -- use for API calls
        // session.getAccessToken().payload['cognito:groups'] -- user roles
        resolve();
      },
      onFailure: reject,
      newPasswordRequired: (userAttributes) => {
        // Handle first-time login password change
      },
    });
  });
}

// Get current session (replaces supabase.auth.getSession())
function getSession(): Promise<CognitoUserSession | null> {
  const user = userPool.getCurrentUser();
  if (!user) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) reject(err);
      else resolve(session);
    });
  });
}

// Sign out
function signOut(): void {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
}
```

### Step 4: Update API Gateway Authorizer

Replace Supabase JWT validation with Cognito authorizer in `template.yaml`:

```yaml
Resources:
  LyniaApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: Prod
      Auth:
        DefaultAuthorizer: CognitoAuthorizer
        Authorizers:
          CognitoAuthorizer:
            UserPoolArn: !ImportValue
              Fn::Sub: "${Environment}-lynia-user-pool-arn"
```

This automatically validates Cognito JWTs on all API routes. No custom Lambda
authorizer needed.

### Step 5: Extract User Info in Lambda

**Current** (using Supabase `auth.uid()` indirectly via RLS):
```typescript
const { data } = await supabase.from('customers').select('*');
// RLS automatically filters by auth.uid()
```

**New** (Cognito claims available in Lambda event):
```typescript
// services/shared/utils/auth.ts
interface AuthContext {
  userId: string;      // Cognito sub (UUID)
  email: string;
  groups: string[];    // ['admin', 'manager'] etc.
}

export function getAuthContext(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) throw new Error('No auth context');

  return {
    userId: claims.sub,
    email: claims.email,
    groups: (claims['cognito:groups'] || '').split(',').filter(Boolean),
  };
}

export function requireRole(auth: AuthContext, ...roles: string[]): void {
  const hasRole = roles.some(role => auth.groups.includes(role));
  if (!hasRole) {
    throw new Error(`Forbidden: requires one of [${roles.join(', ')}]`);
  }
}
```

### Step 6: Update Middleware (Next.js)

**Current** (`frontend/admin-portal/src/lib/supabase/middleware.ts`):
Server-side session refresh using Supabase cookies.

**New** (`frontend/admin-portal/src/middleware.ts`):
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Cognito stores tokens in localStorage (client-side)
  // For SSR, check for a session cookie or redirect to login
  const token = request.cookies.get('cognito-id-token')?.value;

  if (!token && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
};
```

## Environment Variables

**Remove:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Add:**
```
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-2_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=eu-west-2
```

## Dependencies

**Remove:**
```
@supabase/supabase-js
@supabase/ssr
```

**Add:**
```
amazon-cognito-identity-js   # ~180 KB, pure JS, no framework dependency
```

Or use AWS Amplify Auth (heavier but more features):
```
@aws-amplify/auth            # If you want hosted UI, social login later
```

**Recommendation**: Use `amazon-cognito-identity-js` directly. It's lighter,
has no framework opinions, and gives full control. Amplify adds significant
bundle size.

## Cost

| Component | Monthly Cost |
|-----------|-------------|
| Cognito User Pool (< 50k MAUs) | $0.00 |
| SMS MFA (if enabled) | $0.05/message |
| Advanced security features | $0.05/MAU (optional) |
| **Total (current scale)** | **$0.00** |

## Rollback Plan

Keep Supabase Auth running during the transition period. Both auth systems can
coexist. If Cognito migration fails:

1. Revert frontend to Supabase auth calls
2. Revert API Gateway authorizer
3. Re-enable RLS policies
4. No data loss -- user accounts exist in both systems
