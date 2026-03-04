# P2-DEPLOY-T009: AWS X-Ray Distributed Tracing - Progress Report

**Task**: Enable AWS X-Ray distributed tracing across all services
**GitHub Issue**: #189
**Status**: COMPLETED
**Date**: 2026-02-09
**Phase**: Phase 2 - AWS Deployment

---

## Overview

Enabled AWS X-Ray distributed tracing across all 6 Lambda functions with custom sampling rules, trace groups for filtered analysis, and a shared tracing utility for adding business-specific annotations and metadata.

## Configuration

### Tracing Activation
- `Tracing: Active` set in SAM Globals (all 6 functions)
- API Gateway stage tracing enabled via method settings
- VPC Endpoint for X-Ray configured (reduces NAT Gateway traffic)

### Sampling Rules

| Rule | Priority | Rate | Reservoir | Target |
|------|----------|------|-----------|--------|
| Errors | 50 | 100% | 10/s | All failed traces |
| Payment | 100 | 100% | 10/s | Payment service |
| KYC | 200 | 50% | 5/s | KYC service |
| Scoring | 300 | 25% | 3/s | Scoring service |
| Default | 10000 | 5% | 1/s | All other services |

### Trace Groups

| Group | Filter Expression | Insights | Notifications |
|-------|------------------|----------|---------------|
| Payments | `service("{env}-lynia-payment-service")` | Enabled | Prod only |
| Errors | `!ok` | Enabled | Prod only |
| High Latency | `responsetime > 5` | Enabled | No |

### Service Map
X-Ray automatically generates a service map showing all 6 Lambda functions, API Gateway, and external dependencies (Supabase, DIDIT, EcoCash, OneMoney, Trustonic).

## Shared Tracing Utility

| Function | Purpose |
|----------|---------|
| `initTracing()` | Initialize X-Ray, instrument HTTP/AWS calls |
| `addAnnotation(key, value)` | Add searchable annotation to trace |
| `addMetadata(key, value)` | Add non-indexed metadata |
| `traceAsync(name, fn)` | Wrap async operation in subsegment |
| `TraceAnnotations.*` | Pre-built helpers for business IDs |

## Estimated Overhead
- < 2ms per request (annotation/metadata)
- < 5ms per request with subsegments
- Sampling rules reduce volume by 95% for non-critical paths

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `infrastructure/aws/xray-tracing.yaml` | Created | Sampling rules and trace groups |
| `services/shared/utils/tracing.ts` | Created | Shared tracing utility |
| `template.yaml` | Modified (prev) | `Tracing: Active` in Globals |
