# P6-FINERACT-T002: Internal Application Load Balancer CloudFormation

**Task ID**: P6-FINERACT-T002
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Infrastructure
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Configure an internal Application Load Balancer within the ECS CloudFormation template to securely route HTTPS traffic to the Fineract service, accessible only from within the VPC by Lambda functions.

## Deliverables
- `phase-6-fineract-integration/infrastructure/fineract-ecs.yaml` (ALB section)

## Implementation Details
Internal ALB configured within the same CloudFormation template as the ECS cluster. Scheme=internal, listens on port 8443 with HTTPS (TLS 1.3), forwards to Fineract target group. Health check on `/fineract-provider/actuator/health`. Only accessible from Lambda security group. The ALB security group restricts inbound traffic exclusively to the Lambda security group, ensuring Fineract is never directly exposed to the public internet. Target group uses IP target type as required by Fargate awsvpc networking mode.

## Verification
- Verify ALB, target group, and listener resources exist in the template
- Confirm security group ingress rules restrict access to Lambda security group only
- Validate health check path is set to `/fineract-provider/actuator/health`
