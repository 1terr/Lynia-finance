# Task A3: Infrastructure (Didit Secrets, SAM Params, Env Vars)

> **Track:** A - KYC (Didit) Integration
> **Status:** Not Started
> **Priority:** High (blocks Didit API calls)
> **Depends On:** Didit account created (DONE)
> **Estimated Effort:** Small

---

## Objective

Add Didit-specific infrastructure: Secrets Manager secret, SAM template parameters, environment variables, and shared secrets utility.

## Tasks

### A3.1: Add Didit Secret to Secrets Manager Template
- **File:** `infrastructure/aws/secrets-manager.yaml`
- **Action:** Add `DiditSecret` resource alongside existing `SmileIdentitySecret`:
  ```yaml
  DiditSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: !Sub "${Environment}/lynia/didit"
      Description: DIDIT KYC API credentials
      SecretString: !Sub |
        {
          "DIDIT_API_KEY": "${DiditApiKey}",
          "DIDIT_WEBHOOK_SECRET": "${DiditWebhookSecret}"
        }
      Tags:
        - Key: service
          Value: kyc-service
  ```
- **Update IAM:** Add Didit secret ARN to `KYCSecretsPolicy`

### A3.2: Add Didit SAM Parameters
- **File:** `template.yaml`
- **Action:** Add parameters:
  ```yaml
  DiditApiKey:
    Type: String
    NoEcho: true
    Default: ''
  DiditWebhookSecret:
    Type: String
    NoEcho: true
    Default: ''
  KYCProvider:
    Type: String
    Default: 'smile_identity'
    AllowedValues: ['smile_identity', 'didit']
  ```
- **Update KYCFunction env vars:**
  ```yaml
  KYC_PROVIDER: !Ref KYCProvider
  DIDIT_API_KEY: !Ref DiditApiKey
  DIDIT_WEBHOOK_SECRET: !Ref DiditWebhookSecret
  ```
- **Update IAM:** Allow `secretsmanager:GetSecretValue` on `${Environment}/lynia/didit-*`

### A3.3: Add `getDiditSecrets()` to Shared Utils
- **File:** `services/shared/utils/secrets.ts`
- **Action:** Add alongside existing `getSmileIdentitySecrets()`:
  ```typescript
  export async function getDiditSecrets(): Promise<{
    DIDIT_API_KEY: string;
    DIDIT_WEBHOOK_SECRET: string;
  }> {
    return getSecret(`${environment}/lynia/didit`);
  }
  ```

### A3.4: Update Environment Config Files
- **File:** `env.json` - Add Didit vars to `KYCFunction`:
  ```json
  "DIDIT_API_KEY": "your-sandbox-api-key",
  "DIDIT_WEBHOOK_SECRET": "your-sandbox-webhook-secret",
  "KYC_PROVIDER": "didit"
  ```
- **File:** `.env.example` - Add:
  ```
  DIDIT_API_KEY=your-didit-api-key
  DIDIT_WEBHOOK_SECRET=your-didit-webhook-secret
  KYC_PROVIDER=smile_identity
  ```

## Acceptance Criteria

- [ ] `DiditSecret` resource exists in `secrets-manager.yaml`
- [ ] IAM policy grants KYC Lambda read access to Didit secret
- [ ] SAM parameters `DiditApiKey`, `DiditWebhookSecret`, `KYCProvider` defined
- [ ] `KYCFunction` environment variables include all Didit vars
- [ ] `getDiditSecrets()` function added to shared secrets utility
- [ ] `env.json` and `.env.example` updated
- [ ] `sam build` succeeds
- [ ] `sam validate` passes

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |

---

## Files Modified

| File | Action |
|------|--------|
| `infrastructure/aws/secrets-manager.yaml` | Add DiditSecret + update IAM |
| `template.yaml` | Add Didit params + KYCFunction env vars + IAM |
| `services/shared/utils/secrets.ts` | Add `getDiditSecrets()` |
| `env.json` | Add Didit local test vars |
| `.env.example` | Add Didit env var docs |
