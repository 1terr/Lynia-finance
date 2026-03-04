# M8: Populate Secrets Manager with API Credentials

**Time**: ~15 minutes
**Depends on**: Secrets Manager stack deployed (part of production-master.yaml or standalone)
**What this does**: Stores real API keys and credentials for all third-party integrations in AWS Secrets Manager. Lambda functions read these at runtime.

## Why This Is Needed

The code uses `@aws-sdk/client-secrets-manager` (via `services/shared/utils/secrets.ts`) to fetch credentials at runtime. If these secrets don't exist, Lambda functions will crash with "secret not found" errors when calling EcoCash, OneMoney, DIDIT, Trustonic, or WhatsApp APIs.

## What You Need

- AWS CLI configured with admin permissions
- Real API credentials for each service (get these from your service provider accounts)

## Secrets to Create

| Secret Name | Contents | Provider |
|-------------|----------|----------|
| `lynia/{env}/database` | DB connection details | AWS RDS |
| `lynia/{env}/whatsapp` | WhatsApp Cloud API credentials | Meta |
| `lynia/{env}/didit` | KYC provider credentials | DIDIT |
| `lynia/{env}/ecocash` | Mobile money credentials | Econet |
| `lynia/{env}/onemoney` | Mobile money credentials | NetOne |
| `lynia/{env}/trustonic` | Device lock credentials | Trustonic |
| `lynia/{env}/sms` | SMS provider credentials | SMS provider |

## Step-by-Step

### 1. Set your environment

```bash
export ENV=production   # or staging
export REGION=us-east-1
```

### 2. Store Database credentials

These come from M2 (RDS deployment):

```bash
aws secretsmanager create-secret \
  --name "lynia/${ENV}/database" \
  --description "RDS PostgreSQL connection details" \
  --secret-string '{
    "host": "REPLACE_WITH_RDS_ENDPOINT",
    "port": "5432",
    "database": "lynia",
    "username": "lynia_admin",
    "password": "REPLACE_WITH_DB_PASSWORD"
  }' \
  --region ${REGION}
```

### 3. Store WhatsApp Cloud API credentials

Get these from the [Meta Developer Portal](https://developers.facebook.com/):

```bash
aws secretsmanager create-secret \
  --name "lynia/${ENV}/whatsapp" \
  --description "WhatsApp Cloud API credentials" \
  --secret-string '{
    "phone_number_id": "REPLACE_WITH_PHONE_NUMBER_ID",
    "access_token": "REPLACE_WITH_ACCESS_TOKEN",
    "webhook_verify_token": "REPLACE_WITH_A_RANDOM_STRING",
    "business_account_id": "REPLACE_WITH_BUSINESS_ACCOUNT_ID"
  }' \
  --region ${REGION}
```

**Note**: For `webhook_verify_token`, generate a random string (e.g., `openssl rand -hex 32`). You'll configure this same string in the Meta webhook settings.

### 4. Store DIDIT credentials (KYC)

Get these from the [DIDIT Dashboard](https://dashboard.didit.me/):

```bash
aws secretsmanager create-secret \
  --name "lynia/${ENV}/didit" \
  --description "DIDIT KYC provider credentials" \
  --secret-string '{
    "api_key": "REPLACE_WITH_API_KEY",
    "webhook_secret": "REPLACE_WITH_WEBHOOK_SECRET"
  }' \
  --region ${REGION}
```

### 5. Store EcoCash credentials

Get these from Econet:

```bash
aws secretsmanager create-secret \
  --name "lynia/${ENV}/ecocash" \
  --description "EcoCash mobile money API credentials" \
  --secret-string '{
    "merchant_id": "REPLACE_WITH_MERCHANT_ID",
    "api_key": "REPLACE_WITH_API_KEY",
    "api_url": "https://api.ecocash.co.zw"
  }' \
  --region ${REGION}
```

**Note**: For staging, use `https://sandbox.ecocash.co.zw` instead.

### 6. Store OneMoney credentials

Get these from NetOne:

```bash
aws secretsmanager create-secret \
  --name "lynia/${ENV}/onemoney" \
  --description "OneMoney mobile money API credentials" \
  --secret-string '{
    "merchant_id": "REPLACE_WITH_MERCHANT_ID",
    "api_key": "REPLACE_WITH_API_KEY",
    "api_url": "https://api.onemoney.co.zw"
  }' \
  --region ${REGION}
```

**Note**: For staging, use `https://sandbox.onemoney.co.zw` instead.

### 7. Store Trustonic credentials (device lock)

Get these from Trustonic:

```bash
aws secretsmanager create-secret \
  --name "lynia/${ENV}/trustonic" \
  --description "Trustonic device lock API credentials" \
  --secret-string '{
    "api_key": "REPLACE_WITH_API_KEY",
    "api_secret": "REPLACE_WITH_API_SECRET"
  }' \
  --region ${REGION}
```

### 8. Store SMS provider credentials

```bash
aws secretsmanager create-secret \
  --name "lynia/${ENV}/sms" \
  --description "SMS provider API credentials" \
  --secret-string '{
    "api_key": "REPLACE_WITH_API_KEY",
    "sender_id": "LYNIA"
  }' \
  --region ${REGION}
```

### 9. Verify all secrets exist

```bash
aws secretsmanager list-secrets \
  --filter Key=name,Values="lynia/${ENV}" \
  --query 'SecretList[*].{Name:Name,Description:Description}' \
  --output table \
  --region ${REGION}
```

**Expected output**: A table listing all 7 secrets.

## Updating an Existing Secret

If you need to change a credential later:

```bash
aws secretsmanager update-secret \
  --secret-id "lynia/${ENV}/ecocash" \
  --secret-string '{
    "merchant_id": "NEW_MERCHANT_ID",
    "api_key": "NEW_API_KEY",
    "api_url": "https://api.ecocash.co.zw"
  }' \
  --region ${REGION}
```

Lambda functions cache secrets for 5 minutes (see `services/shared/utils/secrets.ts`), so changes take effect within 5 minutes without redeploying.

## Security Best Practices

1. **Never share secrets via email, Slack, or any unencrypted channel**
2. **Use different credentials for staging and production**
3. **Rotate credentials regularly** (at least every 90 days)
4. **Limit who can access secrets** — use IAM policies to restrict `secretsmanager:GetSecretValue`
5. **Enable secret rotation** for database credentials:
   ```bash
   aws secretsmanager rotate-secret \
     --secret-id "lynia/${ENV}/database" \
     --rotation-rules AutomaticallyAfterDays=90 \
     --region ${REGION}
   ```

## Troubleshooting

**"ResourceNotFoundException" in Lambda logs**
The secret name doesn't match what the code expects. Check `services/shared/utils/secrets.ts` for the exact naming convention.

**"AccessDeniedException" in Lambda logs**
The Lambda execution role doesn't have `secretsmanager:GetSecretValue` permission. Check the IAM role attached to the Lambda function.

**"ResourceExistsException" when creating**
The secret already exists. Use `update-secret` instead of `create-secret`.

## What Happens Next

- Lambda functions will now be able to fetch credentials at runtime
- Proceed to **M9** (Set GitHub Secrets) for CI/CD pipeline credentials
