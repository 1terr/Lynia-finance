# P2-DEPLOY-T004: AWS WAF Rules on API Gateway - Progress Report

**Task**: Deploy AWS WAF rules on API Gateway for security protection
**GitHub Issue**: #184
**Status**: COMPLETED
**Date**: 2026-02-09
**Phase**: Phase 2 - AWS Deployment

---

## Overview

Deployed AWS WAFv2 WebACL with 8 rules protecting the API Gateway against common web attacks, brute force attempts, and suspicious traffic patterns. Includes rate limiting, SQL injection and XSS protection via AWS Managed Rule Groups, body size limits, and geographic awareness.

## Objectives

- [x] Create WAFv2 WebACL with regional scope for API Gateway
- [x] Configure global rate limiting (2000 req/5min per IP)
- [x] Configure stricter rate limiting on webhook/callback endpoints (100 req/5min)
- [x] Enable AWS Managed SQL injection protection
- [x] Enable AWS Managed XSS and Known Bad Inputs protection
- [x] Enable AWS Managed Common Rule Set (core protection)
- [x] Add request body size limit (16KB)
- [x] Configure geographic awareness for Southern African markets
- [x] Set up WAF logging to CloudWatch with block/count filtering
- [x] Associate WebACL with API Gateway stage

## WAF Rules Summary

| Priority | Rule | Type | Action | Description |
|----------|------|------|--------|-------------|
| 1 | RateLimitGlobal | Rate-based | Block | 2000 req/5min per IP |
| 2 | RateLimitAuth | Rate-based | Block | 100 req/5min on webhook/callback |
| 3 | AWSManagedSQLi | Managed | Block | SQL injection protection |
| 4 | AWSManagedXSS | Managed | Block | XSS and bad inputs protection |
| 5 | AWSManagedCommon | Managed | Block | Core web application protection |
| 6 | BlockSuspiciousHeaders | Custom | Block | Missing User-Agent header |
| 7 | BodySizeLimit | Custom | Block | Body > 16KB |
| 8 | GeoRestriction | Custom | Count | Non-Southern Africa traffic (monitor only) |

## Allowed Countries

ZW (Zimbabwe), ZA (South Africa), BW (Botswana), MZ (Mozambique), MW (Malawi), US, GB, DE (development/admin)

## WAF Logging

- Logs only BLOCK and COUNT actions to reduce costs
- Retention: 90 days (production), 30 days (dev/staging)
- Log group: `aws-waf-logs-{env}-lynia`

## Files Created

| File | Description |
|------|-------------|
| `infrastructure/aws/waf.yaml` | CloudFormation template for WAFv2 WebACL |
| `infrastructure/task-reports/P2-DEPLOY-T004-PROGRESS.md` | This report |
