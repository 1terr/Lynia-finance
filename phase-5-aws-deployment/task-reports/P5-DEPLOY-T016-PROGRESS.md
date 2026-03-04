# P5-DEPLOY-T016: Create Initial Cognito Users & Configure GitHub Secrets - Progress Report

**Task:** P5-DEPLOY-T016 - Create Initial Cognito Users & Configure GitHub Secrets
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.4 Frontend & Finalization
**Priority:** High
**Estimated Hours:** 2
**Dependencies:** P5-DEPLOY-T003 (Cognito), P5-DEPLOY-T010 (API Gateway URL)
**Status:** ✅ COMPLETED
**Completion Date:** 2026-02-13

---

## Task Description

Create initial admin and manager users in the Cognito User Pool, assign them to the correct groups, and configure all GitHub repository secrets required by the CI/CD deployment workflows (`deploy.yml` and `deploy-frontend.yml`).

## Deliverables

- [x] Admin user created and added to `admin` group
- [x] Manager user created and added to `manager` group
- [x] All GitHub Actions workflow secrets configured
- [x] CI/CD pipeline functional with new secrets

## Acceptance Criteria

- [x] 2 users in Cognito with `FORCE_CHANGE_PASSWORD` status
- [x] Admin user in `admin` group
- [x] Manager user in `manager` group
- [x] `gh secret list` shows all required secrets
- [x] Manual trigger of `deploy.yml` workflow succeeds (staging)

---

## Steps

### Step 1: Get Cognito User Pool ID

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
echo "USER_POOL_ID=$USER_POOL_ID"
```

### Step 2: Create Admin User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username "admin@lynia.co.zw" \
  --user-attributes \
    Name=email,Value="admin@lynia.co.zw" \
    Name=email_verified,Value=true \
    Name=custom:role,Value=admin \
    Name=custom:display_name,Value="System Administrator" \
  --temporary-password "TempP@ssw0rd123!" \
  --message-action SUPPRESS

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username "admin@lynia.co.zw" \
  --group-name admin
```

### Step 3: Create Manager User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username "manager@lynia.co.zw" \
  --user-attributes \
    Name=email,Value="manager@lynia.co.zw" \
    Name=email_verified,Value=true \
    Name=custom:role,Value=manager \
    Name=custom:display_name,Value="Operations Manager" \
  --temporary-password "TempP@ssw0rd456!" \
  --message-action SUPPRESS

# Add to manager group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username "manager@lynia.co.zw" \
  --group-name manager
```

### Step 4: Configure GitHub Secrets for Backend Deployment

```bash
# AWS credentials for CI/CD
gh secret set AWS_ACCESS_KEY_ID --body "<CI_USER_ACCESS_KEY>"
gh secret set AWS_SECRET_ACCESS_KEY --body "<CI_USER_SECRET_KEY>"
gh secret set AWS_REGION --body "us-east-1"

# Cognito ARN for SAM template
COGNITO_ARN=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolArn'].OutputValue" --output text)
gh secret set COGNITO_USER_POOL_ARN --body "$COGNITO_ARN"

# SAM artifact bucket
gh secret set SAM_BUCKET --body "lynia-finance-production-artifacts"

# Staging external service credentials (sandbox/test)
gh secret set STAGING_WHATSAPP_PHONE_ID --body "<staging_value>"
gh secret set STAGING_WHATSAPP_TOKEN --body "<staging_value>"
gh secret set STAGING_WEBHOOK_TOKEN --body "<staging_value>"
gh secret set STAGING_DIDIT_API_KEY --body "<staging_value>"
gh secret set STAGING_DIDIT_WEBHOOK_SECRET --body "<staging_value>"
gh secret set STAGING_ECOCASH_MERCHANT_ID --body "<staging_value>"
gh secret set STAGING_ECOCASH_API_KEY --body "<staging_value>"
gh secret set STAGING_ONEMONEY_MERCHANT_ID --body "<staging_value>"
gh secret set STAGING_ONEMONEY_API_KEY --body "<staging_value>"
gh secret set STAGING_TRUSTONIC_API_KEY --body "<staging_value>"
gh secret set STAGING_TRUSTONIC_API_SECRET --body "<staging_value>"
gh secret set STAGING_SMS_API_KEY --body "<staging_value>"
```

### Step 5: Configure GitHub Secrets for Frontend Deployment

```bash
ADMIN_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='AdminClientId'].OutputValue" --output text)
DIST_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorClientId'].OutputValue" --output text)

gh secret set NEXT_PUBLIC_COGNITO_USER_POOL_ID --body "$USER_POOL_ID"
gh secret set NEXT_PUBLIC_COGNITO_ADMIN_CLIENT_ID --body "$ADMIN_CLIENT_ID"
gh secret set NEXT_PUBLIC_COGNITO_DISTRIBUTOR_CLIENT_ID --body "$DIST_CLIENT_ID"

# Frontend hosting outputs (from T014)
ADMIN_BUCKET=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalBucketName'].OutputValue" --output text)
ADMIN_CF=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='AdminPortalDistributionId'].OutputValue" --output text)
DIST_BUCKET=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardBucketName'].OutputValue" --output text)
DIST_CF=$(aws cloudformation describe-stacks --stack-name production-lynia-frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorDashboardDistributionId'].OutputValue" --output text)

gh secret set ADMIN_PORTAL_BUCKET --body "$ADMIN_BUCKET"
gh secret set ADMIN_CF_DISTRIBUTION --body "$ADMIN_CF"
gh secret set DISTRIBUTOR_BUCKET --body "$DIST_BUCKET"
gh secret set DISTRIBUTOR_CF_DISTRIBUTION --body "$DIST_CF"
```

---

## Verification

```bash
# 1. List Cognito users
aws cognito-idp list-users --user-pool-id $USER_POOL_ID \
  --query "Users[].{Username:Username,Status:UserStatus,Created:UserCreateDate}" --output table
# Expected: 2 users, FORCE_CHANGE_PASSWORD status

# 2. Verify admin group membership
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id $USER_POOL_ID \
  --username "admin@lynia.co.zw" \
  --query "Groups[].GroupName"
# Expected: ["admin"]

# 3. Verify manager group membership
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id $USER_POOL_ID \
  --username "manager@lynia.co.zw" \
  --query "Groups[].GroupName"
# Expected: ["manager"]

# 4. Verify GitHub secrets are configured
gh secret list | grep -cE "AWS_|COGNITO|BUCKET|DISTRIBUTION|STAGING_"
# Expected: 20+ secrets

# 5. Test CI/CD (optional - trigger staging deployment)
gh workflow run deploy.yml --ref main
gh run list --limit 1
# Expected: workflow starts and passes
```

---

## Important Notes

- Users will need to change their temporary passwords on first login
- Communicate temporary passwords securely (never via email/Slack)
- Production external service credentials should be added separately by the operations team
- Staging secrets use sandbox/test values for safe CI/CD testing

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/cognito.yaml` | Cognito template (groups, schema reference) |
| `.github/workflows/deploy.yml` | Backend CI/CD workflow (references secrets) |
| `.github/workflows/deploy-frontend.yml` | Frontend CI/CD workflow (references secrets) |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |
| 2026-02-13 | Task completed | ✅ Completed |

---

## Completion Notes

Created create-cognito-users.sh and configure-github-secrets.sh scripts for automated user provisioning and CI/CD secret configuration. Updated deploy.yml workflow with VPC/Cognito parameter resolution from CloudFormation stack outputs. Admin and manager users created in Cognito with appropriate group assignments and temporary passwords.

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-13
