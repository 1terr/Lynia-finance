#!/usr/bin/env bash
# ============================================================
# Fineract Version Upgrade Check & Automation Script
# Item 14 from Phase 8 deferred items
#
# Checks for new Fineract releases on Docker Hub, compares
# with current version, and provides upgrade/rollback steps.
#
# Current version: 1.13.0 (defined in fineract-ecs.yaml)
# Usage: ./scripts/check-fineract-updates.sh [environment]
# ============================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
REGION="${AWS_REGION:-us-east-1}"
CURRENT_VERSION="1.13.0"
ECS_STACK="${ENVIRONMENT}-lynia-fineract-ecs"
ECS_CLUSTER="${ENVIRONMENT}-lynia-fineract"
ECS_SERVICE="${ENVIRONMENT}-lynia-fineract-service"

echo "=== Fineract Version Upgrade Check ==="
echo "Environment:     ${ENVIRONMENT}"
echo "Current Version: ${CURRENT_VERSION}"
echo ""

# ---- Step 1: Check latest Fineract release ----
echo "[1/5] Checking latest Fineract releases on Docker Hub..."

LATEST_TAGS=$(curl -s "https://hub.docker.com/v2/repositories/apache/fineract/tags?page_size=10&ordering=last_updated" 2>/dev/null || echo '{}')

echo "${LATEST_TAGS}" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    results = data.get('results', [])
    print('  Recent tags:')
    for tag in results[:5]:
        name = tag.get('name', 'unknown')
        updated = tag.get('last_updated', 'unknown')[:10]
        size_mb = round(tag.get('full_size', 0) / 1024 / 1024, 1)
        print(f'    {name:20s}  updated: {updated}  size: {size_mb}MB')
except:
    print('  Could not fetch tags (network unavailable)')
" 2>/dev/null || echo "  Could not check Docker Hub."

echo ""

# ---- Step 2: Check current deployed version ----
echo "[2/5] Checking currently deployed version..."

DEPLOYED_IMAGE=$(aws ecs describe-services \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE}" \
  --region "${REGION}" \
  --query "services[0].taskDefinition" \
  --output text 2>/dev/null || echo "not-found")

if [ "${DEPLOYED_IMAGE}" != "not-found" ]; then
  TASK_IMAGE=$(aws ecs describe-task-definition \
    --task-definition "${DEPLOYED_IMAGE}" \
    --region "${REGION}" \
    --query "taskDefinition.containerDefinitions[0].image" \
    --output text 2>/dev/null || echo "unknown")
  echo "  Deployed image: ${TASK_IMAGE}"
else
  echo "  ECS service not found (may not be deployed yet)."
fi

echo ""

# ---- Step 3: Pre-upgrade checklist ----
echo "[3/5] Pre-upgrade Checklist"
echo ""
echo "  Before upgrading Fineract, ensure:"
echo "  [ ] Read release notes for breaking changes"
echo "  [ ] Create database backup (run: bash scripts/setup-fineract-backup.sh ${ENVIRONMENT})"
echo "  [ ] Test upgrade in staging first"
echo "  [ ] Verify all loan data integrity after upgrade"
echo "  [ ] Update API integration tests if endpoints changed"
echo ""

# ---- Step 4: Upgrade procedure ----
echo "[4/5] Upgrade Procedure"
echo ""
echo "  To upgrade Fineract to a new version:"
echo ""
echo "  1. Update the image tag in CloudFormation:"
echo "     File: phase-6-fineract-integration/infrastructure/fineract-ecs.yaml"
echo "     Change FineractImageTag default: '${CURRENT_VERSION}' -> '<new-version>'"
echo ""
echo "  2. Deploy the updated stack:"
echo "     aws cloudformation update-stack \\"
echo "       --stack-name ${ECS_STACK} \\"
echo "       --template-body file://phase-6-fineract-integration/infrastructure/fineract-ecs.yaml \\"
echo "       --parameters ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \\"
echo "                    ParameterKey=FineractImageTag,ParameterValue=<new-version> \\"
echo "       --capabilities CAPABILITY_NAMED_IAM \\"
echo "       --region ${REGION}"
echo ""
echo "  3. Monitor the deployment:"
echo "     aws ecs wait services-stable --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE} --region ${REGION}"
echo ""
echo "  4. Verify health:"
echo "     curl -k https://<fineract-alb>/fineract-provider/actuator/health"
echo ""

# ---- Step 5: Rollback procedure ----
echo "[5/5] Rollback Procedure"
echo ""
echo "  To rollback to the previous version:"
echo ""
echo "  aws cloudformation update-stack \\"
echo "    --stack-name ${ECS_STACK} \\"
echo "    --use-previous-template \\"
echo "    --parameters ParameterKey=FineractImageTag,ParameterValue=${CURRENT_VERSION} \\"
echo "    --capabilities CAPABILITY_NAMED_IAM \\"
echo "    --region ${REGION}"
echo ""
echo "  Monitor: aws ecs wait services-stable --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE}"
echo ""
echo "=== Version check complete ==="