# AWS Lambda Deployment Guide

Complete guide for deploying Lynia Finance backend services to AWS Lambda using AWS SAM.

**Version**: 2.0
**Last Updated**: December 9, 2025
**Status**: ✅ Ready for Deployment

---

## Quick Start

```bash
# 1. Build Lambda functions
sam build

# 2. Deploy to staging
./scripts/deploy-staging.sh

# 3. Test endpoints
curl https://your-api-url.amazonaws.com/health
```

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [AWS Account Setup](#2-aws-account-setup)
3. [Local Development & Testing](#3-local-development--testing)
4. [Staging Deployment](#4-staging-deployment)
5. [Production Deployment](#5-production-deployment)
6. [CI/CD Automation](#6-cicd-automation)
7. [Monitoring & Logging](#7-monitoring--logging)
8. [Rollback & Recovery](#8-rollback--recovery)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

### Required Tools

| Tool | Version | Installation |
|------|---------|--------------|
| AWS CLI | v2.x | `pip install awscli` or [download](https://aws.amazon.com/cli/) |
| AWS SAM CLI | v1.100+ | `pip install aws-sam-cli` |
| Node.js | v20.x | [Download](https://nodejs.org/) |
| Docker | Latest | [Download](https://docker.com/) |
| Git | Latest | [Download](https://git-scm.com/) |

### Verify Installation

```bash
aws --version         # aws-cli/2.x
sam --version         # SAM CLI, version 1.100+
node --version        # v20.x
docker --version      # Docker version 24.x
git --version         # git version 2.x
```

### AWS IAM Permissions Required

Your AWS IAM user needs these policies:
- `AWSLambdaFullAccess`
- `AmazonAPIGatewayAdministrator`
- `CloudFormationFullAccess`
- `IAMFullAccess`
- `AmazonS3FullAccess`
- `CloudWatchLogsFullAccess`

---

## 2. AWS Account Setup

### Step 1: Configure AWS Credentials

```bash
aws configure
```

Provide:
- **AWS Access Key ID**: Your IAM user access key
- **AWS Secret Access Key**: Your IAM user secret key
- **Default region**: `us-east-1` (recommended)
- **Output format**: `json`

### Step 2: Verify AWS Configuration

```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### Step 3: Create S3 Bucket for SAM Artifacts

```bash
aws s3 mb s3://lynia-finance-sam-deployments --region us-east-1
```

---

## 3. Local Development & Testing

### Build Lambda Functions

```bash
# Build all functions
sam build --cached --parallel

# Build specific function
sam build ScoringFunction
```

### Start Local API Gateway

```bash
sam local start-api --port 3000 --env-vars env.json
```

API will be available at `http://localhost:3000`

### Test Local Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Test scoring service
curl -X POST http://localhost:3000/scoring/calculate \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "cust_test_001"}'

# Test WhatsApp webhook
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "+263771234567",
            "text": {"body": "Hi"}
          }]
        }
      }]
    }]
  }'
```

### Invoke Functions with Test Events

```bash
# Invoke scoring function
sam local invoke ScoringFunction --event events/test-scoring.json

# Invoke with inline JSON
sam local invoke PaymentFunction --event - <<EOF
{
  "httpMethod": "POST",
  "path": "/payments/initiate",
  "body": "{\"loan_id\":\"loan_001\",\"amount\":70}"
}
EOF
```

### View Local Logs

```bash
# Logs appear in terminal where you ran sam local start-api
# Use LOG_LEVEL=debug in env.json for detailed logs
```

---

## 4. Staging Deployment

### Step 1: Configure Staging Parameters

Edit `config/parameters-staging.json`:

```json
{
  "Parameters": {
    "Environment": "staging",
    "SupabaseUrl": "https://your-project.supabase.co",
    "SupabaseServiceRoleKey": "your-staging-supabase-key",
    "WhatsAppPhoneNumberId": "your-staging-phone-id",
    "WhatsAppAccessToken": "your-staging-whatsapp-token",
    "WhatsAppWebhookVerifyToken": "your-staging-verify-token",
    "DiditApiKey": "your-didit-partner-id",
    "DiditWebhookSecret": "your-didit-api-key",
    "DiditEnvironment": "sandbox",
    "EcocashMerchantId": "your-ecocash-merchant-id",
    "EcocashApiKey": "your-ecocash-api-key",
    "OnemoneyMerchantId": "your-onemoney-merchant-id",
    "OnemoneyApiKey": "your-onemoney-api-key",
    "TrustonicApiKey": "your-trustonic-api-key",
    "TrustonicApiSecret": "your-trustonic-secret",
    "SmsProvider": "twilio",
    "SmsApiKey": "your-sms-api-key"
  }
}
```

### Step 2: Deploy Using Script (Recommended)

```bash
chmod +x scripts/deploy-staging.sh
./scripts/deploy-staging.sh
```

The script will:
1. ✅ Verify AWS CLI configured
2. ✅ Build Lambda functions
3. ✅ Validate SAM template
4. ✅ Deploy to AWS
5. ✅ Show API Gateway URL

### Step 3: Manual Deployment (Alternative)

```bash
# Build
sam build --config-env staging

# Deploy
sam deploy \
  --config-env staging \
  --no-confirm-changeset \
  --parameter-overrides "$(cat config/parameters-staging.json | jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")')"
```

### Step 4: Get Staging API URL

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-finance-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text
```

### Step 5: Test Staging Endpoints

```bash
export STAGING_URL="https://xxx.execute-api.us-east-1.amazonaws.com/Prod/"

# Health check
curl ${STAGING_URL}/health

# Test scoring
curl -X POST ${STAGING_URL}/scoring/calculate \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "cust_test_001"}'

# Test payment initiation
curl -X POST ${STAGING_URL}/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{"loan_id":"loan_001","amount":70,"payment_type":"deposit"}'
```

---

## 5. Production Deployment

### ⚠️ Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests passing in staging
- [ ] Staging environment thoroughly tested
- [ ] All API endpoints verified working
- [ ] Database migrations applied to production database
- [ ] Production environment variables configured
- [ ] CloudWatch alarms set up
- [ ] Monitoring dashboards created
- [ ] Rollback plan documented
- [ ] Team notified of deployment window
- [ ] Customer support team briefed

### Step 1: Configure Production Parameters

Edit `config/parameters-production.json`:

```json
{
  "Parameters": {
    "Environment": "production",
    "SupabaseUrl": "https://your-project.supabase.co",
    "SupabaseServiceRoleKey": "your-PRODUCTION-supabase-key",
    "DiditEnvironment": "production",
    ...
  }
}
```

⚠️ **Important**: Use production credentials, not sandbox!

### Step 2: Deploy to Production

```bash
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

You will be prompted to:
1. Type `PRODUCTION` to confirm
2. Confirm staging testing complete
3. Confirm rollback plan ready

The script includes safety checks and manual changeset review.

### Step 3: Verify Production Deployment

```bash
export PROD_URL="https://xxx.execute-api.us-east-1.amazonaws.com/Prod/"

# Health check
curl ${PROD_URL}/health

# Check all endpoints respond
curl -I ${PROD_URL}/scoring/calculate
curl -I ${PROD_URL}/payments/initiate
curl -I ${PROD_URL}/kyc/initiate
curl -I ${PROD_URL}/whatsapp/webhook
curl -I ${PROD_URL}/locks/lock
curl -I ${PROD_URL}/notifications/send
```

### Step 4: Monitor Production

```bash
# Real-time logs for all functions
sam logs --config-env production --tail

# Monitor specific function
aws logs tail /aws/lambda/production-lynia-scoring-service --follow

# Check for errors
aws logs filter-pattern /aws/lambda/production-lynia-scoring-service --filter-pattern "ERROR" --since 1h
```

### Step 5: Post-Deployment Verification

1. **Check CloudWatch Metrics**
   - Lambda invocations
   - API Gateway requests
   - Error rates

2. **Run Smoke Tests**
   - Complete onboarding flow
   - Payment processing
   - KYC verification
   - Device lock/unlock

3. **Notify Team**
   - Send deployment notification
   - Share production URL
   - Confirm monitoring active

---

## 6. CI/CD Automation

### GitHub Actions Workflow

The project includes automated CI/CD via GitHub Actions:

**Workflow**: `.github/workflows/deploy.yml`

#### Automatic Staging Deployment

Triggers automatically on push to `master` branch:

```bash
git add .
git commit -m "Update Lambda functions"
git push origin master
```

GitHub Actions will:
1. Run tests
2. Build Lambda functions
3. Deploy to staging environment
4. Test deployed endpoints
5. Comment on PR with deployment URL

#### Manual Production Deployment

1. Navigate to GitHub repository
2. Click "Actions" tab
3. Select "Deploy to AWS" workflow
4. Click "Run workflow"
5. Select environment: `production`
6. Click "Run workflow" button
7. Approve deployment in GitHub UI

### Required GitHub Secrets

Configure in: **Settings → Secrets and variables → Actions**

**AWS Credentials**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Staging Secrets** (with `STAGING_` prefix):
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_KEY`
- `STAGING_WHATSAPP_PHONE_ID`
- `STAGING_WHATSAPP_TOKEN`
- `STAGING_WEBHOOK_TOKEN`
- `STAGING_DIDIT_API_KEY`
- `STAGING_DIDIT_WEBHOOK_SECRET`
- `STAGING_ECOCASH_MERCHANT_ID`
- `STAGING_ECOCASH_API_KEY`
- `STAGING_ONEMONEY_MERCHANT_ID`
- `STAGING_ONEMONEY_API_KEY`
- `STAGING_TRUSTONIC_API_KEY`
- `STAGING_TRUSTONIC_API_SECRET`
- `STAGING_SMS_API_KEY`

**Production Secrets** (with `PRODUCTION_` prefix):
- `PRODUCTION_SUPABASE_URL`
- `PRODUCTION_SUPABASE_KEY`
- ... (all secrets with PRODUCTION prefix)

---

## 7. Monitoring & Logging

### CloudWatch Logs

#### View Real-Time Logs

```bash
# All functions in staging
sam logs --config-env staging --tail

# Specific function
sam logs --config-env staging --tail --name ScoringFunction

# Filter for errors
aws logs tail /aws/lambda/staging-lynia-scoring-service \
  --filter-pattern "ERROR" \
  --since 1h \
  --follow
```

#### Search Logs with Insights

```bash
# Go to CloudWatch → Logs Insights
# Run query:

fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

### CloudWatch Metrics

Key metrics to monitor:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Invocations | Number of function calls | N/A |
| Duration | Execution time | > 25s (timeout warning) |
| Errors | Failed invocations | > 10 errors/5min |
| Throttles | Rate limit hits | > 0 |
| ConcurrentExecutions | Simultaneous invocations | > 900 (soft limit) |

### Create CloudWatch Alarms

```bash
# Alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name lynia-production-scoring-errors \
  --alarm-description "Alert when Scoring function has errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=production-lynia-scoring-service \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:DevOps-Alerts

# Alarm for API Gateway 5xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name lynia-production-api-5xx-errors \
  --alarm-description "Alert on API Gateway server errors" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

### CloudWatch Dashboard

Create custom dashboard:

1. Go to CloudWatch console
2. Click "Dashboards" → "Create dashboard"
3. Name: `lynia-finance-production`
4. Add widgets:
   - **Lambda Invocations** (line graph, all 6 functions)
   - **Lambda Errors** (number, sum across all functions)
   - **Lambda Duration** (line graph, P50/P90/P99)
   - **API Gateway Requests** (line graph)
   - **API Gateway Latency** (line graph)
   - **API Gateway 4xx/5xx Errors** (stacked area)

---

## 8. Rollback & Recovery

### Option 1: Automated Rollback Script

```bash
# Rollback staging
./scripts/rollback.sh staging

# Rollback production (requires confirmation)
./scripts/rollback.sh production
```

### Option 2: CloudFormation Rollback

1. Go to AWS CloudFormation console
2. Select stack: `lynia-finance-staging` or `lynia-finance-prod`
3. Click "Stack actions" → "Detect drift" (verify current state)
4. Click "Stack actions" → "Rollback"
5. Confirm rollback

### Option 3: Deploy Previous Version

```bash
# Find previous working commit
git log --oneline -10

# Checkout previous commit
git checkout <commit-hash>

# Deploy
sam build
./scripts/deploy-staging.sh  # or deploy-production.sh
```

### Emergency: Complete Stack Deletion

⚠️ **DANGER**: This deletes ALL resources (Lambda, API Gateway, etc.)

```bash
# Staging
aws cloudformation delete-stack --stack-name lynia-finance-staging

# Production (EXTREME CAUTION)
aws cloudformation delete-stack --stack-name lynia-finance-prod
```

---

## 9. Troubleshooting

### Issue: SAM Build Fails

**Error**: `Build Failed - esbuild not found`

**Solution**:
```bash
# Install esbuild globally
npm install -g esbuild

# Or rebuild with Docker (slower but works)
sam build --use-container
```

### Issue: Deployment Fails - Permissions

**Error**: `User is not authorized to perform: lambda:CreateFunction`

**Solution**:
1. Add `AWSLambdaFullAccess` policy to IAM user
2. Verify AWS credentials: `aws sts get-caller-identity`
3. Check IAM policies in AWS console

### Issue: Function Timeout

**Error**: `Task timed out after 30.00 seconds`

**Solutions**:
1. **Increase timeout** in `template.yaml`:
   ```yaml
   Globals:
     Function:
       Timeout: 60  # Increase from 30s
   ```
2. **Optimize function code** - reduce database queries
3. **Increase memory** (more CPU allocated):
   ```yaml
   MemorySize: 1024  # Increase from 512MB
   ```

### Issue: Cold Start Performance

**Problem**: First request takes 3-5 seconds

**Solutions**:
1. **Use Provisioned Concurrency** (costs $$):
   ```yaml
   ProvisionedConcurrencyConfig:
     ProvisionedConcurrentExecutions: 1
   ```
2. **Increase memory** (faster initialization):
   ```yaml
   MemorySize: 1024
   ```
3. **Minimize dependencies** - reduce package size
4. **Use Lambda Layer** for shared code

### Issue: API Gateway 502 Error

**Error**: `{"message":"Internal server error"}`

**Solutions**:
1. **Check CloudWatch logs** for function errors
2. **Verify response format**:
   ```javascript
   return {
     statusCode: 200,
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ data: result })
   };
   ```
3. **Test function locally**: `sam local invoke`

### Issue: Environment Variables Not Set

**Error**: `process.env.SUPABASE_URL is undefined`

**Solutions**:
1. Verify `config/parameters-staging.json` has correct values
2. Check CloudFormation stack parameters in AWS console
3. Redeploy with correct parameters:
   ```bash
   sam deploy --parameter-overrides SupabaseUrl=https://your-project.supabase.co
   ```

### Issue: CORS Errors

**Error**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solution**: Add CORS headers to Lambda response:
```javascript
return {
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  },
  body: JSON.stringify(data)
};
```

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         GitHub                                │
│   ┌──────────────┐                                           │
│   │ Push/PR      │──────► GitHub Actions                     │
│   └──────────────┘            │                              │
│                               ▼                              │
│                        ┌──────────────┐                      │
│                        │  Run Tests   │                      │
│                        └──────┬───────┘                      │
│                               ▼                              │
│                        ┌──────────────┐                      │
│                        │  SAM Build   │                      │
│                        └──────┬───────┘                      │
│                               ▼                              │
│                        ┌──────────────┐                      │
│                        │ SAM Deploy   │                      │
│                        └──────┬───────┘                      │
└───────────────────────────────┼──────────────────────────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │ AWS CloudFormation   │
                     └──────────┬───────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
   ┌────────────┐        ┌────────────┐      ┌────────────┐
   │ 6 Lambda   │◄───────┤ API        │      │ CloudWatch │
   │ Functions  │        │ Gateway    │      │ Logs       │
   └─────┬──────┘        └────────────┘      └────────────┘
         │
         ├──► ScoringFunction (512MB, 30s)
         ├──► WhatsAppFunction (512MB, 30s)
         ├──► KYCFunction (512MB, 30s)
         ├──► PaymentFunction (512MB, 30s)
         ├──► LockFunction (512MB, 30s)
         └──► NotificationFunction (512MB, 30s)
                  │
                  ▼
          ┌──────────────┐       ┌──────────────────┐
          │  Supabase    │       │  External APIs   │
          │  PostgreSQL  │       │ • WhatsApp       │
          │              │       │ • DIDIT       │
          └──────────────┘       │ • OneMoney       │
                                 │ • Trustonic      │
                                 └──────────────────┘
```

---

## Cost Estimation

### Staging Environment (Low Traffic - 100K requests/month)

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 100K requests, 512MB, 1s avg | $0.02 |
| API Gateway | 100K requests | $0.35 |
| CloudWatch Logs | 1GB | $0.50 |
| Data Transfer | 5GB | $0.45 |
| **Total** | | **~$1.32/month** |

### Production Environment (High Traffic - 10M requests/month)

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 10M requests, 512MB, 1s avg | $2.00 |
| API Gateway | 10M requests | $35.00 |
| CloudWatch Logs | 50GB | $25.00 |
| Data Transfer | 100GB | $9.00 |
| **Total** | | **~$71.00/month** |

**Note**: Free tier covers first 1M Lambda requests and 1GB of logs per month.

---

## Additional Resources

- **AWS SAM Documentation**: https://docs.aws.amazon.com/serverless-application-model/
- **Lambda Best Practices**: https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
- **API Gateway Docs**: https://docs.aws.amazon.com/apigateway/
- **CloudWatch Logs Insights**: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html
- **Lambda Powertools**: https://awslabs.github.io/aws-lambda-powertools-typescript/

---

## Support & Contact

- **Documentation**: This file + `P2-T013-PROGRESS.md`
- **Issues**: GitHub Issues tracker
- **Slack**: #lynia-devops channel
- **Email**: devops@lyniafinance.com

---

**Last Updated**: December 9, 2025
**Version**: 2.0.0
**Maintained By**: Lynia Finance DevOps Team
