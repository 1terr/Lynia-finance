# P6-FINERACT-T005: CloudWatch Alarms + Health Checks for Fineract

**Task ID**: P6-FINERACT-T005
**Phase**: Phase 6 — Apache Fineract Integration
**Layer**: Infrastructure
**Status**: Complete
**Date**: February 14, 2026

---

## Objective
Create a CloudFormation template that provisions CloudWatch alarms, an SNS alerting topic, and a production monitoring dashboard for the Fineract ECS service and its internal ALB.

## Deliverables
- `phase-6-fineract-integration/infrastructure/fineract-monitoring.yaml`

## Implementation Details
CloudFormation template with 6 CloudWatch alarms: service-down (critical), high CPU >80%, high memory >85%, unhealthy ALB targets (critical), ALB 5xx errors, and high latency >2s p95. SNS topic for email alerts. Production environment gets a 4-widget CloudWatch dashboard showing CPU/memory, task count, request volume, and HTTP status codes. Critical alarms (service-down, unhealthy targets) trigger immediate SNS notifications, while warning-level alarms (CPU, memory, latency) use a 3-datapoint evaluation period to reduce noise. The dashboard is conditionally created only in production to avoid unnecessary costs in lower environments.

## Verification
- `aws cloudformation validate-template --template-body file://phase-6-fineract-integration/infrastructure/fineract-monitoring.yaml`
- Confirm all 6 alarm resources are defined in the template
- Verify SNS topic and subscription resources exist
- Check that the dashboard resource uses a production condition
