# Admin Service

Powers the admin portal with user management, system configuration, audit logging, product/device-model CRUD, organization management, inventory operations (devices, adjustments, transfers, reports), dashboard metrics, and KYC review workflows.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/me | Get current authenticated admin user |
| GET | /admin/users | List all admin users |
| POST | /admin/users | Create a new admin user |
| GET | /admin/users/:id | Get admin user by ID |
| PATCH | /admin/users/:id | Update admin user |
| GET | /admin/config | Get system configuration |
| PATCH | /admin/config/:id | Update a configuration value |
| GET | /admin/audit-logs | Get audit log entries |
| GET | /admin/products | List loan products |
| POST | /admin/products | Create a loan product |
| GET | /admin/products/:id | Get loan product by ID |
| PATCH | /admin/products/:id | Update a loan product |
| DELETE | /admin/products/:id | Delete a loan product |
| GET | /admin/products/:id/device-models | List device models linked to a product |
| POST | /admin/products/:id/device-models | Link a device model to a product |
| DELETE | /admin/products/:id/device-models/:modelId | Unlink a device model from a product |
| GET | /admin/device-models | List device models |
| POST | /admin/device-models | Create a device model |
| GET | /admin/device-models/:id | Get device model by ID |
| PATCH | /admin/device-models/:id | Update a device model |
| DELETE | /admin/device-models/:id | Delete a device model |
| GET | /admin/organizations | List organizations |
| POST | /admin/organizations | Create an organization |
| GET | /admin/organizations/:id | Get organization by ID |
| PATCH | /admin/organizations/:id | Update an organization |
| POST | /admin/organizations/:id/import | Import organization members |
| GET | /admin/organizations/:id/members | List organization members |
| GET | /admin/devices | List device inventory |
| POST | /admin/devices | Register a device |
| POST | /admin/devices/bulk-import | Bulk import devices |
| GET | /admin/devices/stats | Get device inventory statistics |
| GET | /admin/devices/:id | Get device by ID |
| PATCH | /admin/devices/:id | Update a device |
| GET | /admin/devices/:id/movements | Get device movement history |
| GET | /admin/inventory/adjustments | List inventory adjustments |
| POST | /admin/inventory/adjustments | Create an inventory adjustment |
| POST | /admin/inventory/adjustments/:id/approve | Approve an adjustment |
| GET | /admin/inventory/transfers | List inventory transfers |
| POST | /admin/inventory/transfers | Create an inventory transfer |
| PATCH | /admin/inventory/transfers/:id | Update transfer status |
| GET | /admin/reports/inventory | Inventory summary report |
| GET | /admin/reports/inventory/movements | Inventory movements report |
| GET | /admin/reports/inventory/low-stock | Low stock alert report |
| GET | /api/v1/dashboard/metrics | Dashboard summary metrics |
| GET | /api/v1/dashboard/portfolio-at-risk | Portfolio at risk breakdown |
| GET | /api/v1/dashboard/daily-trends | Daily trends data |
| GET | /api/v1/dashboard/loans-by-status | Loan count grouped by status |
| GET | /api/v1/dashboard/recent-activity | Recent activity feed |
| GET | /api/v1/kyc/submissions/pending | List pending KYC submissions |
| GET | /api/v1/kyc/submissions/review-history | KYC review history |
| GET | /api/v1/kyc/submissions/sla-stats | KYC SLA performance stats |
| POST | /api/v1/kyc/submissions/:id/approve | Approve a KYC submission |
| POST | /api/v1/kyc/submissions/:id/reject | Reject a KYC submission |

## Architecture

- **Runtime**: AWS Lambda (Node.js 18, arm64)
- **Trigger**: API Gateway
- **Router**: lambda-router (route map)
- **Auth**: Cognito JWT (enforced by lambda-router)

## Dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL (RDS) | All admin data -- users, products, devices, inventory, KYC reviews |
| Amazon Cognito | Admin user authentication |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| COGNITO_USER_POOL_ID | Cognito user pool for admin auth | Yes |

## Testing

```bash
# Unit tests
npx jest tests/unit/admin/ --no-coverage

# E2E tests
npx jest tests/e2e/e2e-004-admin-loan-approval.test.ts --no-coverage
```
