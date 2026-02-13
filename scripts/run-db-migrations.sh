#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - P5-DEPLOY-T009: Run Database Migrations to RDS
# ============================================================================
# Orchestrates the complete database migration pipeline against RDS:
#   Phase 1: Pre-migration (auth schema stub + extensions)
#   Phase 2: Standard migrations (001-017, 35+ tables, 22+ indexes)
#   Phase 3: Post-migration (remove RLS, drop auth schema)
#
# This script wraps database/deploy-to-rds.sh with:
#   - Automatic RDS endpoint discovery from T004 stack
#   - Temporary security group rule for network access
#   - Pre/post verification queries
#   - Automatic cleanup of temporary network access
#
# Usage:
#   ./scripts/run-db-migrations.sh                              # Production
#   ./scripts/run-db-migrations.sh --env staging                # Staging
#   ./scripts/run-db-migrations.sh --verify-only                # Verify existing DB
#   ./scripts/run-db-migrations.sh --dry-run                    # Show plan without executing
#
# Required environment variables:
#   DB_PASSWORD   — RDS master password (from T004)
#
# Exit codes:
#   0 - Migrations and verification successful
#   1 - Pre-flight check failed
#   2 - Migration execution failed
#   3 - Post-migration verification failed
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
SKIP_NETWORK=false

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Paths
DEPLOY_SCRIPT="$PROJECT_ROOT/database/deploy-to-rds.sh"
MIGRATIONS_DIR="$PROJECT_ROOT/database/migrations"
AWS_MIGRATIONS_DIR="$PROJECT_ROOT/database/migrations/aws"

# Cleanup tracking
SG_RULE_ID=""
RDS_SG=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env=*) ENVIRONMENT="${1#*=}"; shift ;;
    --env) ENVIRONMENT="${2:-production}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --verify-only) VERIFY_ONLY=true; shift ;;
    --skip-network) SKIP_NETWORK=true; shift ;;
    --region=*) REGION="${1#*=}"; shift ;;
    --region) REGION="${2:-us-east-1}"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --env ENV          Target environment (default: production)"
      echo "  --region REGION    AWS region (default: us-east-1)"
      echo "  --dry-run          Show migration plan without executing"
      echo "  --verify-only      Only verify existing database state"
      echo "  --skip-network     Skip security group modification (use if already connected)"
      echo "  --help             Show this help message"
      echo ""
      echo "Required environment variables:"
      echo "  DB_PASSWORD        RDS master password (from T004 deployment)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Derived names
RDS_STACK_NAME="${ENVIRONMENT}-lynia-rds"
VPC_STACK_NAME="${ENVIRONMENT}-lynia-vpc"

# --------------------------------------------------------------------------
# Helper functions
# --------------------------------------------------------------------------
pass()    { echo -e "  ${GREEN}[PASS]${NC} $1"; CHECKS_PASSED=$((CHECKS_PASSED + 1)); }
fail()    { echo -e "  ${RED}[FAIL]${NC} $1"; CHECKS_FAILED=$((CHECKS_FAILED + 1)); }
warn()    { echo -e "  ${YELLOW}[WARN]${NC} $1"; CHECKS_WARNED=$((CHECKS_WARNED + 1)); }
info()    { echo -e "  ${BLUE}[INFO]${NC} $1"; }
step()    { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

cleanup() {
  if [[ -n "$SG_RULE_ID" && -n "$RDS_SG" ]]; then
    echo ""
    info "Cleaning up temporary security group rule..."
    aws ec2 revoke-security-group-ingress \
      --group-id "$RDS_SG" \
      --security-group-rule-ids "$SG_RULE_ID" \
      --region "$REGION" 2>/dev/null && \
      pass "Temporary network access revoked (rule: $SG_RULE_ID)" || \
      warn "Failed to revoke temporary access — MANUAL CLEANUP REQUIRED: rule $SG_RULE_ID on $RDS_SG"
  fi
}
trap cleanup EXIT

# --------------------------------------------------------------------------
# Step 0: Banner
# --------------------------------------------------------------------------
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Lynia Finance — P5-DEPLOY-T009: Run Database Migrations       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Environment:  ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Region:       ${YELLOW}${REGION}${NC}"
echo -e "  RDS Stack:    ${YELLOW}${RDS_STACK_NAME}${NC}"
echo -e "  Dry Run:      ${YELLOW}${DRY_RUN}${NC}"
echo -e "  Timestamp:    $(timestamp)"
echo ""

# --------------------------------------------------------------------------
# Step 1: Pre-flight Checks
# --------------------------------------------------------------------------
step "Step 1: Pre-flight Checks"

# Check AWS CLI
if command -v aws &>/dev/null; then
  pass "AWS CLI installed"
else
  fail "AWS CLI not installed"
  exit 1
fi

# Check psql
if command -v psql &>/dev/null; then
  PSQL_VERSION=$(psql --version 2>&1 | head -1)
  pass "PostgreSQL client installed: $PSQL_VERSION"
else
  fail "PostgreSQL client (psql) not installed"
  echo -e "  ${YELLOW}Install: sudo apt-get install postgresql-client${NC}"
  exit 1
fi

# Check AWS credentials
if aws sts get-caller-identity --region "$REGION" &>/dev/null; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
  pass "AWS credentials valid (Account: $ACCOUNT_ID)"
else
  fail "AWS credentials not configured or expired"
  exit 1
fi

# Check DB_PASSWORD
if [[ -n "${DB_PASSWORD:-}" ]]; then
  pass "DB_PASSWORD environment variable set"
else
  if [[ "$DRY_RUN" == true ]]; then
    warn "DB_PASSWORD not set (OK for dry-run mode)"
    DB_PASSWORD="placeholder"
  else
    fail "DB_PASSWORD environment variable required"
    exit 1
  fi
fi

# Check migration files exist
if [[ -f "$DEPLOY_SCRIPT" ]]; then
  pass "Migration script found: database/deploy-to-rds.sh"
else
  fail "Migration script not found: $DEPLOY_SCRIPT"
  exit 1
fi

if [[ -f "$AWS_MIGRATIONS_DIR/000_pre_migration.sql" ]]; then
  pass "Pre-migration SQL found"
else
  fail "Pre-migration SQL not found: $AWS_MIGRATIONS_DIR/000_pre_migration.sql"
  exit 1
fi

if [[ -f "$AWS_MIGRATIONS_DIR/018_remove_rls_for_aws.sql" ]]; then
  pass "Post-migration SQL found"
else
  fail "Post-migration SQL not found: $AWS_MIGRATIONS_DIR/018_remove_rls_for_aws.sql"
  exit 1
fi

MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "0*.sql" | wc -l | tr -d ' ')
pass "Standard migration files: $MIGRATION_COUNT"

# Check T004 dependency: verify RDS stack
info "Fetching RDS endpoint from T004 stack..."
RDS_STATUS=$(aws cloudformation describe-stacks --stack-name "$RDS_STACK_NAME" \
  --query "Stacks[0].StackStatus" --output text --region "$REGION" 2>/dev/null || echo "DOES_NOT_EXIST")

if [[ "$RDS_STATUS" == "CREATE_COMPLETE" || "$RDS_STATUS" == "UPDATE_COMPLETE" ]]; then
  DB_HOST=$(aws cloudformation describe-stacks --stack-name "$RDS_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text --region "$REGION")
  DB_PORT=$(aws cloudformation describe-stacks --stack-name "$RDS_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DatabasePort'].OutputValue" --output text --region "$REGION" 2>/dev/null || echo "5432")
  RDS_SG=$(aws cloudformation describe-stacks --stack-name "$RDS_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DatabaseSecurityGroupId'].OutputValue" --output text --region "$REGION" 2>/dev/null || echo "")
  pass "RDS stack found: $DB_HOST:${DB_PORT:-5432}"
else
  fail "RDS stack $RDS_STACK_NAME not found (status: $RDS_STATUS)"
  echo -e "  ${RED}T004 (Deploy RDS) must be completed before T009 (DB Migrations)${NC}"
  exit 1
fi

DB_PORT="${DB_PORT:-5432}"
CONN_STRING="postgresql://lynia_admin:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/lynia"

# --------------------------------------------------------------------------
# Step 2: Establish Network Connectivity
# --------------------------------------------------------------------------
if [[ "$DRY_RUN" != true && "$SKIP_NETWORK" != true ]]; then
  step "Step 2: Establish Network Connectivity"

  info "Getting your public IP address..."
  MY_IP=$(curl -s --max-time 5 https://checkip.amazonaws.com 2>/dev/null || echo "")

  if [[ -z "$MY_IP" ]]; then
    warn "Could not determine public IP — skipping security group modification"
    info "You may need to connect via bastion host or VPN"
  elif [[ -n "$RDS_SG" ]]; then
    info "Adding temporary inbound rule: $MY_IP/32 -> port $DB_PORT on $RDS_SG"

    SG_RULE_ID=$(aws ec2 authorize-security-group-ingress \
      --group-id "$RDS_SG" \
      --protocol tcp \
      --port "$DB_PORT" \
      --cidr "${MY_IP}/32" \
      --tag-specifications "ResourceType=security-group-rule,Tags=[{Key=Purpose,Value=temporary-migration},{Key=CreatedBy,Value=deploy-script}]" \
      --query "SecurityGroupRules[0].SecurityGroupRuleId" \
      --output text \
      --region "$REGION" 2>/dev/null || echo "")

    if [[ -n "$SG_RULE_ID" ]]; then
      pass "Temporary network access granted (rule: $SG_RULE_ID)"
      info "Will be automatically revoked on script exit"
    else
      warn "Could not add security group rule — may already exist or lack permissions"
    fi
  else
    warn "No RDS security group ID found in stack outputs — skipping"
  fi
else
  if [[ "$DRY_RUN" == true ]]; then
    info "Dry run — skipping network setup"
  else
    info "Skipping network setup (--skip-network)"
  fi
fi

# --------------------------------------------------------------------------
# Step 3: Run Migrations
# --------------------------------------------------------------------------
if [[ "$VERIFY_ONLY" != true ]]; then
  step "Step 3: Run Database Migrations"

  if [[ "$DRY_RUN" == true ]]; then
    info "DRY RUN: Would execute migration pipeline:"
    echo ""
    echo -e "    Phase 1: ${CYAN}database/migrations/aws/000_pre_migration.sql${NC}"
    echo -e "             Create auth schema stub, enable uuid-ossp, pg_trgm"
    echo ""
    echo -e "    Phase 2: ${CYAN}database/migrations/001_*.sql through 017_*.sql${NC}"
    echo -e "             $MIGRATION_COUNT standard migrations (35+ tables, 22+ indexes)"
    echo ""
    echo -e "    Phase 3: ${CYAN}database/migrations/aws/018_remove_rls_for_aws.sql${NC}"
    echo -e "             Disable RLS, drop auth schema, remove Supabase functions"
    echo ""
    info "DRY RUN complete — no migrations were executed"
  else
    info "Testing database connectivity..."
    if psql "$CONN_STRING" -c "SELECT version();" &>/dev/null; then
      pass "Database connection successful"
    else
      fail "Cannot connect to database at $DB_HOST:$DB_PORT"
      echo -e "  ${YELLOW}Check: network connectivity, credentials, security group rules${NC}"
      exit 2
    fi

    info "Executing migration pipeline via database/deploy-to-rds.sh..."
    echo ""
    MIGRATE_START=$(date +%s)

    if bash "$DEPLOY_SCRIPT" "$CONN_STRING"; then
      MIGRATE_END=$(date +%s)
      MIGRATE_DURATION=$((MIGRATE_END - MIGRATE_START))
      pass "Migration pipeline completed in ${MIGRATE_DURATION}s"
    else
      fail "Migration pipeline failed"
      exit 2
    fi
  fi
fi

# --------------------------------------------------------------------------
# Step 4: Verify Database State
# --------------------------------------------------------------------------
step "Step 4: Verify Database State"

if [[ "$DRY_RUN" == true ]]; then
  info "Dry run — skipping database verification"
else
  info "Running verification queries..."

  # 4a. Count tables
  TABLE_COUNT=$(psql "$CONN_STRING" -t -c \
    "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ' || echo "0")
  if [[ "$TABLE_COUNT" -ge 35 ]]; then
    pass "Table count: $TABLE_COUNT (>= 35)"
  else
    fail "Table count: $TABLE_COUNT (expected >= 35)"
  fi

  # 4b. Verify critical tables
  for TABLE in customers loans loan_applications payments devices distributors transactions audit_log; do
    EXISTS=$(psql "$CONN_STRING" -t -c \
      "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='$TABLE';" 2>/dev/null | tr -d ' ' || echo "0")
    if [[ "$EXISTS" -ge 1 ]]; then
      pass "Critical table exists: $TABLE"
    else
      fail "Critical table missing: $TABLE"
    fi
  done

  # 4c. Verify custom indexes
  INDEX_COUNT=$(psql "$CONN_STRING" -t -c \
    "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%';" 2>/dev/null | tr -d ' ' || echo "0")
  if [[ "$INDEX_COUNT" -ge 22 ]]; then
    pass "Custom index count: $INDEX_COUNT (>= 22)"
  else
    fail "Custom index count: $INDEX_COUNT (expected >= 22)"
  fi

  # 4d. Verify audit log partitions
  PARTITION_COUNT=$(psql "$CONN_STRING" -t -c \
    "SELECT count(*) FROM pg_tables WHERE tablename LIKE 'audit_log_%';" 2>/dev/null | tr -d ' ' || echo "0")
  if [[ "$PARTITION_COUNT" -ge 1 ]]; then
    pass "Audit log partitions: $PARTITION_COUNT"
  else
    warn "No audit log partitions found (may be created on first insert)"
  fi

  # 4e. Verify auth schema removed
  AUTH_EXISTS=$(psql "$CONN_STRING" -t -c \
    "SELECT count(*) FROM information_schema.schemata WHERE schema_name='auth';" 2>/dev/null | tr -d ' ' || echo "1")
  if [[ "$AUTH_EXISTS" -eq 0 ]]; then
    pass "Auth schema removed (post-migration cleanup)"
  else
    fail "Auth schema still exists (018 post-migration may not have run)"
  fi

  # 4f. Verify RLS disabled
  RLS_COUNT=$(psql "$CONN_STRING" -t -c \
    "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true;" 2>/dev/null | tr -d ' ' || echo "0")
  if [[ "$RLS_COUNT" -eq 0 ]]; then
    pass "RLS disabled on all tables"
  else
    fail "RLS still enabled on $RLS_COUNT table(s)"
  fi

  # 4g. Verify extensions
  for EXT in uuid-ossp pg_trgm; do
    EXT_EXISTS=$(psql "$CONN_STRING" -t -c \
      "SELECT count(*) FROM pg_extension WHERE extname='$EXT';" 2>/dev/null | tr -d ' ' || echo "0")
    if [[ "$EXT_EXISTS" -ge 1 ]]; then
      pass "Extension installed: $EXT"
    else
      fail "Extension missing: $EXT"
    fi
  done
fi

# --------------------------------------------------------------------------
# Step 5: Summary
# --------------------------------------------------------------------------
step "Migration Summary"

echo ""
echo -e "  ${CYAN}Environment:${NC}  $ENVIRONMENT"
echo -e "  ${CYAN}RDS Host:${NC}     ${DB_HOST:-N/A}"
echo -e "  ${CYAN}Database:${NC}     lynia"
echo -e "  ${CYAN}Migrations:${NC}   $MIGRATION_COUNT standard + 2 AWS-specific"
echo -e "  ${CYAN}Timestamp:${NC}    $(timestamp)"
echo ""
echo -e "  ┌──────────────────────────────────────┐"
echo -e "  │  Checks Passed:  ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "  │  Checks Failed:  ${RED}${CHECKS_FAILED}${NC}"
echo -e "  │  Warnings:       ${YELLOW}${CHECKS_WARNED}${NC}"
echo -e "  └──────────────────────────────────────┘"
echo ""

if [[ "$CHECKS_FAILED" -gt 0 ]]; then
  echo -e "  ${RED}MIGRATION VERIFICATION FAILED${NC}"
  echo -e "  ${RED}$CHECKS_FAILED check(s) failed. Review the output above for details.${NC}"
  echo ""
  exit 3
elif [[ "$DRY_RUN" == true ]]; then
  echo -e "  ${YELLOW}DRY RUN COMPLETE${NC}"
  echo -e "  ${YELLOW}No migrations were executed. Remove --dry-run to run.${NC}"
  echo ""
  exit 0
else
  echo -e "  ${GREEN}ALL CHECKS PASSED — Database migrations completed successfully${NC}"
  echo ""
  echo -e "  ${CYAN}Next Step:${NC} Deploy Lambda functions that connect to this database:"
  echo -e "    - P5-DEPLOY-T010: SAM Lambda Deploy"
  echo ""
  exit 0
fi
