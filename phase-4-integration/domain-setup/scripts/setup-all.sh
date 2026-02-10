#!/usr/bin/env bash
# =============================================================================
# Lynia Finance — Full Domain Setup Orchestrator
# =============================================================================
# Orchestrates the complete domain connection flow:
#   1. AWS: Request ACM certificates
#   2. Cloudflare: Add validation CNAMEs + DNS records + SSL/security
#   3. AWS: Wait for certificate validation
#   4. AWS: Update CloudFront distributions
#   5. AWS: Configure API Gateway custom domain
#   6. Verify everything
#
# Prerequisites:
#   - AWS CLI configured with production credentials
#   - CF_API_TOKEN and CF_ZONE_ID exported
#   - jq and curl installed
#
# Usage:
#   export CF_API_TOKEN="your-cloudflare-token"
#   export CF_ZONE_ID="your-zone-id"
#   bash setup-all.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_phase() { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════════${NC}"; echo -e "${BOLD}  Phase: $1${NC}"; echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${NC}\n"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }

confirm() {
  local msg="$1"
  echo ""
  read -rp "$(echo -e "${YELLOW}$msg [y/N]: ${NC}")" answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Lynia Finance — Full Domain Setup                     ║"
echo "║   Domain: lyniafinance.com                              ║"
echo "║                                                         ║"
echo "║   This will:                                            ║"
echo "║   1. Request AWS ACM certificates                       ║"
echo "║   2. Configure Cloudflare DNS + SSL + security          ║"
echo "║   3. Update CloudFront distributions                    ║"
echo "║   4. Set up API Gateway custom domain                   ║"
echo "║   5. Verify the complete setup                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Pre-flight checks
log_info "Running pre-flight checks..."

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  log_error "CF_API_TOKEN not set"
  echo "  export CF_API_TOKEN=\"your-cloudflare-api-token\""
  exit 1
fi

if [[ -z "${CF_ZONE_ID:-}" ]]; then
  log_error "CF_ZONE_ID not set"
  echo "  export CF_ZONE_ID=\"your-zone-id\""
  exit 1
fi

for cmd in aws jq curl; do
  if ! command -v "$cmd" &> /dev/null; then
    log_error "$cmd is required but not installed"
    exit 1
  fi
done

if ! aws sts get-caller-identity &> /dev/null; then
  log_error "AWS CLI not configured"
  exit 1
fi

log_ok "All pre-flight checks passed"

if ! confirm "Proceed with domain setup?"; then
  echo "Aborted."
  exit 0
fi

# ============================================================
# Phase 1: AWS ACM Certificates
# ============================================================
log_phase "1/5 — Request ACM Certificates"

bash "$SCRIPT_DIR/aws-domain-setup.sh" certificates

echo ""
log_warn "ACM certificates have been requested."
log_warn "The validation CNAME records will be added to Cloudflare in the next step."

# Extract validation records from the certificate
DOMAIN="lyniafinance.com"
WILDCARD_CERT_ARN=""
API_CERT_ARN=""

if [[ -f /tmp/lynia-wildcard-cert-arn.txt ]]; then
  WILDCARD_CERT_ARN=$(cat /tmp/lynia-wildcard-cert-arn.txt)
fi
if [[ -f /tmp/lynia-api-cert-arn.txt ]]; then
  API_CERT_ARN=$(cat /tmp/lynia-api-cert-arn.txt)
fi

if [[ -n "$WILDCARD_CERT_ARN" ]]; then
  validation=$(aws acm describe-certificate \
    --region us-east-1 \
    --certificate-arn "$WILDCARD_CERT_ARN" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
    --output json 2>/dev/null || echo '{}')
  export ACM_VALIDATION_NAME=$(echo "$validation" | jq -r '.Name // empty')
  export ACM_VALIDATION_VALUE=$(echo "$validation" | jq -r '.Value // empty')
fi

if [[ -n "$API_CERT_ARN" ]]; then
  api_validation=$(aws acm describe-certificate \
    --region us-east-1 \
    --certificate-arn "$API_CERT_ARN" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
    --output json 2>/dev/null || echo '{}')
  export ACM_API_VALIDATION_NAME=$(echo "$api_validation" | jq -r '.Name // empty')
  export ACM_API_VALIDATION_VALUE=$(echo "$api_validation" | jq -r '.Value // empty')
fi

# ============================================================
# Phase 2: Cloudflare Setup (DNS + SSL + Security)
# ============================================================
log_phase "2/5 — Configure Cloudflare"

bash "$SCRIPT_DIR/cloudflare-setup.sh" all

# ============================================================
# Phase 3: Wait for ACM Certificate Validation
# ============================================================
log_phase "3/5 — Wait for ACM Certificate Validation"

log_info "Certificates need DNS validation via the CNAMEs just added to Cloudflare."
log_info "This typically takes 5-30 minutes..."

MAX_WAIT=1800  # 30 minutes
WAIT_INTERVAL=30
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  WILDCARD_STATUS="PENDING"
  API_STATUS="PENDING"

  if [[ -n "$WILDCARD_CERT_ARN" ]]; then
    WILDCARD_STATUS=$(aws acm describe-certificate \
      --region us-east-1 \
      --certificate-arn "$WILDCARD_CERT_ARN" \
      --query "Certificate.Status" \
      --output text 2>/dev/null || echo "PENDING_VALIDATION")
  fi

  if [[ -n "$API_CERT_ARN" ]]; then
    API_STATUS=$(aws acm describe-certificate \
      --region us-east-1 \
      --certificate-arn "$API_CERT_ARN" \
      --query "Certificate.Status" \
      --output text 2>/dev/null || echo "PENDING_VALIDATION")
  fi

  if [[ "$WILDCARD_STATUS" == "ISSUED" && "$API_STATUS" == "ISSUED" ]]; then
    log_ok "Both certificates are ISSUED"
    break
  fi

  log_info "Wildcard: $WILDCARD_STATUS | API: $API_STATUS (waited ${ELAPSED}s / ${MAX_WAIT}s)"
  sleep $WAIT_INTERVAL
  ELAPSED=$((ELAPSED + WAIT_INTERVAL))
done

if [[ "$WILDCARD_STATUS" != "ISSUED" || "$API_STATUS" != "ISSUED" ]]; then
  log_warn "Certificates not yet validated after ${MAX_WAIT}s."
  log_warn "They may still be propagating. You can continue later with:"
  echo "  bash $SCRIPT_DIR/aws-domain-setup.sh cert-status"
  echo "  bash $SCRIPT_DIR/aws-domain-setup.sh cloudfront"
  echo "  bash $SCRIPT_DIR/aws-domain-setup.sh apigateway"
  if ! confirm "Continue anyway? (CloudFront/API Gateway steps may fail)"; then
    echo "Run the remaining steps manually once certificates are issued."
    exit 0
  fi
fi

# ============================================================
# Phase 4: AWS CloudFront + API Gateway
# ============================================================
log_phase "4/5 — Update CloudFront & API Gateway"

log_info "Updating CloudFront distributions..."
bash "$SCRIPT_DIR/aws-domain-setup.sh" cloudfront || log_warn "CloudFront update had issues — may need manual intervention"

echo ""
log_info "Configuring API Gateway custom domain..."
bash "$SCRIPT_DIR/aws-domain-setup.sh" apigateway || log_warn "API Gateway setup had issues — may need manual intervention"

# Get AWS outputs for Cloudflare DNS
echo ""
log_info "Fetching AWS domain targets..."
bash "$SCRIPT_DIR/aws-domain-setup.sh" outputs

# ============================================================
# Phase 5: Verification
# ============================================================
log_phase "5/5 — Verification"

log_info "Running Cloudflare verification..."
bash "$SCRIPT_DIR/cloudflare-setup.sh" verify

echo ""
log_info "DNS resolution check..."
for sub in admin distributor api; do
  result=$(dig +short "${sub}.lyniafinance.com" CNAME 2>/dev/null || echo "NOT RESOLVED")
  if [[ -n "$result" && "$result" != "NOT RESOLVED" ]]; then
    log_ok "${sub}.lyniafinance.com → $result"
  else
    log_warn "${sub}.lyniafinance.com — not resolving yet (DNS propagation may take up to 48h)"
  fi
done

echo ""
log_info "HTTPS connectivity check..."
for url in "https://admin.lyniafinance.com" "https://distributor.lyniafinance.com" "https://api.lyniafinance.com/health"; do
  status=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [[ "$status" == "200" || "$status" == "301" || "$status" == "302" ]]; then
    log_ok "$url — HTTP $status"
  else
    log_warn "$url — HTTP $status (may need DNS propagation time)"
  fi
done

# ============================================================
# Summary
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Domain Setup Complete                                 ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                         ║"
echo "║   Admin Portal:     https://admin.lyniafinance.com      ║"
echo "║   Distributor:      https://distributor.lyniafinance.com ║"
echo "║   API:              https://api.lyniafinance.com         ║"
echo "║   Root:             https://lyniafinance.com             ║"
echo "║                                                         ║"
echo "║   Next Steps:                                           ║"
echo "║   1. Wait for full DNS propagation (up to 48h)          ║"
echo "║   2. Update webhook URLs in external services           ║"
echo "║   3. Update Supabase Auth redirect URLs                 ║"
echo "║   4. Test SSL at ssllabs.com/ssltest (target: A+)       ║"
echo "║   5. Run full verification checklist                    ║"
echo "║                                                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
