# AWS Infrastructure Setup Guide

**Duration**: 30-45 minutes
**Replaces**: `SUPABASE-SETUP-GUIDE.md` (archived)

This guide sets up the core AWS services for Lynia Finance:
- **RDS PostgreSQL 16** - Database
- **Cognito User Pools** - Authentication
- **S3** - File storage (KYC documents, commission PDFs, etc.)
- **Secrets Manager** - Credential management

---

## Prerequisites

- AWS CLI v2 installed and configured (`aws configure`)
- AWS SAM CLI installed (`sam --version`)
- An AWS account with permissions to create: RDS, Cognito, S3, Secrets Manager, VPC resources
- A VPC with at least 2 private subnets (for RDS)

---

## Step 1: Deploy RDS PostgreSQL Database (10 minutes)

### 1.1 Deploy the CloudFormation Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/rds.yaml \
  --stack-name lynia-rds-dev \
  --parameter-overrides \
    Environment=development \
    VpcId=vpc-xxxxxxxxx \
    PrivateSubnet1Id=subnet-xxxxxxxxx \
    PrivateSubnet2Id=subnet-xxxxxxxxx \
    LambdaSecurityGroupId=sg-xxxxxxxxx \
    MasterUsername=lynia_admin \
    MasterUserPassword='YOUR_STRONG_PASSWORD_HERE' \
  --capabilities CAPABILITY_IAM
```

Replace the VPC/subnet/SG IDs with your actual values.

### 1.2 Verify RDS Instance

```bash
aws rds describe-db-instances \
  --db-instance-identifier lynia-development \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}'
```

Wait until Status is `available`.

### 1.3 Instance Sizes by Environment

| Environment | Instance | Storage |
|-------------|----------|---------|
| development | db.t4g.micro | 20 GB |
| staging | db.t4g.micro | 20 GB |
| production | db.t4g.small | 50 GB (auto-scales to 100 GB) |

---

## Step 2: Deploy Database Schema (5 minutes)

### 2.1 Get the RDS Endpoint

```bash
RDS_HOST=$(aws cloudformation describe-stacks \
  --stack-name lynia-rds-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`RDSEndpoint`].OutputValue' \
  --output text)
echo "RDS Host: $RDS_HOST"
```

### 2.2 Run Database Migrations

```bash
export RDS_CONNECTION_STRING="postgresql://lynia_admin:YOUR_PASSWORD@${RDS_HOST}:5432/lynia"

# Deploy all migrations (001-017) plus AWS-specific setup
bash database/deploy-to-rds.sh "$RDS_CONNECTION_STRING"
```

This script runs:
1. `000_pre_migration.sql` - Creates compatibility stubs
2. Migrations `001` through `017` - Core schema (19 tables)
3. `018_remove_rls_for_aws.sql` - Removes Supabase-specific RLS policies

### 2.3 Verify Schema

```bash
psql "$RDS_CONNECTION_STRING" -c "\dt public.*"
```

You should see 19 tables including: `customers`, `loans`, `transactions`, `devices`, etc.

---

## Step 3: Deploy Cognito User Pool (5 minutes)

### 3.1 Deploy the CloudFormation Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/cognito.yaml \
  --stack-name lynia-cognito-dev \
  --parameter-overrides \
    Environment=development \
  --capabilities CAPABILITY_IAM
```

### 3.2 Get Cognito Outputs

```bash
# User Pool ID
aws cloudformation describe-stacks \
  --stack-name lynia-cognito-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text

# Admin Portal Client ID
aws cloudformation describe-stacks \
  --stack-name lynia-cognito-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`AdminPortalClientId`].OutputValue' \
  --output text

# Distributor Dashboard Client ID
aws cloudformation describe-stacks \
  --stack-name lynia-cognito-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributorDashboardClientId`].OutputValue' \
  --output text

# User Pool ARN (needed for template.yaml)
aws cloudformation describe-stacks \
  --stack-name lynia-cognito-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolArn`].OutputValue' \
  --output text
```

### 3.3 User Groups

The Cognito stack creates 5 groups automatically:

| Group | Purpose |
|-------|---------|
| `admin` | Full system access |
| `manager` | Loan approvals, reports |
| `support` | Customer support operations |
| `reports_viewer` | Read-only reporting access |
| `distributor` | Distributor portal access |

### 3.4 Create Initial Admin User

```bash
USER_POOL_ID="us-east-1_xxxxxxxxx"  # from step 3.2

aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username admin@lyniafinance.com \
  --user-attributes \
    Name=email,Value=admin@lyniafinance.com \
    Name=email_verified,Value=true \
  --temporary-password 'TempPass123!'

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username admin@lyniafinance.com \
  --group-name admin
```

---

## Step 4: Deploy S3 Storage Buckets (3 minutes)

### 4.1 Deploy the CloudFormation Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/storage-buckets.yaml \
  --stack-name lynia-storage-dev \
  --parameter-overrides \
    Environment=development \
  --capabilities CAPABILITY_IAM
```

### 4.2 Buckets Created

| Bucket | Purpose | Encryption |
|--------|---------|------------|
| `{env}-lynia-kyc-documents` | KYC ID photos, selfies | KMS |
| `{env}-lynia-commission-pdfs` | Commission statements | AES-256 |
| `{env}-lynia-reconciliation-photos` | Payment proof photos | AES-256 |
| `{env}-lynia-ml-models` | Credit scoring ML models | AES-256 |

All buckets are private with versioning enabled and RBZ-compliant retention policies.

---

## Step 5: Store Database Credentials in Secrets Manager (2 minutes)

### 5.1 Deploy the Secrets Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/secrets-manager.yaml \
  --stack-name lynia-secrets-dev \
  --parameter-overrides \
    Environment=development
```

### 5.2 Update the Secret Value

```bash
aws secretsmanager put-secret-value \
  --secret-id development/lynia/database \
  --secret-string '{
    "host": "YOUR_RDS_ENDPOINT",
    "port": 5432,
    "database": "lynia",
    "username": "lynia_admin",
    "password": "YOUR_RDS_PASSWORD"
  }'
```

Lambda functions read this secret automatically via the `DB_SECRET_NAME` environment variable.

---

## Step 6: Deploy Lambda Functions (5 minutes)

### 6.1 Build and Deploy

```bash
# Build
sam build --cached --parallel

# Deploy to development
sam deploy \
  --config-env dev \
  --parameter-overrides \
    Environment=development \
    CognitoUserPoolArn=arn:aws:cognito-idp:us-east-1:ACCOUNT:userpool/POOL_ID \
    VpcEnabled=true \
    LambdaSecurityGroupId=sg-xxxxxxxxx \
    PrivateSubnet1Id=subnet-xxxxxxxxx \
    PrivateSubnet2Id=subnet-xxxxxxxxx
```

### 6.2 Verify Deployment

```bash
# Get API Gateway URL
aws cloudformation describe-stacks \
  --stack-name lynia-finance-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text

# Test health endpoint
curl https://YOUR_API_GATEWAY_URL/health
```

---

## Step 7: Configure Frontend Apps (3 minutes)

### 7.1 Admin Portal

Create `frontend/admin-portal/.env.local` from the example:

```bash
cp frontend/admin-portal/.env.local.example frontend/admin-portal/.env.local
```

Fill in the values from Step 3.2:

```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-admin-portal-client-id
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
```

### 7.2 Distributor Dashboard

```bash
cp frontend/distributor-dashboard/.env.local.example frontend/distributor-dashboard/.env.local
```

Fill in values (use the distributor client ID from Step 3.2).

### 7.3 Run Frontend

```bash
# Admin portal
cd frontend/admin-portal && pnpm dev

# Distributor dashboard (separate terminal)
cd frontend/distributor-dashboard && pnpm dev
```

---

## Environment Variable Reference

### Backend (Lambda / SAM template)

| Variable | Source | Description |
|----------|--------|-------------|
| `DB_SECRET_NAME` | template.yaml | Secrets Manager key for DB credentials |
| `SECRETS_PREFIX` | template.yaml | Prefix for all Lynia secrets |
| `NODE_ENV` | template.yaml | Environment name |
| `LOG_LEVEL` | template.yaml | Logging verbosity |

### Frontend (Next.js)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `NEXT_PUBLIC_COGNITO_REGION` | AWS region for Cognito |
| `NEXT_PUBLIC_API_URL` | API Gateway base URL |

---

## Architecture Overview

```
                    ┌─────────────────┐
                    │   CloudFront    │
                    │  (CDN + WAF)    │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────┴───────┐        ┌───────┴───────┐
        │  Admin Portal │        │  Distributor   │
        │   (S3 + CF)   │        │  Dashboard     │
        └───────┬───────┘        └───────┬───────┘
                │                         │
                └────────────┬────────────┘
                             │
                    ┌────────┴────────┐
                    │  API Gateway    │
                    │  + Cognito Auth │
                    └────────┬────────┘
                             │
        ┌──────────┬─────────┼─────────┬──────────┐
        │          │         │         │          │
    ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐
    │Scoring│ │WhatsAp│ │  KYC  │ │Payment│ │ Lock  │
    │Service│ │Service│ │Service│ │Service│ │Service│
    └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
        │         │         │         │         │
        └─────────┴─────────┼─────────┴─────────┘
                            │
                   ┌────────┴────────┐
                   │  RDS PostgreSQL │
                   │  (Private VPC)  │
                   └─────────────────┘
```

---

## Troubleshooting

### Lambda can't connect to RDS

- Verify Lambda is in the same VPC as RDS
- Check security group allows inbound on port 5432 from Lambda SG
- Verify `DB_SECRET_NAME` matches the Secrets Manager secret name
- Check the secret contains valid JSON with host/port/database/username/password

### Cognito authentication fails

- Verify `CognitoUserPoolArn` parameter is passed to SAM deploy
- Check the app client ID matches the correct application
- Ensure the user has been added to the appropriate Cognito group

### S3 upload/download fails

- Verify Lambda IAM role has permissions for the specific bucket
- Check bucket names match the expected `{env}-lynia-*` pattern
- For KYC documents, ensure KMS key permissions are correct

### Database migration errors

- Run migrations in order (000, 001-017, 018)
- Check PostgreSQL version is 16+
- Ensure `uuid-ossp` and `pg_trgm` extensions are available

---

## Quick Reference Commands

```bash
# Check all stack statuses
for stack in lynia-rds-dev lynia-cognito-dev lynia-storage-dev lynia-secrets-dev lynia-finance-dev; do
  STATUS=$(aws cloudformation describe-stacks --stack-name $stack \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")
  echo "$stack: $STATUS"
done

# View Lambda logs
sam logs --stack-name lynia-finance-dev --name ScoringFunction --tail

# Test API endpoint
curl -H "Authorization: Bearer YOUR_COGNITO_TOKEN" \
  https://YOUR_API_URL/scoring/health
```
