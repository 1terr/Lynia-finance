#!/usr/bin/env bash
# =====================================================
# Lynia Finance - Phase 6: Fineract Deployment Orchestrator
#
# Deploys the complete Fineract stack in order:
#   1. Database initialization (fineract_tenants + fineract_default)
#   2. Secrets Manager entry
#   3. ECS Fargate cluster + ALB + service
#   4. Wait for Fineract health check
#   5. Run product/GL setup
#   6. Monitoring stack (alarms + dashboard)
#   7. Lynia DB migration (fineract_* columns)
#
# Usage:
#   export ENVIRONMENT=development
#   export AWS_REGION=af-south-1
#   export RDS_ENDPOINT=your-rds-endpoint.rds.amazonaws.com
#   export DB_ADMIN_USER=lynia_admin
#   export DB_ADMIN_PASSWORD=...
#   export FINERACT_DB_PASSWORD=...
#   export FINERACT_BASIC_AUTH_PASSWORD=...
#   export FINERACT_MASTER_PASSWORD=...
#   bash phase-6-fineract-integration/scripts/deploy-fineract.sh
#
# Prerequisites:
#   - AWS CLI configured with appropriate IAM permissions
#   - psql client installed
#   - Node.js + ts-node for product setup
#   - Network access to RDS (run from bastion or VPN)
# =====================================================

set -euo pipefail

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHASE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$PHASE_DIR")"

ENVIRONMENT="${ENVIRONMENT:?ENVIRONMENT must be set (development|staging|production)}"
AWS_REGION="${AWS_REGION:-af-south-1}"
STACK_PREFIX="${ENVIRONMENT}-lynia-fineract"

# Validate environment
case "$ENVIRONMENT" in
  development|staging|production) ;;
  *) echo "ERROR: ENVIRONMENT must be development, staging, or production"; exit 1 ;;
esac

echo "============================================="
echo "Lynia Finance - Fineract Deployment"
echo "============================================="
echo "Environment: $ENVIRONMENT"
echo "Region:      $AWS_REGION"
echo "Phase Dir:   $PHASE_DIR"
echo ""

# -------------------------------------------------------
# Step 1: Database Initialization
# -------------------------------------------------------
echo "============================================="
echo "Step 1/7: Database Initialization"
echo "============================================="
if [ -n "${SKIP_DB_INIT:-}" ]; then
  echo "  Skipped (SKIP_DB_INIT is set)"
else
  bash "$PHASE_DIR/infrastructure/fineract-db-init.sh"
fi
echo ""

# -------------------------------------------------------
# Step 2: Secrets Manager
# -------------------------------------------------------
echo "============================================="
echo "Step 2/7: Secrets Manager Stack"
echo "============================================="
SECRETS_STACK="${STACK_PREFIX}-secrets"

# Check if the ECS stack exists first (secrets depend on its exports)
ECS_STACK="${STACK_PREFIX}-ecs"
ECS_EXISTS=$(aws cloudformation describe-stacks \
  --stack-name "$ECS_STACK" \
  --region "$AWS_REGION" \
  --query "Stacks[0].StackStatus" \
  --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if [ "$ECS_EXISTS" = "DOES_NOT_EXIST" ]; then
  echo "  NOTE: ECS stack not yet deployed. Secrets stack requires Fineract endpoint export."
  echo "  Deploying ECS stack first (Step 3), then returning to secrets."
  DEPLOY_SECRETS_AFTER_ECS=true
else
  aws cloudformation deploy \
    --template-file "$PHASE_DIR/infrastructure/fineract-secrets.yaml" \
    --stack-name "$SECRETS_STACK" \
    --region "$AWS_REGION" \
    --parameter-overrides \
      Environment="$ENVIRONMENT" \
      FineractDBUsername="${FINERACT_DB_USER:-fineract_admin}" \
      FineractDBPassword="${FINERACT_DB_PASSWORD:?}" \
      FineractMasterPassword="${FINERACT_MASTER_PASSWORD:-$(openssl rand -base64 32)}" \
      FineractBasicAuthUsername="${FINERACT_BASIC_AUTH_USER:-mifos}" \
      FineractBasicAuthPassword="${FINERACT_BASIC_AUTH_PASSWORD:?}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset
  echo "  Secrets stack deployed."
  DEPLOY_SECRETS_AFTER_ECS=false
fi
echo ""

# -------------------------------------------------------
# Step 3: ECS Fargate Stack
# -------------------------------------------------------
echo "============================================="
echo "Step 3/7: ECS Fargate Stack"
echo "============================================="
aws cloudformation deploy \
  --template-file "$PHASE_DIR/infrastructure/fineract-ecs.yaml" \
  --stack-name "$ECS_STACK" \
  --region "$AWS_REGION" \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    FineractImageTag="${FINERACT_IMAGE_TAG:-latest}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

echo "  ECS stack deployed."

# Deploy secrets if we deferred them
if [ "${DEPLOY_SECRETS_AFTER_ECS:-false}" = "true" ]; then
  echo ""
  echo "  Deploying deferred Secrets stack..."
  aws cloudformation deploy \
    --template-file "$PHASE_DIR/infrastructure/fineract-secrets.yaml" \
    --stack-name "$SECRETS_STACK" \
    --region "$AWS_REGION" \
    --parameter-overrides \
      Environment="$ENVIRONMENT" \
      FineractDBUsername="${FINERACT_DB_USER:-fineract_admin}" \
      FineractDBPassword="${FINERACT_DB_PASSWORD:?}" \
      FineractMasterPassword="${FINERACT_MASTER_PASSWORD:-$(openssl rand -base64 32)}" \
      FineractBasicAuthUsername="${FINERACT_BASIC_AUTH_USER:-mifos}" \
      FineractBasicAuthPassword="${FINERACT_BASIC_AUTH_PASSWORD:?}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset
  echo "  Deferred Secrets stack deployed."
fi
echo ""

# -------------------------------------------------------
# Step 4: Wait for Fineract Health Check
# -------------------------------------------------------
echo "============================================="
echo "Step 4/7: Waiting for Fineract Health Check"
echo "============================================="

FINERACT_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$ECS_STACK" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FineractALBEndpoint'].OutputValue" \
  --output text)

echo "  Fineract ALB: $FINERACT_ENDPOINT"
echo "  Waiting up to 5 minutes for Fineract to become healthy..."

MAX_RETRIES=30
RETRY_INTERVAL=10
for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -kso /dev/null -w "%{http_code}" \
    "https://${FINERACT_ENDPOINT}:8443/fineract-provider/actuator/health" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  Fineract is healthy! (attempt $i/$MAX_RETRIES)"
    break
  fi

  if [ "$i" = "$MAX_RETRIES" ]; then
    echo "  ERROR: Fineract did not become healthy within 5 minutes."
    echo "  Last HTTP code: $HTTP_CODE"
    echo "  Check ECS task logs: aws logs tail /ecs/${ENVIRONMENT}-lynia-fineract --region $AWS_REGION"
    exit 1
  fi

  echo "  Attempt $i/$MAX_RETRIES: HTTP $HTTP_CODE. Retrying in ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done
echo ""

# -------------------------------------------------------
# Step 5: Product & GL Account Setup
# -------------------------------------------------------
echo "============================================="
echo "Step 5/7: Product & GL Account Setup"
echo "============================================="
if [ -n "${SKIP_PRODUCT_SETUP:-}" ]; then
  echo "  Skipped (SKIP_PRODUCT_SETUP is set)"
else
  export FINERACT_SECRET_NAME="${ENVIRONMENT}/lynia/fineract-api"
  npx ts-node "$PHASE_DIR/config/setup-fineract-products.ts"
fi
echo ""

# -------------------------------------------------------
# Step 6: Monitoring Stack
# -------------------------------------------------------
echo "============================================="
echo "Step 6/7: Monitoring Stack"
echo "============================================="
MONITORING_STACK="${STACK_PREFIX}-monitoring"

aws cloudformation deploy \
  --template-file "$PHASE_DIR/infrastructure/fineract-monitoring.yaml" \
  --stack-name "$MONITORING_STACK" \
  --region "$AWS_REGION" \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    AlertEmail="${ALERT_EMAIL:-alerts@lynia.co.zw}" \
  --no-fail-on-empty-changeset

echo "  Monitoring stack deployed."
echo ""

# -------------------------------------------------------
# Step 7: Lynia Database Migration
# -------------------------------------------------------
echo "============================================="
echo "Step 7/7: Lynia Database Migration (019)"
echo "============================================="
if [ -n "${SKIP_MIGRATION:-}" ]; then
  echo "  Skipped (SKIP_MIGRATION is set)"
else
  MIGRATION_FILE="$PROJECT_DIR/database/migrations/019_add_fineract_columns.sql"
  if [ -f "$MIGRATION_FILE" ]; then
    export PGPASSWORD="${DB_ADMIN_PASSWORD:?}"
    psql -h "${RDS_ENDPOINT:?}" -p "${RDS_PORT:-5432}" -U "${DB_ADMIN_USER:?}" -d lynia \
      -f "$MIGRATION_FILE"
    echo "  Migration 019 applied."
  else
    echo "  ERROR: Migration file not found: $MIGRATION_FILE"
    exit 1
  fi
fi
echo ""

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
echo "============================================="
echo "Deployment Complete!"
echo "============================================="
echo ""
echo "Fineract Endpoint: https://${FINERACT_ENDPOINT}:8443"
echo "API Base URL:      https://${FINERACT_ENDPOINT}:8443/fineract-provider/api/v1"
echo ""
echo "CloudFormation Stacks:"
echo "  - $ECS_STACK"
echo "  - $SECRETS_STACK"
echo "  - $MONITORING_STACK"
echo ""
echo "Next steps:"
echo "  1. Verify loan products: curl -ku mifos:PASSWORD https://${FINERACT_ENDPOINT}:8443/fineract-provider/api/v1/loanproducts -H 'Fineract-Platform-TenantId: default'"
echo "  2. Verify GL accounts:   curl -ku mifos:PASSWORD https://${FINERACT_ENDPOINT}:8443/fineract-provider/api/v1/glaccounts -H 'Fineract-Platform-TenantId: default'"
echo "  3. Update Lambda environment variables with FINERACT_SECRET_NAME=${ENVIRONMENT}/lynia/fineract-api"
echo ""
