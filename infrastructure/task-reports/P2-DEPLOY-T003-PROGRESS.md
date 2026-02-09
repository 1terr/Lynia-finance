# P2-DEPLOY-T003: CloudWatch Alarms and Operational Dashboards - Progress Report

**Task**: Configure CloudWatch alarms and operational dashboards
**GitHub Issue**: #183
**Status**: COMPLETED
**Date**: 2026-02-09
**Phase**: Phase 2 - AWS Deployment

---

## Overview

Implemented comprehensive CloudWatch monitoring with SNS-based alerting, per-function error and latency alarms, API Gateway monitoring, and three operational dashboards (Operations, Business Metrics, Cost).

## Objectives

- [x] Create SNS topics for critical and warning alerts
- [x] Configure Lambda error rate alarms per function
- [x] Configure Lambda duration/latency alarms (p95)
- [x] Configure Lambda throttle alarms
- [x] Configure API Gateway error and latency alarms
- [x] Create Operations dashboard with real-time Lambda and API metrics
- [x] Create Business Metrics dashboard for loan, payment, and KYC tracking
- [x] Create Cost dashboard for production AWS spend monitoring
- [x] Create shared metrics utility for publishing custom business metrics

## Alarm Configuration

### Critical Alarms (SNS email + SMS)

| Alarm | Metric | Threshold | Period |
|-------|--------|-----------|--------|
| Scoring error critical | Lambda Errors | > 5 in 5min | 300s |
| Payment error critical | Lambda Errors | > 3 in 5min | 300s |
| WhatsApp error critical | Lambda Errors | > 10 in 5min | 300s |
| Lambda throttles | Throttles | >= 1 | 300s |
| API Gateway 5XX | 5XXError | > 10 in 5min | 300s |

### Warning Alarms (SNS email only)

| Alarm | Metric | Threshold | Period |
|-------|--------|-----------|--------|
| KYC error warning | Lambda Errors | > 5 in 10min | 300s x2 |
| Lock error warning | Lambda Errors | > 5 in 10min | 300s x2 |
| Notification error warning | Lambda Errors | > 10 in 10min | 300s x2 |
| Payment duration p95 | Duration | > 10s | 300s x2 |
| Scoring duration p95 | Duration | > 10s | 300s x2 |
| API Gateway 4XX | 4XXError | > 100 in 10min | 300s x2 |
| API Gateway latency p95 | Latency | > 5s | 300s x2 |

## Dashboards

1. **Operations Dashboard**: Lambda invocations, errors, duration, throttles, concurrent executions, API Gateway errors and latency
2. **Business Dashboard**: Loan applications, payments, KYC verifications, financial volume, loan portfolio
3. **Cost Dashboard** (production only): Estimated AWS charges

## Files Created

| File | Description |
|------|-------------|
| `infrastructure/monitoring/cloudwatch-alarms.yaml` | CloudFormation template for alarms and dashboards |
| `services/shared/utils/metrics.ts` | Custom CloudWatch metrics publisher utility |
