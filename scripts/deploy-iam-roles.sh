#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T008: Deploy IAM Roles Stack
# ============================================================================
# Deploys 4 IAM roles for operations and CI/CD:
#   1. DeploymentRole         — GitHub Actions CI/CD (all environments)
#   2. AdminReadOnly          — Production monitoring with MFA (production only)
#   3. IncidentResponse       — Break-glass emergency access with MFA (production only)
#   4. FrontendDeployment     — S3 sync + CloudFront invalidation (all environments)
#
# Usage:
#   ./scripts/deploy-iam-roles.sh                       # Production deploy
#   ./scripts/deploy-iam-roles.sh --env staging          # Staging deploy (2 roles)
#   ./scripts/deploy-iam-roles.sh --dry-run              # Validate without deploying
#   ./scripts/deploy-iam-roles.sh --verify-only          # Verify existing stack
#   ./scripts/deploy-iam-roles.sh --outputs              # Show stack outputs only
#
# Exit codes:
#   0 - Deployment and verification successful
#   1 - Pre-flight check failed (credentials, template missing)
#   2 - Stack deployment failed
#   3 - Stack verification failed (resources not in expected state)
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
ENVIRONMENT="production"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
DRY_RUN=false
VERIFY_ONLY=false
OUTPUTS_ONLY=false

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Project root (script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Template path
IAM_TEMPLATE="$PROJECT_ROOT/infrastructure/aws/iam-roles.yaml"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env=*) ENVIRONMENT="${1#*=}"; shift ;;
    --env) ENVIRONMENT="${2:-production}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --verify-only) VERIFY_ONLY=true; shift ;;
    --outputs) OUTPUTS_ONLY=true; shift ;;
    --region=*) REGION="${1#*=}"; shift ;;
    --region) REGION="${2:-us-east-1}"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --env ENV         Target environment: production|staging|development (default: production)"
      echo "  --region REGION   AWS region (default: us-east-1)"
      echo "  --dry-run         Validate template without deploying"
      echo "  --verify-only     Only verify existing stack resources"
      echo "  --outputs         Show stack outputs only"
      echo "  --help            Show this help message"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Derived names
STACK_NAME="${ENVIRONMENT}-lynia-iam"
ARTIFACT_BUCKET="lynia-finance-${ENVIRONMENT}-templates"

# Determine expected roles based on environment
if [[ "$ENVIRONMENT" == "production" ]]; then
  EXPECTED_ROLES=("deployment-role" "admin-readonly" "incident-response" "frontend-deployment")
  EXPECTED_ROLE_COUNT=4
else
  EXPECTED_ROLES=("deployment-role" "frontend-deployment")
  EXPECTED_ROLE_COUNT=2
fi

# --------------------------------------------------------------------------
# Helper functions
# --------------------------------------------------------------------------
pass()    { echo -e "  ${GREEN}[PASS]${NC} $1"; CHECKS_PASSED=$((CHECKS_PASSED + 1)); }
fail()    { echo -e "  ${RED}[FAIL]${NC} $1"; CHECKS_FAILED=$((CHECKS_FAILED + 1)); }
warn()    { echo -e "  ${YELLOW}[WARN]${NC} $1"; CHECKS_WARNED=$((CHECKS_WARNED + 1)); }
info()    { echo -e "  ${BLUE}[INFO]${NC} $1"; }
step()    { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# --------------------------------------------------------------------------
# Step 0: Banner
# --------------------------------------------------------------------------
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Lynia Finance — P5-DEPLOY-T008: Deploy IAM Roles Stack        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Environment:  ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Region:       ${YELLOW}${REGION}${NC}"
echo -e "  Stack Name:   ${YELLOW}${STACK_NAME}${NC}"
echo -e "  Template:     ${YELLOW}infrastructure/aws/iam-roles.yaml${NC}"
echo -e "  Roles:        ${YELLOW}${EXPECTED_ROLE_COUNT} (${EXPECTED_ROLES[*]})${NC}"
echo -e "  Dry Run:      ${YELLOW}${DRY_RUN}${NC}"
echo -e "  Timestamp:    $(timestamp)"
echo ""

# --------------------------------------------------------------------------
# Step 1: Pre-flight Checks
# --------------------------------------------------------------------------
step "Step 1: Pre-flight Checks"

# Check AWS CLI
if command -v aws &>/dev/null; then
  AWS_VERSION=$(aws --version 2>&1 | head -1)
  pass "AWS CLI installed: $AWS_VERSION"
else
  fail "AWS CLI not installed"
  exit 1
fi

# Check AWS credentials
if aws sts get-caller-identity --region "$REGION" &>/dev/null; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
  CALLER_ARN=$(aws sts get-caller-identity --query Arn --output text --region "$REGION")
  pass "AWS credentials valid (Account: $ACCOUNT_ID)"
  info "Caller: $CALLER_ARN"
else
  fail "AWS credentials not configured or expired"
  exit 1
fi

# Check template exists
if [[ -f "$IAM_TEMPLATE" ]]; then
  TEMPLATE_SIZE=$(wc -c < "$IAM_TEMPLATE" | tr -d ' ')
  pass "IAM roles template found ($TEMPLATE_SIZE bytes)"
else
  fail "IAM roles template not found at: $IAM_TEMPLATE"
  exit 1
fi

# Validate template with CloudFormation API
info "Validating template with CloudFormation API..."
if aws cloudformation validate-template \
    --template-body "file://$IAM_TEMPLATE" \
    --region "$REGION" &>/dev/null; then
  pass "Template passes CloudFormation validation"
else
  fail "Template failed CloudFormation validation"
  aws cloudformation validate-template \
    --template-body "file://$IAM_TEMPLATE" \
    --region "$REGION" 2>&1 || true
  exit 1
fi

# If outputs-only mode, skip to outputs
if [[ "$OUTPUTS_ONLY" == true ]]; then
  step "Stack Outputs"
  if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].Outputs" \
      --output table \
      --region "$REGION"
  else
    fail "Stack $STACK_NAME does not exist"
    exit 3
  fi
  exit 0
fi

if [[ "$VERIFY_ONLY" == true ]]; then
  info "Verify-only mode — skipping deployment"
fi

# --------------------------------------------------------------------------
# Step 2: Deploy IAM Roles Stack
# --------------------------------------------------------------------------
if [[ "$VERIFY_ONLY" != true ]]; then
  step "Step 2: Deploy IAM Roles Stack"

  STACK_STATUS=""
  if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    STACK_STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].StackStatus" \
      --output text \
      --region "$REGION")
    info "Existing stack found with status: $STACK_STATUS"

    case "$STACK_STATUS" in
      CREATE_COMPLETE|UPDATE_COMPLETE|UPDATE_ROLLBACK_COMPLETE)
        info "Stack is in a deployable state — will update"
        ;;
      CREATE_IN_PROGRESS|UPDATE_IN_PROGRESS)
        warn "Stack operation already in progress — waiting for completion"
        ;;
      CREATE_FAILED|ROLLBACK_COMPLETE|DELETE_FAILED)
        warn "Stack is in a failed state ($STACK_STATUS)"
        info "You may need to delete the stack first: aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
        exit 2
        ;;
    esac
  fi

  if [[ "$DRY_RUN" == true ]]; then
    info "DRY RUN: Would deploy stack $STACK_NAME"
    info "DRY RUN: Parameters: Environment=$ENVIRONMENT, ArtifactBucketName=$ARTIFACT_BUCKET"
    info "DRY RUN complete — no resources were created"
  else
    info "Deploying IAM roles stack..."
    info "This typically takes 1-2 minutes"
    echo ""

    DEPLOY_START=$(date +%s)

    aws cloudformation deploy \
      --template-file "$IAM_TEMPLATE" \
      --stack-name "$STACK_NAME" \
      --parameter-overrides \
        "Environment=$ENVIRONMENT" \
        "ArtifactBucketName=$ARTIFACT_BUCKET" \
      --capabilities CAPABILITY_NAMED_IAM \
      --region "$REGION" \
      --no-fail-on-empty-changeset \
      --tags \
        "Environment=$ENVIRONMENT" \
        "Service=iam" \
        "Layer=security" \
        "ManagedBy=cloudformation" \
        "Project=lynia-finance"

    DEPLOY_END=$(date +%s)
    DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))
    pass "Stack deployment completed in ${DEPLOY_DURATION}s"
  fi
fi

# --------------------------------------------------------------------------
# Step 3: Record Stack Outputs
# --------------------------------------------------------------------------
step "Step 3: Record Stack Outputs"

FINAL_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text \
  --region "$REGION" 2>/dev/null || echo "DOES_NOT_EXIST")

if [[ "$FINAL_STATUS" == "CREATE_COMPLETE" || "$FINAL_STATUS" == "UPDATE_COMPLETE" ]]; then
  pass "Stack status: $FINAL_STATUS"
else
  fail "Stack status: $FINAL_STATUS (expected CREATE_COMPLETE or UPDATE_COMPLETE)"
  if [[ "$DRY_RUN" == true ]]; then
    info "Dry run — stack may not exist yet. Skipping output recording."
  else
    exit 2
  fi
fi

if [[ "$FINAL_STATUS" == "CREATE_COMPLETE" || "$FINAL_STATUS" == "UPDATE_COMPLETE" ]]; then
  echo ""
  info "Stack Outputs:"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs" \
    --output table \
    --region "$REGION"
  echo ""
fi

# --------------------------------------------------------------------------
# Step 4: Verify IAM Roles
# --------------------------------------------------------------------------
step "Step 4: Verify IAM Roles"

if [[ "$DRY_RUN" == true && "$FINAL_STATUS" != "CREATE_COMPLETE" && "$FINAL_STATUS" != "UPDATE_COMPLETE" ]]; then
  info "Dry run — skipping resource verification (stack not deployed)"
else

  # 4a. Verify each expected role exists
  info "Verifying IAM roles..."
  ROLE_COUNT=0
  for ROLE_SUFFIX in "${EXPECTED_ROLES[@]}"; do
    ROLE_NAME="${ENVIRONMENT}-lynia-${ROLE_SUFFIX}"

    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" \
      --query "Role.Arn" --output text 2>/dev/null || echo "NOT_FOUND")

    if [[ "$ROLE_ARN" != "NOT_FOUND" ]]; then
      pass "Role exists: $ROLE_NAME"
      ROLE_COUNT=$((ROLE_COUNT + 1))
    else
      fail "Role not found: $ROLE_NAME"
    fi
  done

  if [[ "$ROLE_COUNT" -eq "$EXPECTED_ROLE_COUNT" ]]; then
    pass "All $EXPECTED_ROLE_COUNT expected roles verified"
  else
    fail "Role count: $ROLE_COUNT (expected: $EXPECTED_ROLE_COUNT)"
  fi

  # 4b. Verify MFA conditions on production-only roles
  if [[ "$ENVIRONMENT" == "production" ]]; then
    echo ""
    info "Verifying MFA conditions on sensitive roles..."

    for MFA_ROLE in admin-readonly incident-response; do
      ROLE_NAME="${ENVIRONMENT}-lynia-${MFA_ROLE}"
      MFA_CONDITION=$(aws iam get-role --role-name "$ROLE_NAME" \
        --query "Role.AssumeRolePolicyDocument.Statement[0].Condition.Bool.\"aws:MultiFactorAuthPresent\"" \
        --output text 2>/dev/null || echo "NOT_FOUND")

      if [[ "$MFA_CONDITION" == "true" ]]; then
        pass "MFA required on: $ROLE_NAME"
      else
        fail "MFA not enforced on: $ROLE_NAME (got: $MFA_CONDITION)"
      fi
    done
  fi

  # 4c. Verify deployment role has expected policies
  echo ""
  info "Verifying deployment role inline policies..."
  DEPLOY_ROLE="${ENVIRONMENT}-lynia-deployment-role"
  POLICY_COUNT=$(aws iam list-role-policies --role-name "$DEPLOY_ROLE" \
    --query "PolicyNames | length(@)" --output text 2>/dev/null || echo "0")

  if [[ "$POLICY_COUNT" -ge 1 ]]; then
    pass "Deployment role has $POLICY_COUNT inline policy/policies"
    POLICY_NAME=$(aws iam list-role-policies --role-name "$DEPLOY_ROLE" \
      --query "PolicyNames[0]" --output text 2>/dev/null || echo "")
    info "Primary policy: $POLICY_NAME"
  else
    fail "Deployment role has no inline policies"
  fi

  # 4d. Verify frontend deployment role has expected policies
  FRONTEND_ROLE="${ENVIRONMENT}-lynia-frontend-deployment"
  FE_POLICY_COUNT=$(aws iam list-role-policies --role-name "$FRONTEND_ROLE" \
    --query "PolicyNames | length(@)" --output text 2>/dev/null || echo "0")

  if [[ "$FE_POLICY_COUNT" -ge 1 ]]; then
    pass "Frontend deployment role has $FE_POLICY_COUNT inline policy/policies"
  else
    fail "Frontend deployment role has no inline policies"
  fi
fi

# --------------------------------------------------------------------------
# Step 5: Summary
# --------------------------------------------------------------------------
step "Deployment Summary"

echo ""
echo -e "  ${CYAN}Stack:${NC}        $STACK_NAME"
echo -e "  ${CYAN}Environment:${NC}  $ENVIRONMENT"
echo -e "  ${CYAN}Region:${NC}       $REGION"
echo -e "  ${CYAN}Status:${NC}       ${FINAL_STATUS:-N/A}"
echo -e "  ${CYAN}Roles:${NC}        $EXPECTED_ROLE_COUNT IAM roles"
echo -e "  ${CYAN}Timestamp:${NC}    $(timestamp)"
echo ""
echo -e "  ┌──────────────────────────────────────┐"
echo -e "  │  Checks Passed:  ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "  │  Checks Failed:  ${RED}${CHECKS_FAILED}${NC}"
echo -e "  │  Warnings:       ${YELLOW}${CHECKS_WARNED}${NC}"
echo -e "  └──────────────────────────────────────┘"
echo ""

echo -e "  ${CYAN}IAM Role Summary:${NC}"
echo -e "  ┌───────────────────────────┬────────────────────────────────────┬──────────┐"
echo -e "  │ Role                      │ Purpose                            │ MFA      │"
echo -e "  ├───────────────────────────┼────────────────────────────────────┼──────────┤"
echo -e "  │ deployment-role           │ CI/CD (CloudFormation, Lambda, S3) │ No       │"
echo -e "  │ frontend-deployment       │ S3 sync + CloudFront invalidation  │ No       │"
if [[ "$ENVIRONMENT" == "production" ]]; then
echo -e "  │ admin-readonly            │ Production monitoring              │ ${YELLOW}Yes${NC}      │"
echo -e "  │ incident-response         │ Break-glass emergency access       │ ${YELLOW}Yes${NC}      │"
fi
echo -e "  └───────────────────────────┴────────────────────────────────────┴──────────┘"
echo ""

if [[ "$CHECKS_FAILED" -gt 0 ]]; then
  echo -e "  ${RED}DEPLOYMENT VERIFICATION FAILED${NC}"
  echo -e "  ${RED}$CHECKS_FAILED check(s) failed. Review the output above for details.${NC}"
  echo ""
  exit 3
elif [[ "$DRY_RUN" == true ]]; then
  echo -e "  ${YELLOW}DRY RUN COMPLETE${NC}"
  echo -e "  ${YELLOW}No resources were created. Remove --dry-run to deploy.${NC}"
  echo ""
  exit 0
else
  echo -e "  ${GREEN}ALL CHECKS PASSED — IAM roles stack deployed and verified successfully${NC}"
  echo ""

  echo -e "  ${CYAN}Next Step:${NC} Deploy downstream stacks that depend on IAM role ARNs:"
  echo -e "    - P5-DEPLOY-T010: SAM Lambda Deploy (uses DeploymentRoleArn)"
  echo -e "    - P5-DEPLOY-T014: Frontend Hosting (uses FrontendDeploymentRoleArn)"
  echo ""
  exit 0
fi
