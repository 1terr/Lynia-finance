# P2-DEPLOY-T002: VPC Configuration for Lambda Functions - Progress Report

**Task**: Configure VPC with private subnets for Lambda functions
**GitHub Issue**: #182
**Status**: COMPLETED
**Date**: 2026-02-09
**Phase**: Phase 2 - AWS Deployment

---

## Overview

Implemented a complete VPC configuration with private subnets, NAT Gateways, security groups, and VPC Endpoints to provide network isolation for all Lambda functions while maintaining outbound connectivity to external APIs and AWS services.

## Objectives

- [x] Create VPC with CIDR block 10.0.0.0/16
- [x] Deploy private subnets across 2 availability zones for Lambda workloads
- [x] Deploy public subnets for NAT Gateways
- [x] Configure NAT Gateway (single for dev/staging, dual for production HA)
- [x] Create security groups for Lambda functions and VPC Endpoints
- [x] Configure VPC Endpoints for Secrets Manager, CloudWatch Logs, SQS, and X-Ray
- [x] Update main SAM template with VPC configuration support
- [x] Make VPC opt-in via `VpcEnabled` parameter for backward compatibility

## Architecture

```
VPC (10.0.0.0/16)
├── Public Subnet 1a (10.0.1.0/24) - NAT Gateway 1
├── Public Subnet 1b (10.0.2.0/24) - NAT Gateway 2 (prod only)
├── Private Subnet 1a (10.0.10.0/24) - Lambda functions
└── Private Subnet 1b (10.0.11.0/24) - Lambda functions

VPC Endpoints:
├── Secrets Manager (Interface)
├── CloudWatch Logs (Interface)
├── SQS (Interface)
└── X-Ray (Interface)
```

## Security Group Rules

| Security Group | Direction | Port | Target | Purpose |
|---------------|-----------|------|--------|---------|
| Lambda SG | Egress | 443 | 0.0.0.0/0 | HTTPS to external APIs |
| Lambda SG | Egress | 5432 | 0.0.0.0/0 | PostgreSQL to Supabase |
| VPC Endpoint SG | Ingress | 443 | Lambda SG | AWS service calls |

## Cost Estimate

| Resource | Dev/Staging | Production |
|----------|-------------|------------|
| NAT Gateway | ~$32/month (1x) | ~$64/month (2x HA) |
| VPC Endpoints | ~$28/month (4 endpoints) | ~$28/month (4 endpoints) |
| **Total** | **~$60/month** | **~$92/month** |

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `infrastructure/aws/vpc.yaml` | Created | Full VPC CloudFormation template |
| `template.yaml` | Modified | Added VPC parameters, conditions, and VpcConfig |

## Key Design Decisions

1. **Opt-in VPC**: `VpcEnabled=false` by default to avoid breaking existing deployments
2. **Single NAT Gateway for non-prod**: Reduces cost by ~$32/month for dev/staging
3. **Dual NAT Gateway for production**: Ensures HA across availability zones
4. **VPC Endpoints**: Reduce NAT Gateway data processing costs for AWS service traffic
5. **Outbound-only security groups**: Lambda functions have no inbound rules (API Gateway handles ingress)
