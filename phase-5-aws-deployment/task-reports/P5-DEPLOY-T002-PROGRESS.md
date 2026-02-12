# P5-DEPLOY-T002: Deploy VPC Stack - Progress Report

**Task:** P5-DEPLOY-T002 - Deploy VPC Stack
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.1 Foundation Infrastructure
**Priority:** Critical
**Estimated Hours:** 2
**Dependencies:** P5-DEPLOY-T001
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy the complete VPC with public subnets (for NAT gateways), private subnets (for Lambda functions and RDS), NAT gateways, route tables, security groups, and VPC endpoints for AWS services. Production mode creates dual NAT gateways for high availability.

## Deliverables

- [ ] VPC with 10.0.0.0/16 CIDR deployed
- [ ] 2 public subnets + 2 private subnets across 2 AZs
- [ ] NAT gateways operational (2 for production HA)
- [ ] 4 VPC endpoints reducing NAT gateway costs
- [ ] Stack outputs recorded

## Acceptance Criteria

- [ ] Stack status: `CREATE_COMPLETE`
- [ ] 2 NAT gateways in `available` state (production)
- [ ] 4 VPC endpoints all in `available` state
- [ ] Lambda security group allows egress on 443 (HTTPS) and 5432 (PostgreSQL)
- [ ] Outputs exported for cross-stack references

---

## Architecture

```
VPC (10.0.0.0/16)
├── Public Subnet 1a (10.0.1.0/24) ── NAT Gateway 1
├── Public Subnet 1b (10.0.2.0/24) ── NAT Gateway 2 (prod only)
├── Private Subnet 1a (10.0.10.0/24) ── Lambda functions, RDS
└── Private Subnet 1b (10.0.11.0/24) ── Lambda functions, RDS

VPC Endpoints (Interface):
├── com.amazonaws.us-east-1.secretsmanager
├── com.amazonaws.us-east-1.logs
├── com.amazonaws.us-east-1.sqs
└── com.amazonaws.us-east-1.xray

Security Groups:
├── Lambda SG ── Egress: 443 (HTTPS), 5432 (PostgreSQL)
└── VPC Endpoint SG ── Ingress: 443 from Lambda SG
```

---

## Steps

### Step 1: Deploy VPC Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/vpc.yaml \
  --stack-name production-lynia-vpc \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Wait for completion (3-5 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name production-lynia-vpc \
  --region us-east-1
```

### Step 2: Record Stack Outputs

```bash
# Get all outputs
aws cloudformation describe-stacks \
  --stack-name production-lynia-vpc \
  --query "Stacks[0].Outputs" \
  --output table

# Record specific values needed by downstream stacks
VPC_ID=$(aws cloudformation describe-stacks --stack-name production-lynia-vpc \
  --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" --output text)
SUBNET1=$(aws cloudformation describe-stacks --stack-name production-lynia-vpc \
  --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet1Id'].OutputValue" --output text)
SUBNET2=$(aws cloudformation describe-stacks --stack-name production-lynia-vpc \
  --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet2Id'].OutputValue" --output text)
LAMBDA_SG=$(aws cloudformation describe-stacks --stack-name production-lynia-vpc \
  --query "Stacks[0].Outputs[?OutputKey=='LambdaSecurityGroupId'].OutputValue" --output text)

echo "VPC_ID=$VPC_ID"
echo "SUBNET1=$SUBNET1"
echo "SUBNET2=$SUBNET2"
echo "LAMBDA_SG=$LAMBDA_SG"
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-vpc \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. Verify dual NAT gateways (production HA)
aws ec2 describe-nat-gateways \
  --filter "Name=tag:Name,Values=production-lynia-nat-*" \
  --query "NatGateways[].{Name:Tags[?Key=='Name'].Value|[0],State:State}"
# Expected: 2 gateways, both "available"

# 3. Verify VPC endpoints
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "VpcEndpoints[].{Service:ServiceName,State:State}"
# Expected: 4 endpoints (secretsmanager, logs, sqs, xray) all "available"

# 4. Verify Lambda security group rules
aws ec2 describe-security-groups --group-ids $LAMBDA_SG \
  --query "SecurityGroups[0].IpPermissionsEgress[].{Proto:IpProtocol,Port:FromPort,CIDR:IpRanges[0].CidrIp}"
# Expected: tcp/443 to 0.0.0.0/0, tcp/5432 to 0.0.0.0/0

# 5. Verify private subnets have route to NAT gateway
aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=$SUBNET1" \
  --query "RouteTables[0].Routes[?DestinationCidrBlock=='0.0.0.0/0'].NatGatewayId"
# Expected: nat-xxxxx (NAT gateway ID)
```

---

## Cost Impact

| Resource | Dev/Staging | Production |
|----------|-------------|------------|
| NAT Gateway | ~$32/month (1x) | ~$64/month (2x HA) |
| VPC Endpoints (4x) | ~$28/month | ~$28/month |
| **Subtotal** | **~$60/month** | **~$92/month** |

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/vpc.yaml` | VPC CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
