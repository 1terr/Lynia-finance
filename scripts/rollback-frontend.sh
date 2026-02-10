#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - Frontend Blue-Green Rollback
# ============================================================================
# Rolls back a frontend application to a previous deployment version stored
# in S3 versioned prefixes. Supports instant rollback by restoring from
# a previous deployment snapshot.
#
# Usage:
#   ./scripts/rollback-frontend.sh <environment> <application>
#   ./scripts/rollback-frontend.sh production admin-portal
#   ./scripts/rollback-frontend.sh staging distributor-dashboard
#
# The script is idempotent - running it multiple times with the same target
# version produces the same result.
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"; }

ENVIRONMENT="${1:-}"
APPLICATION="${2:-}"
REGION="us-east-1"

if [ -z "$ENVIRONMENT" ] || [ -z "$APPLICATION" ]; then
    echo "Usage: $0 <environment> <application>"
    echo ""
    echo "  environment:  staging | production"
    echo "  application:  admin-portal | distributor-dashboard"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    error "Invalid environment. Must be 'staging' or 'production'."
    exit 1
fi

if [[ ! "$APPLICATION" =~ ^(admin-portal|distributor-dashboard)$ ]]; then
    error "Invalid application. Must be 'admin-portal' or 'distributor-dashboard'."
    exit 1
fi

BUCKET="${ENVIRONMENT}-lynia-${APPLICATION}"

echo ""
echo "============================================"
echo "  Frontend Rollback"
echo "  Environment: $ENVIRONMENT"
echo "  Application: $APPLICATION"
echo "  Bucket:      $BUCKET"
echo "============================================"
echo ""

# Get current version
CURRENT_VERSION=$(aws s3 cp "s3://${BUCKET}/deployments/CURRENT_VERSION" - 2>/dev/null || echo "unknown")
log "Current version: $CURRENT_VERSION"

# List available versions
log "Available deployment versions:"
VERSIONS=$(aws s3 ls "s3://${BUCKET}/deployments/" \
    | grep PRE \
    | awk '{print $2}' \
    | tr -d '/' \
    | grep -v CURRENT_VERSION \
    | sort -r)

if [ -z "$VERSIONS" ]; then
    error "No previous deployments found in s3://${BUCKET}/deployments/"
    exit 1
fi

INDEX=0
declare -A VERSION_MAP
while IFS= read -r version; do
    INDEX=$((INDEX + 1))
    VERSION_MAP[$INDEX]=$version
    MARKER=""
    if [ "$version" == "$CURRENT_VERSION" ]; then
        MARKER=" (current)"
    fi
    echo "  $INDEX. $version$MARKER"
done <<< "$VERSIONS"

echo ""
read -p "Select version to rollback to (1-$INDEX): " SELECTION

if [ -z "${VERSION_MAP[$SELECTION]+x}" ]; then
    error "Invalid selection."
    exit 1
fi

TARGET_VERSION="${VERSION_MAP[$SELECTION]}"

if [ "$TARGET_VERSION" == "$CURRENT_VERSION" ]; then
    warn "Selected version is already the current version."
    exit 0
fi

log "Rolling back to: $TARGET_VERSION"

if [ "$ENVIRONMENT" == "production" ]; then
    read -p "Type 'ROLLBACK' to confirm production rollback: " CONFIRM
    if [ "$CONFIRM" != "ROLLBACK" ]; then
        echo "Rollback cancelled."
        exit 0
    fi
fi

ROLLBACK_START=$(date +%s)

# Restore from versioned prefix
log "Restoring files from s3://${BUCKET}/deployments/${TARGET_VERSION}/..."

aws s3 sync "s3://${BUCKET}/deployments/${TARGET_VERSION}/" "s3://${BUCKET}/" \
    --delete \
    --exclude "deployments/*" \
    --region "$REGION"

# Update current version marker
echo "$TARGET_VERSION" | aws s3 cp - "s3://${BUCKET}/deployments/CURRENT_VERSION"

# Invalidate CloudFront
CF_OUTPUT_KEY="AdminPortalDistributionId"
if [ "$APPLICATION" == "distributor-dashboard" ]; then
    CF_OUTPUT_KEY="DistributorDashboardDistributionId"
fi

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-lynia-frontend" \
    --query "Stacks[0].Outputs[?OutputKey=='${CF_OUTPUT_KEY}'].OutputValue" \
    --output text --region "$REGION" 2>/dev/null || echo "")

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
    log "Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "/*" \
        --region "$REGION" > /dev/null
    success "CloudFront invalidation started"
fi

ROLLBACK_END=$(date +%s)
DURATION=$((ROLLBACK_END - ROLLBACK_START))

echo ""
success "Rollback complete!"
log "Duration: ${DURATION}s"
log "Rolled back from $CURRENT_VERSION to $TARGET_VERSION"
echo ""
