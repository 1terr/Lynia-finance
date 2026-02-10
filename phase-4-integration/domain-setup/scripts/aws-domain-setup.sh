#!/usr/bin/env bash
# =============================================================================
# AWS Domain Integration for lyniafinance.com
# =============================================================================
# Provisions ACM certificates, configures CloudFront custom domains, and
# sets up API Gateway custom domain mapping.
#
# Prerequisites:
#   - AWS CLI v2 configured with production credentials
#   - jq installed
#   - Existing CloudFront distributions (from SAM/CloudFormation deployment)
#   - Existing API Gateway REST API (from SAM deployment)
#
# Usage:
#   bash aws-domain-setup.sh [command]
#
# Commands:
#   all                  Run all setup steps
#   certificates         Request ACM certificates
#   cert-status          Check certificate validation status
#   cloudfront           Update CloudFront distributions
#   apigateway           Configure API Gateway custom domain
#   outputs              Print all domain targets for Cloudflare DNS
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DOMAIN="lyniafinance.com"
AWS_REGION="us-east-1"
ENVIRONMENT="${ENVIRONMENT:-production}"
SAM_STACK_NAME="${SAM_STACK_NAME:-lynia-finance-prod}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_deps() {
  for cmd in aws jq; do
    if ! command -v "$cmd" &> /dev/null; then
      log_error "$cmd is required but not installed."
      exit 1
    fi
  done

  # Verify AWS credentials
  if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS CLI not configured. Run 'aws configure' first."
    exit 1
  fi
  local account_id
  account_id=$(aws sts get-caller-identity --query "Account" --output text)
  log_ok "AWS Account: $account_id"
}

# ---------------------------------------------------------------------------
# ACM Certificates
# ---------------------------------------------------------------------------
request_certificates() {
  log_info "=========================================="
  log_info "Step 1: Requesting ACM Certificates"
  log_info "=========================================="

  # Wildcard certificate (for CloudFront — must be in us-east-1)
  log_info "Requesting wildcard certificate for *.$DOMAIN"
  local wildcard_arn
  wildcard_arn=$(aws acm request-certificate \
    --region "$AWS_REGION" \
    --domain-name "$DOMAIN" \
    --subject-alternative-names "*.$DOMAIN" \
    --validation-method DNS \
    --tags Key=Environment,Value="$ENVIRONMENT" Key=Purpose,Value=frontend Key=ManagedBy,Value=domain-setup-script \
    --query "CertificateArn" \
    --output text)
  log_ok "Wildcard certificate requested: $wildcard_arn"

  # API certificate (regional, for API Gateway)
  log_info "Requesting API certificate for api.$DOMAIN"
  local api_arn
  api_arn=$(aws acm request-certificate \
    --region "$AWS_REGION" \
    --domain-name "api.$DOMAIN" \
    --validation-method DNS \
    --tags Key=Environment,Value="$ENVIRONMENT" Key=Purpose,Value=api-gateway Key=ManagedBy,Value=domain-setup-script \
    --query "CertificateArn" \
    --output text)
  log_ok "API certificate requested: $api_arn"

  # Wait a moment for AWS to generate validation records
  log_info "Waiting 10 seconds for validation records to generate..."
  sleep 10

  # Get validation CNAME records
  echo ""
  log_info "============================================================"
  log_info "ACM DNS Validation Records"
  log_info "Add these CNAME records to Cloudflare (DNS only / grey cloud)"
  log_info "============================================================"
  echo ""

  log_info "Wildcard certificate ($wildcard_arn):"
  aws acm describe-certificate \
    --region "$AWS_REGION" \
    --certificate-arn "$wildcard_arn" \
    --query "Certificate.DomainValidationOptions[].ResourceRecord" \
    --output json | jq -r '.[] | "  CNAME: \(.Name) → \(.Value)"'

  echo ""
  log_info "API certificate ($api_arn):"
  aws acm describe-certificate \
    --region "$AWS_REGION" \
    --certificate-arn "$api_arn" \
    --query "Certificate.DomainValidationOptions[].ResourceRecord" \
    --output json | jq -r '.[] | "  CNAME: \(.Name) → \(.Value)"'

  echo ""
  log_warn "After adding these CNAMEs to Cloudflare, run:"
  echo "  $0 cert-status"
  echo ""

  # Save ARNs for later use
  echo "$wildcard_arn" > /tmp/lynia-wildcard-cert-arn.txt
  echo "$api_arn" > /tmp/lynia-api-cert-arn.txt
  log_info "Certificate ARNs saved to /tmp/lynia-*-cert-arn.txt"

  # Output for Cloudflare script
  echo ""
  log_info "============================================================"
  log_info "For cloudflare-setup.sh, export these after adding CNAMEs:"
  log_info "============================================================"

  local wildcard_validation
  wildcard_validation=$(aws acm describe-certificate \
    --region "$AWS_REGION" \
    --certificate-arn "$wildcard_arn" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
    --output json)
  local wv_name wv_value
  wv_name=$(echo "$wildcard_validation" | jq -r '.Name')
  wv_value=$(echo "$wildcard_validation" | jq -r '.Value')

  local api_validation
  api_validation=$(aws acm describe-certificate \
    --region "$AWS_REGION" \
    --certificate-arn "$api_arn" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
    --output json)
  local av_name av_value
  av_name=$(echo "$api_validation" | jq -r '.Name')
  av_value=$(echo "$api_validation" | jq -r '.Value')

  echo ""
  echo "export ACM_VALIDATION_NAME=\"$wv_name\""
  echo "export ACM_VALIDATION_VALUE=\"$wv_value\""
  echo "export ACM_API_VALIDATION_NAME=\"$av_name\""
  echo "export ACM_API_VALIDATION_VALUE=\"$av_value\""
}

check_cert_status() {
  log_info "=========================================="
  log_info "Checking Certificate Validation Status"
  log_info "=========================================="

  # Find certificates tagged with our script
  local certs
  certs=$(aws acm list-certificates \
    --region "$AWS_REGION" \
    --query "CertificateSummaryList[?contains(DomainName, '$DOMAIN')]" \
    --output json)

  echo "$certs" | jq -r '.[] | "\(.DomainName)\t\(.CertificateArn)\t\(.Status // "UNKNOWN")"' | while read -r line; do
    local domain arn status
    domain=$(echo "$line" | cut -f1)
    arn=$(echo "$line" | cut -f2)
    status=$(echo "$line" | cut -f3)

    # Get detailed status
    local detail_status
    detail_status=$(aws acm describe-certificate \
      --region "$AWS_REGION" \
      --certificate-arn "$arn" \
      --query "Certificate.Status" \
      --output text)

    if [[ "$detail_status" == "ISSUED" ]]; then
      log_ok "$domain — ISSUED ($arn)"
    elif [[ "$detail_status" == "PENDING_VALIDATION" ]]; then
      log_warn "$domain — PENDING VALIDATION ($arn)"
      log_warn "  Ensure DNS validation CNAMEs are in Cloudflare (grey cloud)"
    else
      log_info "$domain — $detail_status ($arn)"
    fi
  done
}

# ---------------------------------------------------------------------------
# CloudFront Updates
# ---------------------------------------------------------------------------
update_cloudfront() {
  log_info "=========================================="
  log_info "Step 2: Updating CloudFront Distributions"
  log_info "=========================================="

  # Get wildcard cert ARN
  local cert_arn
  if [[ -f /tmp/lynia-wildcard-cert-arn.txt ]]; then
    cert_arn=$(cat /tmp/lynia-wildcard-cert-arn.txt)
  else
    log_info "Looking up wildcard certificate ARN..."
    cert_arn=$(aws acm list-certificates \
      --region "$AWS_REGION" \
      --query "CertificateSummaryList[?DomainName=='$DOMAIN' && Status=='ISSUED'].CertificateArn | [0]" \
      --output text)
  fi

  if [[ -z "$cert_arn" || "$cert_arn" == "None" ]]; then
    log_error "No issued certificate found for $DOMAIN"
    log_error "Run '$0 certificates' first, add CNAMEs to Cloudflare, then wait for validation."
    exit 1
  fi
  log_ok "Using certificate: $cert_arn"

  # Find CloudFront distributions from CloudFormation stack
  local admin_dist_id distributor_dist_id

  # Try to get from CloudFormation outputs
  log_info "Looking up CloudFront distribution IDs from CloudFormation..."
  admin_dist_id=$(aws cloudformation describe-stacks \
    --stack-name "$SAM_STACK_NAME" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'AdminPortalDistribution')].OutputValue | [0]" \
    --output text 2>/dev/null || echo "")

  distributor_dist_id=$(aws cloudformation describe-stacks \
    --stack-name "$SAM_STACK_NAME" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'DistributorDashboardDistribution')].OutputValue | [0]" \
    --output text 2>/dev/null || echo "")

  # Fallback: search by tag
  if [[ -z "$admin_dist_id" || "$admin_dist_id" == "None" ]]; then
    log_info "Searching for admin portal distribution by comment..."
    admin_dist_id=$(aws cloudfront list-distributions \
      --query "DistributionList.Items[?contains(Comment,'Admin Portal')].Id | [0]" \
      --output text 2>/dev/null || echo "")
  fi

  if [[ -z "$distributor_dist_id" || "$distributor_dist_id" == "None" ]]; then
    log_info "Searching for distributor distribution by comment..."
    distributor_dist_id=$(aws cloudfront list-distributions \
      --query "DistributionList.Items[?contains(Comment,'Distributor')].Id | [0]" \
      --output text 2>/dev/null || echo "")
  fi

  # Update Admin Portal distribution
  if [[ -n "$admin_dist_id" && "$admin_dist_id" != "None" ]]; then
    update_single_distribution "$admin_dist_id" "admin.$DOMAIN" "$cert_arn" "Admin Portal"
  else
    log_warn "Could not find Admin Portal CloudFront distribution"
    log_warn "  Deploy the frontend-hosting stack first, or set admin_dist_id manually"
  fi

  # Update Distributor Dashboard distribution
  if [[ -n "$distributor_dist_id" && "$distributor_dist_id" != "None" ]]; then
    update_single_distribution "$distributor_dist_id" "distributor.$DOMAIN" "$cert_arn" "Distributor Dashboard"
  else
    log_warn "Could not find Distributor Dashboard CloudFront distribution"
  fi
}

update_single_distribution() {
  local dist_id="$1"
  local alias_domain="$2"
  local cert_arn="$3"
  local name="$4"

  log_info "Updating $name distribution ($dist_id)..."

  # Get current config with ETag
  local config_json
  config_json=$(aws cloudfront get-distribution-config --id "$dist_id" --output json)

  local etag
  etag=$(echo "$config_json" | jq -r '.ETag')

  # Modify the config: add alias and certificate
  local updated_config
  updated_config=$(echo "$config_json" | jq --arg alias "$alias_domain" --arg cert "$cert_arn" '
    .DistributionConfig |
    .Aliases = {"Quantity": 1, "Items": [$alias]} |
    .ViewerCertificate = {
      "ACMCertificateArn": $cert,
      "SSLSupportMethod": "sni-only",
      "MinimumProtocolVersion": "TLSv1.2_2021",
      "Certificate": $cert,
      "CertificateSource": "acm"
    }
  ')

  # Apply update
  echo "$updated_config" > /tmp/lynia-cf-update.json
  aws cloudfront update-distribution \
    --id "$dist_id" \
    --if-match "$etag" \
    --distribution-config "file:///tmp/lynia-cf-update.json" \
    --output text --query "Distribution.Id" > /dev/null

  log_ok "$name: alias=$alias_domain, cert attached, TLS 1.2+"

  # Get the distribution domain name for Cloudflare
  local cf_domain
  cf_domain=$(aws cloudfront get-distribution \
    --id "$dist_id" \
    --query "Distribution.DomainName" \
    --output text)
  log_info "  CloudFront domain: $cf_domain"
  log_info "  → Add CNAME in Cloudflare: $alias_domain → $cf_domain (DNS only)"
}

# ---------------------------------------------------------------------------
# API Gateway Custom Domain
# ---------------------------------------------------------------------------
setup_apigateway() {
  log_info "=========================================="
  log_info "Step 3: Configuring API Gateway Custom Domain"
  log_info "=========================================="

  # Get API cert ARN
  local api_cert_arn
  if [[ -f /tmp/lynia-api-cert-arn.txt ]]; then
    api_cert_arn=$(cat /tmp/lynia-api-cert-arn.txt)
  else
    log_info "Looking up API certificate ARN..."
    api_cert_arn=$(aws acm list-certificates \
      --region "$AWS_REGION" \
      --query "CertificateSummaryList[?DomainName=='api.$DOMAIN' && Status=='ISSUED'].CertificateArn | [0]" \
      --output text)
  fi

  if [[ -z "$api_cert_arn" || "$api_cert_arn" == "None" ]]; then
    log_error "No issued certificate found for api.$DOMAIN"
    exit 1
  fi
  log_ok "Using API certificate: $api_cert_arn"

  # Check if custom domain already exists
  local existing
  existing=$(aws apigateway get-domain-name \
    --domain-name "api.$DOMAIN" 2>/dev/null || echo "")

  if [[ -n "$existing" ]]; then
    log_warn "Custom domain api.$DOMAIN already exists"
    local target
    target=$(echo "$existing" | jq -r '.regionalDomainName // .distributionDomainName // "unknown"')
    log_info "  Target: $target"
  else
    # Create custom domain
    log_info "Creating API Gateway custom domain: api.$DOMAIN"
    local result
    result=$(aws apigateway create-domain-name \
      --domain-name "api.$DOMAIN" \
      --regional-certificate-arn "$api_cert_arn" \
      --endpoint-configuration types=REGIONAL \
      --security-policy TLS_1_2 \
      --tags Environment="$ENVIRONMENT" \
      --output json)

    local regional_domain
    regional_domain=$(echo "$result" | jq -r '.regionalDomainName')
    log_ok "Custom domain created"
    log_info "  Regional domain: $regional_domain"
    log_info "  → Add CNAME in Cloudflare: api.$DOMAIN → $regional_domain (DNS only)"
  fi

  # Find the REST API
  log_info "Looking up REST API..."
  local rest_api_id
  rest_api_id=$(aws apigateway get-rest-apis \
    --query "items[?contains(name,'lynia')].id | [0]" \
    --output text)

  if [[ -z "$rest_api_id" || "$rest_api_id" == "None" ]]; then
    log_warn "No REST API found matching 'lynia'. Checking SAM stack..."
    rest_api_id=$(aws cloudformation describe-stack-resource \
      --stack-name "$SAM_STACK_NAME" \
      --logical-resource-id "ServerlessRestApi" \
      --query "StackResourceDetail.PhysicalResourceId" \
      --output text 2>/dev/null || echo "")
  fi

  if [[ -n "$rest_api_id" && "$rest_api_id" != "None" ]]; then
    log_ok "REST API found: $rest_api_id"

    # Create base path mapping
    log_info "Creating base path mapping..."
    aws apigateway create-base-path-mapping \
      --domain-name "api.$DOMAIN" \
      --rest-api-id "$rest_api_id" \
      --stage "Prod" 2>/dev/null || log_warn "Base path mapping may already exist"
    log_ok "Base path mapping: api.$DOMAIN → $rest_api_id (stage: Prod)"
  else
    log_warn "Could not find REST API. Create base path mapping manually:"
    echo "  aws apigateway create-base-path-mapping \\"
    echo "    --domain-name api.$DOMAIN \\"
    echo "    --rest-api-id <YOUR_API_ID> \\"
    echo "    --stage Prod"
  fi
}

# ---------------------------------------------------------------------------
# Print Outputs (for Cloudflare DNS)
# ---------------------------------------------------------------------------
print_outputs() {
  log_info "=========================================="
  log_info "Domain Targets for Cloudflare DNS"
  log_info "=========================================="
  echo ""

  # CloudFront distributions
  log_info "CloudFront Distributions:"
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Comment,'ynia')].[Comment, DomainName, Id]" \
    --output text 2>/dev/null | while read -r comment domain id; do
    echo "  $comment"
    echo "    CloudFront: $domain"
    echo "    ID: $id"
    echo ""
  done

  # API Gateway custom domain
  log_info "API Gateway Custom Domain:"
  local api_domain
  api_domain=$(aws apigateway get-domain-name \
    --domain-name "api.$DOMAIN" \
    --query "regionalDomainName" \
    --output text 2>/dev/null || echo "Not configured yet")
  echo "  api.$DOMAIN → $api_domain"
  echo ""

  # Certificates
  log_info "ACM Certificates:"
  aws acm list-certificates \
    --region "$AWS_REGION" \
    --query "CertificateSummaryList[?contains(DomainName, '$DOMAIN')].[DomainName, Status, CertificateArn]" \
    --output text 2>/dev/null | while read -r domain status arn; do
    echo "  $domain — $status"
    echo "    ARN: $arn"
  done

  echo ""
  log_info "============================================================"
  log_info "Cloudflare DNS Records to Create:"
  log_info "============================================================"
  echo ""
  echo "  Type   | Name         | Target                              | Proxy"
  echo "  -------|--------------|-------------------------------------|------"

  # Get admin CF domain
  local admin_cf
  admin_cf=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Comment,'Admin')].DomainName | [0]" \
    --output text 2>/dev/null || echo "<admin-cloudfront-domain>")
  echo "  CNAME  | admin        | $admin_cf | DNS only"

  # Get distributor CF domain
  local dist_cf
  dist_cf=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Comment,'Distributor')].DomainName | [0]" \
    --output text 2>/dev/null || echo "<distributor-cloudfront-domain>")
  echo "  CNAME  | distributor  | $dist_cf | DNS only"

  # API
  local api_target
  api_target=$(aws apigateway get-domain-name \
    --domain-name "api.$DOMAIN" \
    --query "regionalDomainName" \
    --output text 2>/dev/null || echo "<api-gateway-domain>")
  echo "  CNAME  | api          | $api_target | DNS only"

  echo ""
  log_info "Export these for cloudflare-setup.sh:"
  echo "  export ADMIN_CLOUDFRONT_DOMAIN=\"$admin_cf\""
  echo "  export DISTRIBUTOR_CLOUDFRONT_DOMAIN=\"$dist_cf\""
  echo "  export API_GATEWAY_DOMAIN=\"$api_target\""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local command="${1:-all}"

  check_deps

  echo ""
  echo "========================================================"
  echo "  Lynia Finance — AWS Domain Integration"
  echo "  Domain: $DOMAIN"
  echo "  Region: $AWS_REGION"
  echo "  Environment: $ENVIRONMENT"
  echo "========================================================"
  echo ""

  case "$command" in
    certificates|certs)
      request_certificates
      ;;
    cert-status|status)
      check_cert_status
      ;;
    cloudfront|cf)
      update_cloudfront
      ;;
    apigateway|apigw)
      setup_apigateway
      ;;
    outputs)
      print_outputs
      ;;
    all)
      request_certificates
      echo ""
      log_warn "============================================================"
      log_warn "PAUSE: Add the ACM validation CNAMEs to Cloudflare now."
      log_warn "Then run: $0 cert-status"
      log_warn "Once certificates show ISSUED, run: $0 cloudfront"
      log_warn "============================================================"
      ;;
    *)
      echo "Usage: $0 [all|certificates|cert-status|cloudfront|apigateway|outputs]"
      exit 1
      ;;
  esac
}

main "$@"
