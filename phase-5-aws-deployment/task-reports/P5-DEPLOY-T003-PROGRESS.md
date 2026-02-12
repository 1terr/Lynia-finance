# P5-DEPLOY-T003: Deploy Cognito User Pool Stack - Progress Report

**Task:** P5-DEPLOY-T003 - Deploy Cognito User Pool Stack
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.1 Foundation Infrastructure
**Priority:** Critical
**Estimated Hours:** 2
**Dependencies:** P5-DEPLOY-T001
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy the Amazon Cognito User Pool with email-based authentication, MFA optional, advanced security enforced, and strong password policy. Create two app clients (admin portal, distributor dashboard) and five user groups for role-based access control.

## Deliverables

- [ ] Cognito User Pool deployed with email login
- [ ] 2 app clients created (admin-portal, distributor-dashboard)
- [ ] 5 user groups created (admin, manager, support, reports_viewer, distributor)
- [ ] Stack outputs recorded (UserPoolId, UserPoolArn, ClientIds)

## Acceptance Criteria

- [ ] Stack status: `CREATE_COMPLETE`
- [ ] User Pool status: `Enabled`
- [ ] MFA configuration: `OPTIONAL`
- [ ] Password policy: 12+ chars, upper/lower/number/symbol required
- [ ] 5 groups listed via `list-groups`
- [ ] Admin client: 1h access token, 30d refresh token
- [ ] Distributor client: 1h access token, 7d refresh token

---

## Configuration

### User Pool Settings
| Setting | Value |
|---------|-------|
| Sign-in | Email |
| MFA | Optional (TOTP) |
| Password length | 12+ characters |
| Password requirements | Uppercase, lowercase, numbers, symbols |
| Advanced security | Enforced |
| Account recovery | Email only |
| Email verification | Required |

### App Clients
| Client | Access Token | Refresh Token | Auth Flows |
|--------|-------------|---------------|------------|
| admin-portal | 1 hour | 30 days | USER_PASSWORD_AUTH, USER_SRP_AUTH |
| distributor-dashboard | 1 hour | 7 days | USER_PASSWORD_AUTH, USER_SRP_AUTH |

### User Groups
| Group | Description | Precedence |
|-------|-------------|------------|
| admin | Full system administrators | 1 |
| manager | Operations managers | 2 |
| support | Customer support staff | 3 |
| reports_viewer | Read-only reports access | 4 |
| distributor | Device distributors/agents | 5 |

---

## Steps

### Step 1: Deploy Cognito Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/cognito.yaml \
  --stack-name production-lynia-cognito \
  --parameter-overrides Environment=production \
  --region us-east-1
```

### Step 2: Record Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs" \
  --output table

# Save key values
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_ARN=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolArn'].OutputValue" --output text)
ADMIN_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='AdminClientId'].OutputValue" --output text)
DISTRIBUTOR_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].Outputs[?OutputKey=='DistributorClientId'].OutputValue" --output text)

echo "USER_POOL_ID=$USER_POOL_ID"
echo "USER_POOL_ARN=$USER_POOL_ARN"
echo "ADMIN_CLIENT_ID=$ADMIN_CLIENT_ID"
echo "DISTRIBUTOR_CLIENT_ID=$DISTRIBUTOR_CLIENT_ID"
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-cognito \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. User Pool details
aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID \
  --query "UserPool.{Status:Status,MfaConfiguration:MfaConfiguration}"
# Expected: Status=Active, MfaConfiguration=OPTIONAL

# 3. Password policy
aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID \
  --query "UserPool.Policies.PasswordPolicy"
# Expected: MinimumLength=12, RequireUppercase=true, RequireLowercase=true, RequireNumbers=true, RequireSymbols=true

# 4. User groups
aws cognito-idp list-groups --user-pool-id $USER_POOL_ID \
  --query "Groups[].GroupName" --output text
# Expected: admin  manager  support  reports_viewer  distributor

# 5. App clients
aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $ADMIN_CLIENT_ID \
  --query "UserPoolClient.{Name:ClientName,AccessTokenValidity:AccessTokenValidity,RefreshTokenValidity:RefreshTokenValidity}"
# Expected: Name=admin-portal, AccessTokenValidity=1 (hour), RefreshTokenValidity=30 (days)
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/cognito.yaml` | Cognito CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
