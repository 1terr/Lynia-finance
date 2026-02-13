#!/usr/bin/env bash
# ============================================================================
# T0012 - Deploy CloudWatch Monitoring, Alarms & Log Retention
# ============================================================================
# Deploys 25+ CloudWatch alarms, 5 operational dashboards, 3 SNS topics,
# log groups with retention policies, and S3 archival for compliance.
#
# Usage:
#   ./scripts/deploy-monitoring.sh
#   ./scripts/deploy-monitoring.sh --env production
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT="staging"
REGION="us-east-1"

for arg in "$@"; do
  case $arg in
    --env=*) ENVIRONMENT="${arg#*=}" ;;
    --help) echo "Usage: $0 [--env staging|production]"; exit 0 ;;
  esac
done

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"; }

echo ""
echo "============================================"
echo "  CloudWatch Monitoring Deployment (T0012)"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"
echo ""

# ============================================================================
# Deploy CloudWatch Alarms & Dashboards
# ============================================================================
ALARMS_STACK="${ENVIRONMENT}-lynia-monitoring"
log "Deploying CloudWatch alarms and dashboards..."

aws cloudformation deploy \
  --stack-name "$ALARMS_STACK" \
  --template-file infrastructure/monitoring/cloudwatch-alarms.yaml \
  --parameter-overrides "Environment=${ENVIRONMENT}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "CloudWatch alarms and dashboards deployed"

# ============================================================================
# Deploy Log Retention & Archival
# ============================================================================
LOG_STACK="${ENVIRONMENT}-lynia-log-retention"
log "Deploying log retention and archival policies..."

aws cloudformation deploy \
  --stack-name "$LOG_STACK" \
  --template-file infrastructure/monitoring/log-retention-archival.yaml \
  --parameter-overrides "Environment=${ENVIRONMENT}" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT" Project=lynia-finance

success "Log retention and archival deployed"

# ============================================================================
# Verify
# ============================================================================
log "Verifying monitoring setup..."

ALARM_COUNT=$(aws cloudwatch describe-alarms \
  --alarm-name-prefix "${ENVIRONMENT}-lynia" \
  --query "length(MetricAlarms)" \
  --output text --region "$REGION" 2>/dev/null || echo "0")

DASHBOARD_COUNT=$(aws cloudwatch list-dashboards \
  --dashboard-name-prefix "${ENVIRONMENT}-lynia" \
  --query "length(DashboardEntries)" \
  --output text --region "$REGION" 2>/dev/null || echo "0")

SNS_TOPICS=$(aws sns list-topics \
  --query "length(Topics[?contains(TopicArn, '${ENVIRONMENT}-lynia')])" \
  --output text --region "$REGION" 2>/dev/null || echo "0")

echo ""
echo "============================================"
success "T0012 (Monitoring) complete"
echo "  CloudWatch alarms:    $ALARM_COUNT"
echo "  CloudWatch dashboards: $DASHBOARD_COUNT"
echo "  SNS alert topics:     $SNS_TOPICS"
echo "============================================"
echo ""
