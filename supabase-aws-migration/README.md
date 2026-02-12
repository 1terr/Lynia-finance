# Supabase to AWS Migration Strategy

## Why We're Migrating

Supabase's free tier (500 MB database, 1 GB storage, 50k auth MAUs) no longer
meets Lynia Finance's growth requirements. Rather than upgrading to Supabase Pro
($25/month with limited control), we can consolidate onto AWS where we already
run 80% of our infrastructure (Lambda, API Gateway, SQS, CloudFront, WAF, etc.)
and gain full operational control, better cost predictability, and tighter
integration between services.

## Current Supabase Usage Summary

| Feature | Status | AWS Replacement |
|---------|--------|-----------------|
| **PostgreSQL Database** | Active (35+ tables, 17 migrations) | Amazon RDS PostgreSQL / Aurora Serverless v2 |
| **Authentication** | Active (JWT, email/password, sessions) | Amazon Cognito |
| **Row Level Security** | Active (30+ policies) | Application-layer middleware + Cognito groups |
| **Realtime Subscriptions** | Active (KYC queue, auth state) | API Gateway WebSocket + DynamoDB Streams |
| **Storage** | Planned (KYC docs, commission PDFs) | Amazon S3 (already partially used) |
| **Edge Functions** | Planned (not deployed) | AWS Lambda (already used) |
| **Client SDK** | Active (frontend + backend) | AWS SDK + custom API client |

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 01 | [Migration Overview](./01-migration-overview.md) | High-level strategy, principles, phased approach |
| 02 | [Database Migration](./02-database-migration.md) | PostgreSQL to RDS/Aurora, schema, migrations, connection pooling |
| 03 | [Authentication Migration](./03-authentication-migration.md) | Supabase Auth to Amazon Cognito |
| 04 | [RLS to Application Auth](./04-rls-to-application-auth.md) | Row Level Security to application-layer authorization |
| 05 | [Realtime Migration](./05-realtime-migration.md) | Realtime subscriptions to WebSocket API |
| 06 | [Storage Migration](./06-storage-migration.md) | Supabase Storage to S3 |
| 07 | [Frontend Changes](./07-frontend-changes.md) | Admin portal + distributor dashboard SDK swap |
| 08 | [Backend Changes](./08-backend-changes.md) | Lambda services client migration |
| 09 | [Cost Analysis](./09-cost-analysis.md) | Detailed cost comparison and optimization |
| 10 | [Migration Timeline](./10-migration-timeline.md) | Phased rollout plan with milestones |
| 11 | [Risk Mitigation](./11-risk-mitigation.md) | Risks, rollback strategy, testing |

## Key Principles

1. **Zero downtime** -- migrate incrementally, not big-bang
2. **Preserve existing schema** -- same PostgreSQL, same tables, same migrations
3. **Minimal frontend disruption** -- swap SDK clients behind existing interfaces
4. **Cost efficiency** -- use serverless/pay-per-use AWS services wherever possible
5. **Security first** -- no regression in auth, encryption, or access control
