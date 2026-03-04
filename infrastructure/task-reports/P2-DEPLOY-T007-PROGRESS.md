# P2-DEPLOY-T007: API Gateway Throttling, Usage Plans, and API Keys - Progress Report

**Task**: Configure API Gateway throttling, usage plans, and API keys
**GitHub Issue**: #187
**Status**: COMPLETED
**Date**: 2026-02-09
**Phase**: Phase 2 - AWS Deployment

---

## Overview

Configured three-tier API Gateway usage plans with per-endpoint throttling, API key management for internal and partner integrations, and CloudWatch logging settings per environment.

## Usage Plans

| Plan | Burst Limit | Rate Limit | Daily Quota | Consumers |
|------|-------------|------------|-------------|-----------|
| Internal | 200 | 100 req/s | 100,000 | Admin portal, Distributor dashboard |
| Partner | 500 | 200 req/s | 500,000 | WhatsApp, EcoCash, OneMoney, DIDIT |
| Public | 50 | 20 req/s | 10,000 | Customer-facing access |

## Per-Endpoint Throttling

| Endpoint | Burst | Rate | Plan |
|----------|-------|------|------|
| `POST /scoring/calculate` | 50 | 25/s | Internal |
| `GET /scoring/*` | 100 | 50/s | Internal |
| `POST /whatsapp/webhook` | 500 | 200/s | Partner |
| `POST /payments/webhook` | 300 | 100/s | Partner |
| `POST /kyc/callback` | 100 | 50/s | Partner |

## API Keys Provisioned

| Key Name | Usage Plan | Purpose |
|----------|-----------|---------|
| `{env}-lynia-admin-portal` | Internal | Admin dashboard API access |
| `{env}-lynia-distributor-dashboard` | Internal | Field agent portal API access |
| `{env}-lynia-whatsapp-webhook` | Partner | WhatsApp Cloud API callbacks |
| `{env}-lynia-payment-providers` | Partner | EcoCash/OneMoney callbacks |
| `{env}-lynia-kyc-provider` | Partner | DIDIT callbacks |

## Stage Method Settings

| Setting | Production | Dev/Staging |
|---------|-----------|-------------|
| Default burst limit | 500 | 100 |
| Default rate limit | 200/s | 50/s |
| Logging level | ERROR | INFO |
| Data trace | false | true |
| Metrics | enabled | enabled |

## Files Created

| File | Description |
|------|-------------|
| `infrastructure/aws/api-gateway/throttling-usage-plans.yaml` | CloudFormation template |
| `infrastructure/task-reports/P2-DEPLOY-T007-PROGRESS.md` | This report |
