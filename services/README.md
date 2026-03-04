# Lynia Finance Services

Microservices for the Lynia Finance platform.

## Services

- **admin-service**: Admin portal API (users, config, audit, products, devices, orgs, inventory)
- **distributor-service**: Distributor portal API (profile, stats, inventory, handovers, commissions)
- **dw-sync-service**: Data warehouse real-time sync
- **fineract-proxy-service**: Fineract core banking proxy (loans, products, GL, reports)
- **form-submission-service**: Public form capture (no auth)
- **investor-reporting-service**: Investor portfolio & covenant reporting
- **kyc-service**: KYC verification with DIDIT
- **lock-service**: Device lock/unlock management via Trustonic
- **notification-service**: Multi-channel notifications + reminder scheduling
- **payment-service**: Mobile money payment processing (InnBucks, EcoCash, OneWallet, OMari)
- **scoring-service**: Credit scoring algorithm (5-component affordability model)
- **whatsapp-service**: WhatsApp bot conversation flow

## Development

```bash
# Install dependencies
pnpm install

# Run all services in dev mode
pnpm dev

# Run specific service
cd scoring-service
pnpm dev

# Run tests
pnpm test
```

See individual service README files for detailed documentation.

## Lambda Router

All services should use the shared `lambda-router` utility for request routing
instead of if/else chains. The router is located at
`services/shared/utils/lambda-router.ts`.

### Why

- **Testable**: Route definitions are declarative and easy to verify.
- **Consistent**: Every service gets the same OPTIONS handling, 404/405
  responses, security headers, auth context extraction, and structured logging.
- **Parameterized paths**: Extract `:id` segments automatically.
- **Zero dependencies**: No external packages — keeps Lambda cold starts fast.

### Usage

```typescript
import { createRouter, RouteHandler } from '../../shared/utils/lambda-router';

// Define handlers (each in its own file for large services)
const handleGetUsers: RouteHandler = async (event, params, auth) => {
  // params: extracted path parameters (e.g. { id: 'abc-123' })
  // auth: { userId, email, roles } from Cognito JWT
  return successResponse(users, 200, event);
};

// Define route map
const routes = {
  'GET /admin/users': handleGetUsers,
  'GET /admin/users/:id': handleGetUserById,
  'POST /admin/users': handleCreateUser,
  'PUT /admin/users/:id': handleUpdateUser,
  'DELETE /admin/users/:id': handleDeleteUser,
};

// Export single handler
export const handler = createRouter(routes, { serviceName: 'admin-service' });
```

### Router features

| Feature | Behavior |
|---------|----------|
| `OPTIONS` preflight | Returns 204 with CORS headers automatically |
| Unmatched path | Returns 404 `{ success: false, error: "Not Found" }` |
| Wrong method | Returns 405 `{ success: false, error: "Method Not Allowed" }` |
| Handler error | Catches and returns 500 with `requestId` |
| Auth errors (403/401) | Propagated with correct status code |
| Security headers | Included in all responses (CORS, CSP, HSTS, etc.) |
| Logging | Request start/complete/fail logged via shared logger |
| Request context | `setRequestContext` / `clearRequestContext` called automatically |

### Migration from if/else routing

**Before** (if/else chain):
```typescript
export const handler = async (event) => {
  const path = event.path;
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, body: '', headers: getSecurityHeaders(event) };
  }

  if (path === '/admin/users' && method === 'GET') {
    return await handleGetUsers(event);
  }

  const userIdMatch = path.match(/^\/admin\/users\/([a-f0-9-]+)$/);
  if (userIdMatch && method === 'GET') {
    return await handleGetUserById(event, userIdMatch[1]);
  }

  return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }), headers: getSecurityHeaders(event) };
};
```

**After** (route map):
```typescript
import { createRouter } from '../../shared/utils/lambda-router';

export const handler = createRouter({
  'GET /admin/users': handleGetUsers,
  'GET /admin/users/:id': handleGetUserById,
}, { serviceName: 'admin-service' });
```

### Handler signature

All route handlers receive three arguments:

```typescript
type RouteHandler = (
  event: APIGatewayProxyEvent,  // Original API Gateway event
  params: RouteParams,           // Extracted path parameters { id: '...' }
  auth: AuthContext,             // { userId, email, roles } from Cognito
) => Promise<APIGatewayProxyResult>;
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | required | Used in log entries (`action: 'admin-service.request'`) |
| `skipAuth` | `boolean` | `false` | Skip JWT auth extraction (for public/webhook endpoints) |
