# P2-DEPLOY-T001: AWS Secrets Manager Integration - Progress Report

**Task**: Migrate service credentials to AWS Secrets Manager with IAM-based access control
**GitHub Issue**: #181
**Status**: COMPLETED
**Date**: 2026-02-09
**Phase**: Phase 2 - AWS Deployment

---

## Overview

Implemented centralized secret management using AWS Secrets Manager for all 6 Lambda microservices. Secrets are organized by service and environment, with IAM policies enforcing least-privilege access per function.

## Objectives

- [x] Create Secrets Manager entries for all service credentials
- [x] Implement IAM policies with least-privilege access per Lambda function
- [x] Create shared TypeScript utility for secret retrieval with in-memory caching
- [x] Update SAM template with Secrets Manager IAM permissions
- [x] Add `SECRETS_PREFIX` environment variable for runtime secret resolution

## Implementation Summary

### Secrets Manager Entries (7 secrets)

| Secret Name Pattern | Service | Contents |
|---------------------|---------|----------|
| `{env}/lynia/supabase` | All services | URL, Service Role Key |
| `{env}/lynia/whatsapp` | WhatsApp | Phone Number ID, Access Token, Webhook Token |
| `{env}/lynia/didit` | KYC | Partner ID, API Key |
| `{env}/lynia/ecocash` | Payment | Merchant ID, API Key |
| `{env}/lynia/onemoney` | Payment | Merchant ID, API Key |
| `{env}/lynia/trustonic` | Lock | API Key, API Secret |
| `{env}/lynia/sms` | Notification | API Key |

### IAM Policy Mapping

| Lambda Function | Secrets Access |
|----------------|----------------|
| ScoringFunction | supabase |
| WhatsAppFunction | supabase, whatsapp |
| KYCFunction | supabase, didit |
| PaymentFunction | supabase, ecocash, onemoney |
| LockFunction | supabase, trustonic |
| NotificationFunction | supabase, sms |

### Shared Utility (`services/shared/utils/secrets.ts`)

- `getSecret(secretName)` - Retrieves and caches secrets with 5-minute TTL
- `buildSecretName(service)` - Constructs environment-prefixed secret name
- Service-specific helpers: `getSupabaseSecrets()`, `getWhatsAppSecrets()`, etc.
- `clearSecretCache()` - Cache invalidation for testing

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `infrastructure/aws/secrets-manager.yaml` | Created | CloudFormation template for Secrets Manager resources |
| `services/shared/utils/secrets.ts` | Created | Shared secret retrieval utility with caching |
| `template.yaml` | Modified | Added IAM policies and SECRETS_PREFIX env var |

## Key Design Decisions

1. **5-minute cache TTL**: Balances freshness vs API call reduction during Lambda warm invocations
2. **Environment-prefixed naming**: `{env}/lynia/{service}` enables multi-environment isolation
3. **Wildcard ARN matching**: Uses `-*` suffix in IAM policies to handle Secrets Manager's random suffix
4. **Backward compatibility**: Environment variables retained alongside Secrets Manager for migration flexibility

## Next Steps

- Deploy Secrets Manager stack before main application stack
- Populate secrets via AWS CLI or Console for each environment
- Gradually migrate Lambda functions to use `getSecret()` instead of `process.env`
