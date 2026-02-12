# P5-DEPLOY-T007: Deploy Secrets Manager Stack - Progress Report

**Task:** P5-DEPLOY-T007 - Deploy Secrets Manager Stack
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.2 Database & Secrets
**Priority:** Critical
**Estimated Hours:** 2
**Dependencies:** P5-DEPLOY-T004 (needs RDS endpoint for database secret)
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy AWS Secrets Manager with 7 secrets for centralized credential management and 6 IAM managed policies enforcing per-service least-privilege access. The database secret requires the RDS endpoint from T004. External service credentials can use sandbox placeholders initially.

## Deliverables

- [ ] 7 Secrets Manager secrets created
- [ ] 6 IAM managed policies for per-service access
- [ ] Database secret populated with RDS connection parameters
- [ ] Stack outputs recorded (secret ARNs and policy ARNs)

## Acceptance Criteria

- [ ] Stack status: `CREATE_COMPLETE`
- [ ] 7 secrets listed under `{env}/lynia/*` prefix
- [ ] 6 IAM managed policy ARNs in stack outputs
- [ ] Database secret contains correct `host`, `port`, `database`, `username`, `password`
- [ ] Each IAM policy scoped to only the secrets its service needs

---

## Secrets Inventory

| Secret Name | Service(s) | Contents |
|-------------|-----------|----------|
| `{env}/lynia/database` | All services | host, port, database, username, password |
| `{env}/lynia/whatsapp` | WhatsApp service | phone_number_id, access_token, webhook_verify_token |
| `{env}/lynia/smile-identity` | KYC service | partner_id, api_key |
| `{env}/lynia/ecocash` | Payment service | merchant_id, api_key |
| `{env}/lynia/onemoney` | Payment service | merchant_id, api_key |
| `{env}/lynia/trustonic` | Lock service | api_key, api_secret |
| `{env}/lynia/sms` | Notification service | api_key |

## IAM Policy Mapping

| Policy | Lambda Function | Secrets Access |
|--------|----------------|----------------|
| SharedSecretsPolicy | All functions | database |
| WhatsAppSecretsPolicy | WhatsAppFunction | database, whatsapp |
| PaymentSecretsPolicy | PaymentFunction | database, ecocash, onemoney |
| KYCSecretsPolicy | KYCFunction | database, smile-identity |
| LockSecretsPolicy | LockFunction | database, trustonic |
| NotificationSecretsPolicy | NotificationFunction | database, sms |

---

## Steps

### Step 1: Collect RDS Endpoint from T004

```bash
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name production-lynia-rds \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)
echo "DB_ENDPOINT=$DB_ENDPOINT"
```

### Step 2: Collect External API Credentials

Gather credentials for all external services. Use sandbox/test credentials for initial deployment:

```bash
# These values should come from the team's credential store
# For initial setup, use sandbox placeholders where needed
WHATSAPP_PHONE_ID="<from Meta Business Manager>"
WHATSAPP_TOKEN="<from Meta Business Manager>"
WHATSAPP_WEBHOOK_TOKEN="<generate a random string>"
SMILE_PARTNER_ID="<from Smile Identity dashboard>"
SMILE_API_KEY="<from Smile Identity dashboard>"
ECOCASH_MERCHANT_ID="<from EcoCash merchant portal>"
ECOCASH_API_KEY="<from EcoCash merchant portal>"
ONEMONEY_MERCHANT_ID="<from OneMoney merchant portal>"
ONEMONEY_API_KEY="<from OneMoney merchant portal>"
TRUSTONIC_API_KEY="<from Trustonic dashboard>"
TRUSTONIC_API_SECRET="<from Trustonic dashboard>"
SMS_API_KEY="<from SMS provider>"
```

### Step 3: Deploy Secrets Manager Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/secrets-manager.yaml \
  --stack-name production-lynia-secrets \
  --parameter-overrides \
    Environment=production \
    DBHost="$DB_ENDPOINT" \
    DBPort=5432 \
    DBName=lynia \
    DBUsername=lynia_admin \
    DBPassword="<RDS_PASSWORD_FROM_T004>" \
    WhatsAppPhoneNumberId="$WHATSAPP_PHONE_ID" \
    WhatsAppAccessToken="$WHATSAPP_TOKEN" \
    WhatsAppWebhookVerifyToken="$WHATSAPP_WEBHOOK_TOKEN" \
    SmilePartnerId="$SMILE_PARTNER_ID" \
    SmileApiKey="$SMILE_API_KEY" \
    EcocashMerchantId="$ECOCASH_MERCHANT_ID" \
    EcocashApiKey="$ECOCASH_API_KEY" \
    OnemoneyMerchantId="$ONEMONEY_MERCHANT_ID" \
    OnemoneyApiKey="$ONEMONEY_API_KEY" \
    TrustonicApiKey="$TRUSTONIC_API_KEY" \
    TrustonicApiSecret="$TRUSTONIC_API_SECRET" \
    SmsApiKey="$SMS_API_KEY" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### Step 4: Record Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name production-lynia-secrets \
  --query "Stacks[0].Outputs" \
  --output table
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-secrets \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. List all secrets
aws secretsmanager list-secrets \
  --filters Key=name,Values=production/lynia \
  --query "SecretList[].Name" --output text
# Expected: 7 secrets (database, whatsapp, smile-identity, ecocash, onemoney, trustonic, sms)

# 3. Verify database secret content (non-sensitive check)
aws secretsmanager get-secret-value \
  --secret-id production/lynia/database \
  --query "SecretString" | python3 -c "import sys,json; d=json.loads(json.load(sys.stdin)); print(f'host={d[\"host\"]}, port={d[\"port\"]}, db={d[\"database\"]}')"
# Expected: host=<rds-endpoint>, port=5432, db=lynia

# 4. Count IAM managed policies in outputs
aws cloudformation describe-stacks --stack-name production-lynia-secrets \
  --query "Stacks[0].Outputs[?contains(OutputKey,'PolicyArn')] | length(@)"
# Expected: 6

# 5. Verify WhatsApp policy only accesses whatsapp + database secrets
WHATSAPP_POLICY=$(aws cloudformation describe-stacks --stack-name production-lynia-secrets \
  --query "Stacks[0].Outputs[?OutputKey=='WhatsAppSecretsPolicyArn'].OutputValue" --output text)
aws iam get-policy-version \
  --policy-arn $WHATSAPP_POLICY \
  --version-id v1 \
  --query "PolicyVersion.Document.Statement[0].Resource"
# Expected: ARNs for database and whatsapp secrets only
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/secrets-manager.yaml` | Secrets Manager CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
