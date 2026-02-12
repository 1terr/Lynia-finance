# 01 - Migration Overview

## Current Architecture

```
┌─────────────────┐     ┌──────────────────────────┐
│  Next.js Apps   │────▶│  Supabase (Free Tier)    │
│  (Admin Portal, │     │  ┌──────────────────────┐ │
│   Distributor)  │     │  │ PostgreSQL (500 MB)  │ │
│                 │     │  │ Auth (JWT, sessions) │ │
│                 │     │  │ Realtime (WebSocket) │ │
│                 │     │  │ Storage (1 GB)       │ │
│                 │     │  │ RLS (30+ policies)   │ │
│                 │     │  └──────────────────────┘ │
└────────┬────────┘     └──────────────────────────┘
         │                          ▲
         │                          │
         ▼                          │
┌─────────────────┐                 │
│  API Gateway    │                 │
│  ┌───────────┐  │                 │
│  │ 6 Lambda  │──┼─────────────────┘
│  │ Functions │  │  (service_role_key)
│  └───────────┘  │
│  SQS, SNS, WAF  │
│  Secrets Manager │
│  CloudWatch, S3  │
└─────────────────┘
```

## Target Architecture

```
┌─────────────────┐     ┌──────────────────────────────────┐
│  Next.js Apps   │────▶│  Amazon Cognito (Auth)            │
│  (Admin Portal, │     │  ┌──────────────────────────────┐ │
│   Distributor)  │     │  │ User Pools (JWT, MFA)        │ │
│                 │     │  │ Identity Pools (IAM roles)   │ │
└────────┬────────┘     │  └──────────────────────────────┘ │
         │              └──────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  API Gateway (REST + WebSocket)             │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │ 6 Lambda      │  │ WebSocket API      │  │
│  │ Functions      │  │ (replaces Realtime)│  │
│  └───────┬───────┘  └────────────────────┘  │
│          │                                   │
│  ┌───────▼────────────────────────────────┐  │
│  │ RDS PostgreSQL / Aurora Serverless v2  │  │
│  │ (same schema, same migrations)         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  S3 (Storage), SQS, SNS, WAF,               │
│  Secrets Manager, CloudWatch                 │
└─────────────────────────────────────────────┘
```

## What Changes, What Stays

### Stays the Same

- **PostgreSQL schema** -- identical tables, columns, indexes, constraints
- **17 migration files** -- run against RDS instead of Supabase
- **Lambda functions** -- same code, different DB client
- **API Gateway, SQS, SNS, WAF, CloudWatch** -- untouched
- **Frontend components** -- same React/Next.js code
- **Business logic** -- scoring, payments, KYC, locks, notifications

### Changes

| Component | From | To |
|-----------|------|----|
| Database host | `ghdrnxlsupbzoddtyxcp.supabase.co` | RDS endpoint (private VPC) |
| DB client library | `@supabase/supabase-js` | `pg` (node-postgres) or Prisma |
| Auth provider | Supabase Auth | Amazon Cognito |
| Auth client | `@supabase/ssr`, `supabase.auth.*` | `amazon-cognito-identity-js` or Amplify Auth |
| Session management | Supabase cookie-based | Cognito tokens + custom middleware |
| RLS enforcement | PostgreSQL policies | Application middleware + Cognito groups |
| Realtime | Supabase channels | API Gateway WebSocket API |
| File storage | Supabase Storage | S3 + presigned URLs |
| Connection pooling | Supabase PgBouncer | RDS Proxy |

## Migration Strategy: Incremental (Not Big-Bang)

We migrate in 5 phases, each independently deployable and reversible:

```
Phase 1: Database ──▶ Phase 2: Auth ──▶ Phase 3: Realtime ──▶ Phase 4: Storage ──▶ Phase 5: Cleanup
  (RDS/Aurora)       (Cognito)          (WebSocket)           (S3)                 (Remove Supabase)
```

### Phase 1 -- Database Migration (Highest Priority)

- Provision RDS PostgreSQL or Aurora Serverless v2
- Run existing migrations against new database
- Set up RDS Proxy for connection pooling
- Replace `@supabase/supabase-js` DB calls with `pg` client in Lambda services
- Dual-write period: write to both Supabase and RDS, read from Supabase
- Switch reads to RDS after validation
- Cut over frontends to read from API (not direct DB)

### Phase 2 -- Authentication Migration

- Set up Cognito User Pool with matching attributes
- Migrate existing users (batch import or lazy migration)
- Replace Supabase auth calls in frontend with Cognito
- Update API Gateway authorizers to validate Cognito JWTs
- Replace RLS with application-layer authorization middleware

### Phase 3 -- Realtime Migration

- Set up API Gateway WebSocket API
- Replace Supabase channel subscriptions with WebSocket connections
- Use DynamoDB for connection state management
- Lambda triggers push updates through WebSocket

### Phase 4 -- Storage Migration

- S3 buckets already exist for frontend hosting
- Add buckets for KYC documents, commission PDFs
- Implement presigned URL generation in Lambda
- Migrate any existing files from Supabase Storage

### Phase 5 -- Cleanup

- Remove all `@supabase/*` dependencies
- Delete Supabase client code
- Archive Supabase project
- Update documentation and environment variables

## Decision: RDS PostgreSQL vs Aurora Serverless v2

| Factor | RDS PostgreSQL | Aurora Serverless v2 |
|--------|---------------|---------------------|
| Cost (low traffic) | ~$13/mo (db.t4g.micro) | ~$0.12/ACU-hour (min 0.5 ACU = ~$43/mo) |
| Cost (moderate traffic) | ~$25/mo (db.t4g.small) | Scales automatically |
| Scale-to-zero | No | Yes (min 0.5 ACU) |
| Connection pooling | RDS Proxy ($18/mo) or app-level | RDS Proxy ($18/mo) or app-level |
| Maintenance | Manual patches | Automatic |
| Multi-AZ | Extra cost | Built-in |
| Free tier eligible | Yes (750 hrs/mo for 12 months) | No |

**Recommendation: Start with RDS PostgreSQL `db.t4g.micro`** ($13/month in
`eu-west-2`). This gives you 1 vCPU, 1 GB RAM, 20 GB storage -- more than
enough for current workload. Upgrade to Aurora Serverless v2 when traffic
justifies the minimum $43/month baseline.

If you're within your first 12 months of AWS, `db.t4g.micro` is **free tier
eligible** (750 hours/month).

## Decision: Direct SQL vs ORM

| Approach | Pros | Cons |
|----------|------|------|
| `pg` (node-postgres) | Minimal change from Supabase `.from().select()` queries, no new abstraction | Manual query building |
| Prisma | Type-safe queries, auto-generated types, migrations tooling | New dependency, learning curve, cold start overhead |
| Drizzle ORM | Lightweight, TypeScript-first, SQL-like syntax | Newer, smaller community |
| Knex.js | Query builder (not full ORM), familiar SQL patterns | No auto types |

**Recommendation: `pg` (node-postgres) with a thin wrapper.** The existing
Supabase queries are simple CRUD. Translating `.from('table').select().eq()`
to parameterized SQL is straightforward and avoids adding ORM overhead to
Lambda cold starts. Extract a shared `database.ts` client that mirrors the
Supabase interface for minimal code changes.
