# P5-DEPLOY-T004: Deploy RDS PostgreSQL Stack - Progress Report

**Task:** P5-DEPLOY-T004 - Deploy RDS PostgreSQL Stack
**Phase:** Phase 5 - AWS Deployment
**Section:** 5.1 Foundation Infrastructure
**Priority:** Critical
**Estimated Hours:** 3
**Dependencies:** P5-DEPLOY-T002 (VPC stack for private subnets and security groups)
**Status:** ⚪ NOT STARTED
**Completion Date:** —

---

## Task Description

Deploy RDS PostgreSQL 16.4 into the VPC private subnets created by T002. Production mode enables MultiAZ for high availability, 35-day automated backups, deletion protection, performance insights, and KMS-encrypted storage with auto-scaling to 100GB. Instance creation takes approximately 10-15 minutes.

## Deliverables

- [ ] RDS PostgreSQL 16.4 instance deployed in private subnets
- [ ] KMS-encrypted storage with auto-scaling
- [ ] Automated backups configured (35 days for production)
- [ ] Stack outputs recorded (endpoint, port, security group ID)
- [ ] Master password stored securely for T007

## Acceptance Criteria

- [ ] `DBInstanceStatus`: `available`
- [ ] `MultiAZ`: `true` (production)
- [ ] `StorageEncrypted`: `true`
- [ ] `DeletionProtection`: `true` (production)
- [ ] `Engine`: `postgres`, `EngineVersion`: `16.4`
- [ ] Instance in private subnet, not publicly accessible

---

## Configuration

| Setting | Dev/Staging | Production |
|---------|-------------|------------|
| Instance Type | db.t4g.micro | db.t4g.small |
| Storage | 20 GB | 50 GB (auto-scales to 100 GB) |
| Multi-AZ | No | **Yes** |
| Backup Retention | 7 days | **35 days** |
| Encryption | KMS | KMS |
| Performance Insights | No | **Yes** |
| Deletion Protection | No | **Yes** |

---

## Steps

### Step 1: Generate Secure Master Password

```bash
# Generate a secure random password (24 chars, alphanumeric)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)

# IMPORTANT: Save this password securely - needed for T007 (Secrets Manager)
echo "DB_PASSWORD=$DB_PASSWORD"
echo "Save this password in a secure location (password manager, etc.)"
```

### Step 2: Deploy RDS Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/rds.yaml \
  --stack-name production-lynia-rds \
  --parameter-overrides \
    Environment=production \
    DBMasterUsername=lynia_admin \
    DBMasterPassword="$DB_PASSWORD" \
  --region us-east-1

# This takes 10-15 minutes - start parallel tasks (T003, T005, T006, T008) while waiting
echo "RDS creation in progress... estimated 10-15 minutes"
aws cloudformation wait stack-create-complete \
  --stack-name production-lynia-rds \
  --region us-east-1
```

### Step 3: Record Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name production-lynia-rds \
  --query "Stacks[0].Outputs" \
  --output table

# Save key values
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name production-lynia-rds \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)
DB_PORT=$(aws cloudformation describe-stacks --stack-name production-lynia-rds \
  --query "Stacks[0].Outputs[?OutputKey=='DatabasePort'].OutputValue" --output text)
DB_SG=$(aws cloudformation describe-stacks --stack-name production-lynia-rds \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseSecurityGroupId'].OutputValue" --output text)

echo "DB_ENDPOINT=$DB_ENDPOINT"
echo "DB_PORT=$DB_PORT"
echo "DB_SG=$DB_SG"
```

---

## Verification

```bash
# 1. Stack status
aws cloudformation describe-stacks --stack-name production-lynia-rds \
  --query "Stacks[0].StackStatus"
# Expected: "CREATE_COMPLETE"

# 2. RDS instance details
aws rds describe-db-instances --db-instance-identifier production-lynia-db \
  --query "DBInstances[0].{
    Status:DBInstanceStatus,
    MultiAZ:MultiAZ,
    Encrypted:StorageEncrypted,
    DeletionProtection:DeletionProtection,
    Engine:Engine,
    EngineVersion:EngineVersion,
    InstanceClass:DBInstanceClass,
    PubliclyAccessible:PubliclyAccessible
  }"
# Expected:
# Status: available
# MultiAZ: true
# Encrypted: true
# DeletionProtection: true
# Engine: postgres
# EngineVersion: 16.4
# InstanceClass: db.t4g.small
# PubliclyAccessible: false

# 3. Verify instance is in private subnet
aws rds describe-db-instances --db-instance-identifier production-lynia-db \
  --query "DBInstances[0].DBSubnetGroup.Subnets[].SubnetAvailabilityZone.Name"
# Expected: ["us-east-1a", "us-east-1b"]

# 4. Verify backup retention
aws rds describe-db-instances --db-instance-identifier production-lynia-db \
  --query "DBInstances[0].BackupRetentionPeriod"
# Expected: 35

# 5. Verify storage auto-scaling
aws rds describe-db-instances --db-instance-identifier production-lynia-db \
  --query "DBInstances[0].MaxAllocatedStorage"
# Expected: 100
```

---

## Cost Impact

| Resource | Dev/Staging | Production |
|----------|-------------|------------|
| RDS Instance | ~$15/month (db.t4g.micro) | ~$25/month (db.t4g.small) |
| MultiAZ | — | ~$25/month (doubles instance cost) |
| Storage (50GB) | ~$6/month | ~$6/month |
| **Subtotal** | **~$21/month** | **~$56/month** |

---

## Files Involved

| File | Purpose |
|------|---------|
| `infrastructure/aws/rds.yaml` | RDS CloudFormation template |

---

## Progress Log

| Date | Action | Status |
|------|--------|--------|
| 2026-02-12 | Task created | ⚪ Not Started |

---
**Created**: 2026-02-12
**Last Updated**: 2026-02-12
