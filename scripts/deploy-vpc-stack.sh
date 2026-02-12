#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T002: Deploy VPC Stack
# ============================================================================
# Deploys the VPC CloudFormation stack and verifies all resources are
# operational. Handles the complete lifecycle:
#   1. Pre-flight checks (AWS credentials, template existence)
#   2. Deploy VPC CloudFormation stack
#   3. Wait for stack creation/update to complete
#   4. Record stack outputs (VPC ID, subnet IDs, security group IDs)
#   5. Verify all resources (NAT gateways, VPC endpoints, security groups)
#   6. Generate deployment summary
#
# Usage:
#   ./scripts/deploy-vpc-stack.sh                        # Production deploy
#   ./scripts/deploy-vpc-stack.sh --env staging           # Staging deploy
#   ./scripts/deploy-vpc-stack.sh --env development       # Development deploy
#   ./scripts/deploy-vpc-stack.sh --dry-run               # Simulate only
#   ./scripts/deploy-vpc-stack.sh --verify-only           # Verify existing stack
#   ./scripts/deploy-vpc-stack.sh --outputs               # Show stack outputs only
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
REGION="us-east-1"
STACK_PREFIX="lynia-finance"
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
VPC_TEMPLATE="$PROJECT_ROOT/infrastructure/aws/vpc.yaml"

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
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --env ENV         Target environment: production|staging|development (default: production)"
      echo "  --region REGION   AWS region (default: us-east-1)"
      echo "  --dry-run         Simulate deployment without making changes"
      echo "  --verify-only     Only verify existing stack resources"
      echo "  --outputs         Show stack outputs only"
      echo "  --help            Show this help message"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Derived names
STACK_NAME="${ENVIRONMENT}-lynia-vpc"

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
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Lynia Finance — P5-DEPLOY-T002: Deploy VPC Stack          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Environment:  ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Region:       ${YELLOW}${REGION}${NC}"
echo -e "  Stack Name:   ${YELLOW}${STACK_NAME}${NC}"
echo -e "  Template:     ${YELLOW}infrastructure/aws/vpc.yaml${NC}"
echo -e "  Dry Run:      ${YELLOW}${DRY_RUN}${NC}"
echo -e "  Timestamp:    $(timestamp)"
echo ""

# --------------------------------------------------------------------------
# Step 1: Pre-flight checks
# --------------------------------------------------------------------------
step "Step 1: Pre-flight Checks"

# Check AWS CLI
if command -v aws &>/dev/null; then
  AWS_VERSION=$(aws --version 2>&1 | head -1)
  pass "AWS CLI installed: $AWS_VERSION"
else
  fail "AWS CLI not installed"
  echo -e "  ${RED}Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html${NC}"
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
  echo ""
  echo -e "  ${YELLOW}Configure credentials:${NC}"
  echo "    export AWS_ACCESS_KEY_ID=<your-key>"
  echo "    export AWS_SECRET_ACCESS_KEY=<your-secret>"
  echo "    export AWS_DEFAULT_REGION=$REGION"
  exit 1
fi

# Check template exists
if [[ -f "$VPC_TEMPLATE" ]]; then
  TEMPLATE_SIZE=$(wc -c < "$VPC_TEMPLATE" | tr -d ' ')
  pass "VPC template found ($TEMPLATE_SIZE bytes)"
else
  fail "VPC template not found at: $VPC_TEMPLATE"
  exit 1
fi

# Validate template with CloudFormation API
info "Validating template with CloudFormation API..."
if aws cloudformation validate-template \
    --template-body "file://$VPC_TEMPLATE" \
    --region "$REGION" &>/dev/null; then
  pass "Template passes CloudFormation validation"
else
  fail "Template failed CloudFormation validation"
  aws cloudformation validate-template \
    --template-body "file://$VPC_TEMPLATE" \
    --region "$REGION" 2>&1 || true
  exit 1
fi

# Check T001 dependency: verify S3 template bucket exists
TEMPLATE_BUCKET="${STACK_PREFIX}-${ENVIRONMENT}-templates"
if aws s3api head-bucket --bucket "$TEMPLATE_BUCKET" --region "$REGION" 2>/dev/null; then
  pass "T001 dependency met: S3 template bucket exists ($TEMPLATE_BUCKET)"
else
  warn "S3 template bucket not found ($TEMPLATE_BUCKET) - deploying from local file"
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

# If verify-only mode, skip deployment
if [[ "$VERIFY_ONLY" == true ]]; then
  info "Verify-only mode — skipping deployment"
fi

# --------------------------------------------------------------------------
# Step 2: Deploy VPC Stack
# --------------------------------------------------------------------------
if [[ "$VERIFY_ONLY" != true ]]; then
  step "Step 2: Deploy VPC Stack"

  # Check if stack already exists
  STACK_STATUS=""
  if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    STACK_STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].StackStatus" \
      --output text \
      --region "$REGION")
    info "Existing stack found with status: $STACK_STATUS"

    # Check if stack is in a deployable state
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
      *)
        warn "Unexpected stack status: $STACK_STATUS"
        ;;
    esac
  fi

  if [[ "$DRY_RUN" == true ]]; then
    info "DRY RUN: Would deploy stack $STACK_NAME with template $VPC_TEMPLATE"
    info "DRY RUN: Parameters: Environment=$ENVIRONMENT"

    # Create and display changeset for dry run
    CHANGESET_NAME="dry-run-$(date +%s)"
    info "Creating changeset to preview changes..."
    if aws cloudformation create-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGESET_NAME" \
        --template-body "file://$VPC_TEMPLATE" \
        --parameter-overrides "ParameterKey=Environment,ParameterValue=$ENVIRONMENT" \
        --capabilities CAPABILITY_IAM \
        --region "$REGION" 2>/dev/null; then

      # Wait for changeset
      sleep 5
      aws cloudformation describe-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGESET_NAME" \
        --query "Changes[].{Action:ResourceChange.Action,Resource:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType}" \
        --output table \
        --region "$REGION" 2>/dev/null || true

      # Clean up changeset
      aws cloudformation delete-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGESET_NAME" \
        --region "$REGION" 2>/dev/null || true
    fi

    info "DRY RUN complete — no resources were created"
  else
    info "Deploying VPC stack..."
    info "This may take 3-5 minutes (NAT gateways + VPC endpoints take time to provision)"
    echo ""

    DEPLOY_START=$(date +%s)

    aws cloudformation deploy \
      --template-file "$VPC_TEMPLATE" \
      --stack-name "$STACK_NAME" \
      --parameter-overrides "Environment=$ENVIRONMENT" \
      --capabilities CAPABILITY_IAM \
      --region "$REGION" \
      --no-fail-on-empty-changeset \
      --tags \
        "Environment=$ENVIRONMENT" \
        "Service=networking" \
        "Layer=infrastructure" \
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

# Verify stack exists and is in a good state
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

# Display full outputs table
if [[ "$FINAL_STATUS" == "CREATE_COMPLETE" || "$FINAL_STATUS" == "UPDATE_COMPLETE" ]]; then
  echo ""
  info "Stack Outputs:"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs" \
    --output table \
    --region "$REGION"
  echo ""

  # Extract and display key values
  VPC_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" --output text --region "$REGION")
  SUBNET1=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet1Id'].OutputValue" --output text --region "$REGION")
  SUBNET2=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet2Id'].OutputValue" --output text --region "$REGION")
  PUB_SUBNET1=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PublicSubnet1Id'].OutputValue" --output text --region "$REGION")
  PUB_SUBNET2=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='PublicSubnet2Id'].OutputValue" --output text --region "$REGION")
  LAMBDA_SG=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='LambdaSecurityGroupId'].OutputValue" --output text --region "$REGION")

  echo -e "  ${CYAN}Key Values for Downstream Stacks:${NC}"
  echo -e "    VPC_ID         = ${GREEN}${VPC_ID}${NC}"
  echo -e "    PRIVATE_SUBNET1= ${GREEN}${SUBNET1}${NC}"
  echo -e "    PRIVATE_SUBNET2= ${GREEN}${SUBNET2}${NC}"
  echo -e "    PUBLIC_SUBNET1 = ${GREEN}${PUB_SUBNET1}${NC}"
  echo -e "    PUBLIC_SUBNET2 = ${GREEN}${PUB_SUBNET2}${NC}"
  echo -e "    LAMBDA_SG      = ${GREEN}${LAMBDA_SG}${NC}"
  echo ""

  # Verify CloudFormation exports are available
  info "Verifying CloudFormation exports..."
  EXPORTS=$(aws cloudformation list-exports \
    --query "Exports[?starts_with(Name,'${ENVIRONMENT}-lynia-')].{Name:Name,Value:Value}" \
    --output table \
    --region "$REGION" 2>/dev/null || echo "")
  if [[ -n "$EXPORTS" ]]; then
    echo "$EXPORTS"
    pass "CloudFormation exports available for cross-stack references"
  else
    warn "No CloudFormation exports found — downstream stacks may fail to import values"
  fi
fi

# --------------------------------------------------------------------------
# Step 4: Verify Resources
# --------------------------------------------------------------------------
step "Step 4: Verify Resources"

if [[ "$DRY_RUN" == true && "$FINAL_STATUS" != "CREATE_COMPLETE" && "$FINAL_STATUS" != "UPDATE_COMPLETE" ]]; then
  info "Dry run — skipping resource verification (stack not deployed)"
else
  # 4a. Verify VPC
  info "Checking VPC..."
  VPC_STATE=$(aws ec2 describe-vpcs --vpc-ids "$VPC_ID" \
    --query "Vpcs[0].State" --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")
  if [[ "$VPC_STATE" == "available" ]]; then
    pass "VPC $VPC_ID is available"
  else
    fail "VPC $VPC_ID state: $VPC_STATE (expected: available)"
  fi

  VPC_CIDR=$(aws ec2 describe-vpcs --vpc-ids "$VPC_ID" \
    --query "Vpcs[0].CidrBlock" --output text --region "$REGION" 2>/dev/null || echo "UNKNOWN")
  if [[ "$VPC_CIDR" == "10.0.0.0/16" ]]; then
    pass "VPC CIDR: $VPC_CIDR"
  else
    fail "VPC CIDR: $VPC_CIDR (expected: 10.0.0.0/16)"
  fi

  # 4b. Verify subnets
  info "Checking subnets..."
  SUBNET_COUNT=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query "length(Subnets)" --output text --region "$REGION" 2>/dev/null || echo "0")
  if [[ "$SUBNET_COUNT" -ge 4 ]]; then
    pass "Subnet count: $SUBNET_COUNT (2 public + 2 private)"
  else
    fail "Subnet count: $SUBNET_COUNT (expected: 4)"
  fi

  # Verify private subnets don't have public IPs
  for SUBNET_ID in "$SUBNET1" "$SUBNET2"; do
    MAP_PUBLIC=$(aws ec2 describe-subnets --subnet-ids "$SUBNET_ID" \
      --query "Subnets[0].MapPublicIpOnLaunch" --output text --region "$REGION" 2>/dev/null || echo "UNKNOWN")
    if [[ "$MAP_PUBLIC" == "false" || "$MAP_PUBLIC" == "False" ]]; then
      pass "Private subnet $SUBNET_ID: MapPublicIpOnLaunch=false"
    else
      fail "Private subnet $SUBNET_ID: MapPublicIpOnLaunch=$MAP_PUBLIC (expected: false)"
    fi
  done

  # 4c. Verify NAT gateways
  info "Checking NAT gateways..."
  NAT_GATEWAYS=$(aws ec2 describe-nat-gateways \
    --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
    --query "NatGateways[].{Id:NatGatewayId,Name:Tags[?Key=='Name'].Value|[0],State:State,SubnetId:SubnetId}" \
    --output table --region "$REGION" 2>/dev/null || echo "")

  NAT_COUNT=$(aws ec2 describe-nat-gateways \
    --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
    --query "length(NatGateways)" --output text --region "$REGION" 2>/dev/null || echo "0")

  if [[ "$ENVIRONMENT" == "production" ]]; then
    if [[ "$NAT_COUNT" -ge 2 ]]; then
      pass "NAT gateways: $NAT_COUNT available (production HA requirement met)"
    else
      fail "NAT gateways: $NAT_COUNT available (production requires 2 for HA)"
    fi
  else
    if [[ "$NAT_COUNT" -ge 1 ]]; then
      pass "NAT gateways: $NAT_COUNT available"
    else
      fail "NAT gateways: $NAT_COUNT available (expected at least 1)"
    fi
  fi

  if [[ -n "$NAT_GATEWAYS" ]]; then
    echo "$NAT_GATEWAYS"
  fi

  # 4d. Verify VPC endpoints
  info "Checking VPC endpoints..."
  VPC_ENDPOINTS=$(aws ec2 describe-vpc-endpoints \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query "VpcEndpoints[].{Service:ServiceName,State:State,Type:VpcEndpointType}" \
    --output table --region "$REGION" 2>/dev/null || echo "")

  VPCE_COUNT=$(aws ec2 describe-vpc-endpoints \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query "length(VpcEndpoints)" --output text --region "$REGION" 2>/dev/null || echo "0")

  VPCE_AVAILABLE=$(aws ec2 describe-vpc-endpoints \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available" \
    --query "length(VpcEndpoints)" --output text --region "$REGION" 2>/dev/null || echo "0")

  if [[ "$VPCE_COUNT" -ge 4 ]]; then
    pass "VPC endpoints: $VPCE_COUNT found (secretsmanager, logs, sqs, xray)"
  else
    fail "VPC endpoints: $VPCE_COUNT found (expected: 4)"
  fi

  if [[ "$VPCE_AVAILABLE" -ge 4 ]]; then
    pass "VPC endpoints: $VPCE_AVAILABLE in 'available' state"
  else
    warn "VPC endpoints: $VPCE_AVAILABLE in 'available' state (some may still be provisioning)"
  fi

  if [[ -n "$VPC_ENDPOINTS" ]]; then
    echo "$VPC_ENDPOINTS"
  fi

  # Verify specific endpoint services
  for SERVICE in secretsmanager logs sqs xray; do
    FULL_SERVICE="com.amazonaws.${REGION}.${SERVICE}"
    ENDPOINT_STATE=$(aws ec2 describe-vpc-endpoints \
      --filters "Name=vpc-id,Values=$VPC_ID" "Name=service-name,Values=$FULL_SERVICE" \
      --query "VpcEndpoints[0].State" --output text --region "$REGION" 2>/dev/null || echo "NOT_FOUND")
    if [[ "$ENDPOINT_STATE" == "available" ]]; then
      pass "VPC endpoint: $SERVICE ($ENDPOINT_STATE)"
    elif [[ "$ENDPOINT_STATE" == "pending" ]]; then
      warn "VPC endpoint: $SERVICE ($ENDPOINT_STATE) — still provisioning"
    else
      fail "VPC endpoint: $SERVICE ($ENDPOINT_STATE)"
    fi
  done

  # 4e. Verify Lambda security group egress rules
  info "Checking Lambda security group egress rules..."
  SG_EGRESS=$(aws ec2 describe-security-groups --group-ids "$LAMBDA_SG" \
    --query "SecurityGroups[0].IpPermissionsEgress[].{Proto:IpProtocol,FromPort:FromPort,ToPort:ToPort,CIDR:IpRanges[0].CidrIp}" \
    --output table --region "$REGION" 2>/dev/null || echo "")

  # Check HTTPS (443) egress
  HTTPS_EGRESS=$(aws ec2 describe-security-groups --group-ids "$LAMBDA_SG" \
    --query "SecurityGroups[0].IpPermissionsEgress[?FromPort==\`443\` && ToPort==\`443\`].IpRanges[0].CidrIp" \
    --output text --region "$REGION" 2>/dev/null || echo "NONE")
  if [[ "$HTTPS_EGRESS" == "0.0.0.0/0" ]]; then
    pass "Lambda SG egress: tcp/443 (HTTPS) to 0.0.0.0/0"
  else
    fail "Lambda SG egress: tcp/443 (HTTPS) rule missing or misconfigured"
  fi

  # Check PostgreSQL (5432) egress
  PG_EGRESS=$(aws ec2 describe-security-groups --group-ids "$LAMBDA_SG" \
    --query "SecurityGroups[0].IpPermissionsEgress[?FromPort==\`5432\` && ToPort==\`5432\`].IpRanges[0].CidrIp" \
    --output text --region "$REGION" 2>/dev/null || echo "NONE")
  if [[ "$PG_EGRESS" == "0.0.0.0/0" ]]; then
    pass "Lambda SG egress: tcp/5432 (PostgreSQL) to 0.0.0.0/0"
  else
    fail "Lambda SG egress: tcp/5432 (PostgreSQL) rule missing or misconfigured"
  fi

  if [[ -n "$SG_EGRESS" ]]; then
    echo "$SG_EGRESS"
  fi

  # 4f. Verify private subnet routing to NAT gateway
  info "Checking private subnet route tables..."
  for PRIV_SUBNET in "$SUBNET1" "$SUBNET2"; do
    NAT_ROUTE=$(aws ec2 describe-route-tables \
      --filters "Name=association.subnet-id,Values=$PRIV_SUBNET" \
      --query "RouteTables[0].Routes[?DestinationCidrBlock=='0.0.0.0/0'].NatGatewayId" \
      --output text --region "$REGION" 2>/dev/null || echo "NONE")
    if [[ "$NAT_ROUTE" != "NONE" && "$NAT_ROUTE" != "None" && -n "$NAT_ROUTE" ]]; then
      pass "Subnet $PRIV_SUBNET routes to NAT gateway: $NAT_ROUTE"
    else
      fail "Subnet $PRIV_SUBNET has no route to NAT gateway"
    fi
  done

  # 4g. Verify VPC Endpoint security group allows ingress from Lambda SG
  info "Checking VPC Endpoint security group..."
  VPCE_SG_INGRESS=$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=${ENVIRONMENT}-lynia-vpce-sg" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`443\`].UserIdGroupPairs[0].GroupId" \
    --output text --region "$REGION" 2>/dev/null || echo "NONE")
  if [[ "$VPCE_SG_INGRESS" == "$LAMBDA_SG" ]]; then
    pass "VPC Endpoint SG allows ingress on 443 from Lambda SG ($LAMBDA_SG)"
  elif [[ "$VPCE_SG_INGRESS" != "NONE" && "$VPCE_SG_INGRESS" != "None" ]]; then
    warn "VPC Endpoint SG ingress from: $VPCE_SG_INGRESS (expected: $LAMBDA_SG)"
  else
    fail "VPC Endpoint SG has no ingress rule from Lambda SG"
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
echo -e "  ${CYAN}Timestamp:${NC}    $(timestamp)"
echo ""
echo -e "  ┌──────────────────────────────────────┐"
echo -e "  │  Checks Passed:  ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "  │  Checks Failed:  ${RED}${CHECKS_FAILED}${NC}"
echo -e "  │  Warnings:       ${YELLOW}${CHECKS_WARNED}${NC}"
echo -e "  └──────────────────────────────────────┘"
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
  echo -e "  ${GREEN}ALL CHECKS PASSED — VPC stack deployed and verified successfully${NC}"
  echo ""

  # Print cost reminder
  if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "  ${YELLOW}Cost Impact: ~\$92/month (2 NAT Gateways + 4 VPC Endpoints)${NC}"
  else
    echo -e "  ${YELLOW}Cost Impact: ~\$60/month (1 NAT Gateway + 4 VPC Endpoints)${NC}"
  fi

  echo ""
  echo -e "  ${CYAN}Next Step:${NC} Deploy downstream stacks that depend on VPC exports:"
  echo -e "    - P5-DEPLOY-T004: RDS PostgreSQL (uses private subnets + Lambda SG)"
  echo -e "    - P5-DEPLOY-T010: SAM Lambda (uses private subnets + Lambda SG)"
  echo ""
  exit 0
fi
