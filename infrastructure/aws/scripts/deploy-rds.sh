#!/usr/bin/env bash
# Deploy RDS PostgreSQL Stack for Lynia Finance
# Task: P5-DEPLOY-T004
# Dependencies: P5-DEPLOY-T002 (VPC stack must be deployed first)
#
# Usage:
#   ./deploy-rds.sh [environment]
#   ./deploy-rds.sh production
#   ./deploy-rds.sh staging

set -euo pipefail

ENVIRONMENT="${1:-production}"
REGION="us-east-1"
STACK_NAME="${ENVIRONMENT}-lynia-rds"
TEMPLATE_FILE="$(dirname "$0")/../rds.yaml"
DB_USERNAME="lynia_admin"

# Validate environment
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "development" ]]; then
  echo "ERROR: Invalid environment '$ENVIRONMENT'. Must be: development, staging, or production"
  exit 1
fi

# Check VPC stack dependency
echo "==> Checking VPC stack dependency..."
VPC_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "${ENVIRONMENT}-lynia-vpc" \
  --query "Stacks[0].StackStatus" \
  --output text \
  --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

if [[ "$VPC_STATUS" != "CREATE_COMPLETE" && "$VPC_STATUS" != "UPDATE_COMPLETE" ]]; then
  echo "ERROR: VPC stack '${ENVIRONMENT}-lynia-vpc' is not ready (status: $VPC_STATUS)"
  echo "Deploy P5-DEPLOY-T002 (VPC stack) first."
  exit 1
fi
echo "    VPC stack status: $VPC_STATUS"

# Check if RDS stack already exists
EXISTING_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text \
  --region "$REGION" 2>/dev/null || echo "NOT_FOUND")

if [[ "$EXISTING_STATUS" == "CREATE_COMPLETE" || "$EXISTING_STATUS" == "UPDATE_COMPLETE" ]]; then
  echo "RDS stack '$STACK_NAME' already exists (status: $EXISTING_STATUS)"
  echo "Use 'aws cloudformation update-stack' if you need to update it."
  exit 0
fi

# Generate secure master password
echo "==> Generating secure master password..."
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)

# IMPORTANT: Store password securely - needed for T007 (Secrets Manager)
echo ""
echo "============================================"
echo "  SAVE THIS PASSWORD SECURELY FOR T007"
echo "  DB_PASSWORD=$DB_PASSWORD"
echo "============================================"
echo ""

# Deploy RDS stack
echo "==> Deploying RDS stack: $STACK_NAME"
echo "    Environment: $ENVIRONMENT"
echo "    Region: $REGION"
echo "    Template: $TEMPLATE_FILE"
echo ""

aws cloudformation deploy \
  --template-file "$TEMPLATE_FILE" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    DBMasterUsername="$DB_USERNAME" \
    DBMasterPassword="$DB_PASSWORD" \
  --region "$REGION" \
  --tags \
    Environment="$ENVIRONMENT" \
    Service=lynia-finance \
    Task=P5-DEPLOY-T004

echo ""
echo "==> RDS creation in progress... this takes 10-15 minutes."
echo "    You can monitor progress with:"
echo "    aws cloudformation describe-stack-events --stack-name $STACK_NAME --region $REGION"
echo ""

# Wait for stack creation
echo "==> Waiting for stack creation to complete..."
aws cloudformation wait stack-create-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo "==> Stack creation complete!"
echo ""

# Record stack outputs
echo "==> Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output table \
  --region "$REGION"

DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text --region "$REGION")
DB_PORT=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DatabasePort'].OutputValue" --output text --region "$REGION")
DB_SG=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseSecurityGroupId'].OutputValue" --output text --region "$REGION")

echo ""
echo "==> Key Values (save for T007 Secrets Manager setup):"
echo "    DB_ENDPOINT=$DB_ENDPOINT"
echo "    DB_PORT=$DB_PORT"
echo "    DB_SG=$DB_SG"
echo "    DB_USERNAME=$DB_USERNAME"
echo "    DB_PASSWORD=$DB_PASSWORD"
echo ""

# Verification
echo "==> Running verification checks..."
echo ""

INSTANCE_ID="${ENVIRONMENT}-lynia-db"
DETAILS=$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" \
  --query "DBInstances[0].{
    Status:DBInstanceStatus,
    MultiAZ:MultiAZ,
    Encrypted:StorageEncrypted,
    DeletionProtection:DeletionProtection,
    Engine:Engine,
    EngineVersion:EngineVersion,
    InstanceClass:DBInstanceClass,
    PubliclyAccessible:PubliclyAccessible,
    BackupRetentionPeriod:BackupRetentionPeriod,
    MaxAllocatedStorage:MaxAllocatedStorage,
    AllocatedStorage:AllocatedStorage
  }" --output table --region "$REGION")

echo "$DETAILS"
echo ""

# Verify expected values for production
if [[ "$ENVIRONMENT" == "production" ]]; then
  echo "==> Production verification:"
  STATUS=$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" \
    --query "DBInstances[0].DBInstanceStatus" --output text --region "$REGION")
  MULTI_AZ=$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" \
    --query "DBInstances[0].MultiAZ" --output text --region "$REGION")
  ENCRYPTED=$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" \
    --query "DBInstances[0].StorageEncrypted" --output text --region "$REGION")
  DEL_PROTECT=$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" \
    --query "DBInstances[0].DeletionProtection" --output text --region "$REGION")
  PUBLICLY_ACC=$(aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" \
    --query "DBInstances[0].PubliclyAccessible" --output text --region "$REGION")

  PASS=true
  [[ "$STATUS" == "available" ]]    && echo "    [PASS] Status: available"          || { echo "    [FAIL] Status: $STATUS (expected: available)"; PASS=false; }
  [[ "$MULTI_AZ" == "True" ]]       && echo "    [PASS] MultiAZ: true"              || { echo "    [FAIL] MultiAZ: $MULTI_AZ (expected: True)"; PASS=false; }
  [[ "$ENCRYPTED" == "True" ]]      && echo "    [PASS] StorageEncrypted: true"      || { echo "    [FAIL] StorageEncrypted: $ENCRYPTED (expected: True)"; PASS=false; }
  [[ "$DEL_PROTECT" == "True" ]]    && echo "    [PASS] DeletionProtection: true"    || { echo "    [FAIL] DeletionProtection: $DEL_PROTECT (expected: True)"; PASS=false; }
  [[ "$PUBLICLY_ACC" == "False" ]]  && echo "    [PASS] PubliclyAccessible: false"   || { echo "    [FAIL] PubliclyAccessible: $PUBLICLY_ACC (expected: False)"; PASS=false; }

  if $PASS; then
    echo ""
    echo "==> All production verification checks PASSED"
  else
    echo ""
    echo "==> WARNING: Some verification checks FAILED"
    exit 1
  fi
fi

echo ""
echo "==> RDS deployment complete!"
echo "    Next: P5-DEPLOY-T007 (Secrets Manager) - store the DB credentials"
