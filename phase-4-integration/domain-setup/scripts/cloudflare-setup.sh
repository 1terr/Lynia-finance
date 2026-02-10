#!/usr/bin/env bash
# =============================================================================
# Cloudflare DNS & Security Setup for lyniafinance.com
# =============================================================================
# This script uses the Cloudflare API to configure DNS records, SSL/TLS
# settings, security rules, and health checks for the Lynia Finance domain.
#
# Prerequisites:
#   - Cloudflare API Token with Zone:Edit, DNS:Edit, Firewall:Edit permissions
#   - Zone ID for lyniafinance.com (found in Cloudflare Dashboard → Overview)
#   - jq installed (for JSON parsing)
#   - curl installed
#
# Usage:
#   export CF_API_TOKEN="your-cloudflare-api-token"
#   export CF_ZONE_ID="your-zone-id"
#   bash cloudflare-setup.sh [command]
#
# Commands:
#   all              Run all setup steps
#   dns              Configure DNS records only
#   ssl              Configure SSL/TLS settings only
#   security         Configure firewall and rate limiting only
#   health-checks    Configure health checks only
#   verify           Verify current configuration
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DOMAIN="lyniafinance.com"
CF_API="https://api.cloudflare.com/client/v4"

# These will be provided as env vars or args when running
CF_API_TOKEN="${CF_API_TOKEN:-}"
CF_ZONE_ID="${CF_ZONE_ID:-}"

# AWS targets — fill these in after deploying AWS infrastructure
ADMIN_CLOUDFRONT_DOMAIN="${ADMIN_CLOUDFRONT_DOMAIN:-}"
DISTRIBUTOR_CLOUDFRONT_DOMAIN="${DISTRIBUTOR_CLOUDFRONT_DOMAIN:-}"
API_GATEWAY_DOMAIN="${API_GATEWAY_DOMAIN:-}"

# ACM validation CNAMEs (provided by AWS after certificate request)
ACM_VALIDATION_NAME="${ACM_VALIDATION_NAME:-}"
ACM_VALIDATION_VALUE="${ACM_VALIDATION_VALUE:-}"
ACM_API_VALIDATION_NAME="${ACM_API_VALIDATION_NAME:-}"
ACM_API_VALIDATION_VALUE="${ACM_API_VALIDATION_VALUE:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_deps() {
  for cmd in curl jq; do
    if ! command -v "$cmd" &> /dev/null; then
      log_error "$cmd is required but not installed."
      exit 1
    fi
  done
}

check_env() {
  if [[ -z "$CF_API_TOKEN" ]]; then
    log_error "CF_API_TOKEN is not set. Export it before running this script."
    echo "  export CF_API_TOKEN=\"your-cloudflare-api-token\""
    exit 1
  fi
  if [[ -z "$CF_ZONE_ID" ]]; then
    log_error "CF_ZONE_ID is not set. Export it before running this script."
    echo "  export CF_ZONE_ID=\"your-zone-id\""
    echo "  (Find it in Cloudflare Dashboard → Overview → right sidebar)"
    exit 1
  fi
}

cf_api() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  local args=(-s -X "$method"
    -H "Authorization: Bearer $CF_API_TOKEN"
    -H "Content-Type: application/json"
    "${CF_API}${endpoint}")

  if [[ -n "$data" ]]; then
    args+=(-d "$data")
  fi

  local response
  response=$(curl "${args[@]}")

  local success
  success=$(echo "$response" | jq -r '.success')
  if [[ "$success" != "true" ]]; then
    local errors
    errors=$(echo "$response" | jq -r '.errors[]?.message // "Unknown error"')
    log_error "API call failed: $method $endpoint"
    log_error "Errors: $errors"
    return 1
  fi

  echo "$response"
}

# ---------------------------------------------------------------------------
# DNS Records
# ---------------------------------------------------------------------------
create_or_update_dns() {
  local type="$1"
  local name="$2"
  local content="$3"
  local proxied="${4:-false}"
  local ttl="${5:-1}"  # 1 = auto

  log_info "Setting DNS: $type $name → $content (proxied=$proxied)"

  # Check if record exists
  local existing
  existing=$(cf_api GET "/zones/$CF_ZONE_ID/dns_records?type=$type&name=${name}.${DOMAIN}" 2>/dev/null || echo '{"result":[]}')

  # Handle root domain (name = @)
  local full_name
  if [[ "$name" == "@" ]]; then
    full_name="$DOMAIN"
    existing=$(cf_api GET "/zones/$CF_ZONE_ID/dns_records?type=$type&name=$DOMAIN" 2>/dev/null || echo '{"result":[]}')
  else
    full_name="${name}.${DOMAIN}"
  fi

  local record_id
  record_id=$(echo "$existing" | jq -r '.result[0]?.id // empty')

  local payload
  payload=$(jq -n \
    --arg type "$type" \
    --arg name "$full_name" \
    --arg content "$content" \
    --argjson proxied "$proxied" \
    --argjson ttl "$ttl" \
    '{type: $type, name: $name, content: $content, proxied: $proxied, ttl: $ttl}')

  if [[ -n "$record_id" ]]; then
    cf_api PUT "/zones/$CF_ZONE_ID/dns_records/$record_id" "$payload" > /dev/null
    log_ok "Updated existing $type record for $full_name"
  else
    cf_api POST "/zones/$CF_ZONE_ID/dns_records" "$payload" > /dev/null
    log_ok "Created $type record for $full_name"
  fi
}

setup_dns() {
  log_info "=========================================="
  log_info "Step 1: Configuring DNS Records"
  log_info "=========================================="

  # Admin Portal → CloudFront (DNS only for no double-CDN)
  if [[ -n "$ADMIN_CLOUDFRONT_DOMAIN" ]]; then
    create_or_update_dns "CNAME" "admin" "$ADMIN_CLOUDFRONT_DOMAIN" "false"
  else
    log_warn "ADMIN_CLOUDFRONT_DOMAIN not set — skipping admin DNS record"
    log_warn "  Set it after deploying CloudFront: export ADMIN_CLOUDFRONT_DOMAIN=d1234.cloudfront.net"
  fi

  # Distributor Dashboard → CloudFront (DNS only)
  if [[ -n "$DISTRIBUTOR_CLOUDFRONT_DOMAIN" ]]; then
    create_or_update_dns "CNAME" "distributor" "$DISTRIBUTOR_CLOUDFRONT_DOMAIN" "false"
  else
    log_warn "DISTRIBUTOR_CLOUDFRONT_DOMAIN not set — skipping distributor DNS record"
  fi

  # API Gateway (DNS only — AWS WAF handles security)
  if [[ -n "$API_GATEWAY_DOMAIN" ]]; then
    create_or_update_dns "CNAME" "api" "$API_GATEWAY_DOMAIN" "false"
  else
    log_warn "API_GATEWAY_DOMAIN not set — skipping API DNS record"
  fi

  # ACM certificate validation CNAMEs
  if [[ -n "$ACM_VALIDATION_NAME" && -n "$ACM_VALIDATION_VALUE" ]]; then
    log_info "Adding ACM wildcard certificate validation CNAME"
    local acm_name="${ACM_VALIDATION_NAME%.${DOMAIN}.}"  # strip domain suffix
    acm_name="${acm_name%.${DOMAIN}}"
    create_or_update_dns "CNAME" "$acm_name" "$ACM_VALIDATION_VALUE" "false"
  else
    log_warn "ACM_VALIDATION_NAME/VALUE not set — skipping certificate validation CNAME"
    log_warn "  Run 'aws acm describe-certificate' to get the validation records"
  fi

  if [[ -n "$ACM_API_VALIDATION_NAME" && -n "$ACM_API_VALIDATION_VALUE" ]]; then
    log_info "Adding ACM API certificate validation CNAME"
    local acm_api_name="${ACM_API_VALIDATION_NAME%.${DOMAIN}.}"
    acm_api_name="${acm_api_name%.${DOMAIN}}"
    create_or_update_dns "CNAME" "$acm_api_name" "$ACM_API_VALIDATION_VALUE" "false"
  fi

  # www redirect (proxied so Cloudflare handles the redirect)
  create_or_update_dns "CNAME" "www" "$DOMAIN" "true"

  log_ok "DNS record setup complete"
}

# ---------------------------------------------------------------------------
# SSL/TLS Settings
# ---------------------------------------------------------------------------
setup_ssl() {
  log_info "=========================================="
  log_info "Step 2: Configuring SSL/TLS Settings"
  log_info "=========================================="

  # Set SSL mode to Full (Strict)
  log_info "Setting SSL mode to Full (Strict)"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/ssl" \
    '{"value":"strict"}' > /dev/null
  log_ok "SSL mode: Full (Strict)"

  # Always Use HTTPS
  log_info "Enabling Always Use HTTPS"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/always_use_https" \
    '{"value":"on"}' > /dev/null
  log_ok "Always Use HTTPS: ON"

  # Minimum TLS Version 1.2
  log_info "Setting minimum TLS version to 1.2"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/min_tls_version" \
    '{"value":"1.2"}' > /dev/null
  log_ok "Minimum TLS: 1.2"

  # TLS 1.3
  log_info "Enabling TLS 1.3"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/tls_1_3" \
    '{"value":"on"}' > /dev/null
  log_ok "TLS 1.3: ON"

  # Opportunistic Encryption
  log_info "Enabling Opportunistic Encryption"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/opportunistic_encryption" \
    '{"value":"on"}' > /dev/null
  log_ok "Opportunistic Encryption: ON"

  # Automatic HTTPS Rewrites
  log_info "Enabling Automatic HTTPS Rewrites"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/automatic_https_rewrites" \
    '{"value":"on"}' > /dev/null
  log_ok "Automatic HTTPS Rewrites: ON"

  # HSTS
  log_info "Enabling HSTS (max-age=12 months, includeSubDomains, preload)"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/security_header" \
    '{
      "value": {
        "strict_transport_security": {
          "enabled": true,
          "max_age": 31536000,
          "include_subdomains": true,
          "preload": true,
          "nosniff": true
        }
      }
    }' > /dev/null
  log_ok "HSTS: Enabled (12 months, subdomains, preload)"

  log_ok "SSL/TLS setup complete"
}

# ---------------------------------------------------------------------------
# Security Settings
# ---------------------------------------------------------------------------
setup_security() {
  log_info "=========================================="
  log_info "Step 3: Configuring Security Settings"
  log_info "=========================================="

  # Security Level
  log_info "Setting security level to Medium"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/security_level" \
    '{"value":"medium"}' > /dev/null
  log_ok "Security Level: Medium"

  # Browser Integrity Check
  log_info "Enabling Browser Integrity Check"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/browser_check" \
    '{"value":"on"}' > /dev/null
  log_ok "Browser Integrity Check: ON"

  # Challenge TTL
  log_info "Setting Challenge Passage to 30 minutes"
  cf_api PATCH "/zones/$CF_ZONE_ID/settings/challenge_ttl" \
    '{"value":1800}' > /dev/null
  log_ok "Challenge Passage: 30 minutes"

  # --- Firewall Rules (WAF Custom Rules) ---
  log_info "Creating firewall rules..."

  # Rule: Block requests without User-Agent
  log_info "Creating rule: Block empty User-Agent"
  cf_api POST "/zones/$CF_ZONE_ID/firewall/rules" \
    '[{
      "filter": {
        "expression": "(len(http.user_agent) eq 0)",
        "paused": false,
        "description": "Block requests without User-Agent"
      },
      "action": "block",
      "description": "Block empty User-Agent",
      "priority": 1
    }]' > /dev/null 2>&1 || log_warn "Rule may already exist — skipping"
  log_ok "Firewall rule: Block empty User-Agent"

  # Rule: Challenge non-African traffic on sensitive endpoints
  log_info "Creating rule: Challenge non-African sensitive requests"
  cf_api POST "/zones/$CF_ZONE_ID/firewall/rules" \
    '[{
      "filter": {
        "expression": "(not ip.geoip.country in {\"ZW\" \"ZA\" \"BW\" \"MZ\" \"MW\" \"US\" \"GB\"}) and (http.request.uri.path contains \"/kyc\" or http.request.uri.path contains \"/loans/apply\")",
        "paused": false,
        "description": "Challenge non-African traffic on sensitive endpoints"
      },
      "action": "managed_challenge",
      "description": "Geo-challenge sensitive endpoints",
      "priority": 2
    }]' > /dev/null 2>&1 || log_warn "Rule may already exist — skipping"
  log_ok "Firewall rule: Geo-challenge sensitive endpoints"

  # --- Rate Limiting Rules ---
  log_info "Creating rate limiting rules..."

  # Rate limit: Auth endpoints (20 req/min)
  cf_api POST "/zones/$CF_ZONE_ID/rate_limits" \
    '{
      "threshold": 20,
      "period": 60,
      "match": {
        "request": {
          "url_pattern": "*.lyniafinance.com/*/auth*",
          "schemes": ["HTTPS"],
          "methods": ["_ALL_"]
        }
      },
      "action": {
        "mode": "ban",
        "timeout": 600
      },
      "description": "Rate limit auth endpoints: 20 req/min"
    }' > /dev/null 2>&1 || log_warn "Rate limit may already exist — skipping"
  log_ok "Rate limit: Auth endpoints (20/min)"

  # Rate limit: General API (100 req/min)
  cf_api POST "/zones/$CF_ZONE_ID/rate_limits" \
    '{
      "threshold": 100,
      "period": 60,
      "match": {
        "request": {
          "url_pattern": "api.lyniafinance.com/*",
          "schemes": ["HTTPS"],
          "methods": ["_ALL_"]
        }
      },
      "action": {
        "mode": "ban",
        "timeout": 300
      },
      "description": "Rate limit general API: 100 req/min"
    }' > /dev/null 2>&1 || log_warn "Rate limit may already exist — skipping"
  log_ok "Rate limit: General API (100/min)"

  log_ok "Security setup complete"
}

# ---------------------------------------------------------------------------
# Page Rules
# ---------------------------------------------------------------------------
setup_page_rules() {
  log_info "=========================================="
  log_info "Step 4: Configuring Page Rules"
  log_info "=========================================="

  # Redirect www to root
  log_info "Creating page rule: www redirect"
  cf_api POST "/zones/$CF_ZONE_ID/pagerules" \
    '{
      "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "www.lyniafinance.com/*"}}],
      "actions": [{"id": "forwarding_url", "value": {"url": "https://lyniafinance.com/$1", "status_code": 301}}],
      "status": "active",
      "priority": 1
    }' > /dev/null 2>&1 || log_warn "Page rule may already exist — skipping"
  log_ok "Page rule: www → root (301)"

  # API no-cache
  log_info "Creating page rule: API bypass cache"
  cf_api POST "/zones/$CF_ZONE_ID/pagerules" \
    '{
      "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "api.lyniafinance.com/*"}}],
      "actions": [{"id": "cache_level", "value": "bypass"}],
      "status": "active",
      "priority": 2
    }' > /dev/null 2>&1 || log_warn "Page rule may already exist — skipping"
  log_ok "Page rule: API cache bypass"

  log_ok "Page rules setup complete"
}

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
verify() {
  log_info "=========================================="
  log_info "Verifying Configuration"
  log_info "=========================================="

  # Verify API token works
  log_info "Checking API token..."
  cf_api GET "/user/tokens/verify" > /dev/null
  log_ok "API token is valid"

  # Verify zone
  log_info "Checking zone..."
  local zone_info
  zone_info=$(cf_api GET "/zones/$CF_ZONE_ID")
  local zone_name
  zone_name=$(echo "$zone_info" | jq -r '.result.name')
  local zone_status
  zone_status=$(echo "$zone_info" | jq -r '.result.status')
  log_ok "Zone: $zone_name (status: $zone_status)"

  # List DNS records
  log_info "Current DNS records:"
  local records
  records=$(cf_api GET "/zones/$CF_ZONE_ID/dns_records?per_page=50")
  echo "$records" | jq -r '.result[] | "\(.type)\t\(.name)\t\(.content)\t\(if .proxied then "proxied" else "dns-only" end)"' | column -t

  # Check SSL setting
  local ssl_mode
  ssl_mode=$(cf_api GET "/zones/$CF_ZONE_ID/settings/ssl" | jq -r '.result.value')
  log_info "SSL Mode: $ssl_mode"
  if [[ "$ssl_mode" == "strict" ]]; then
    log_ok "SSL Mode is Full (Strict)"
  else
    log_warn "SSL Mode is '$ssl_mode' — should be 'strict'"
  fi

  # Check TLS version
  local min_tls
  min_tls=$(cf_api GET "/zones/$CF_ZONE_ID/settings/min_tls_version" | jq -r '.result.value')
  log_info "Minimum TLS: $min_tls"

  # Check HSTS
  local hsts
  hsts=$(cf_api GET "/zones/$CF_ZONE_ID/settings/security_header" | jq -r '.result.value.strict_transport_security.enabled')
  log_info "HSTS Enabled: $hsts"

  # Check HTTPS enforcement
  local always_https
  always_https=$(cf_api GET "/zones/$CF_ZONE_ID/settings/always_use_https" | jq -r '.result.value')
  log_info "Always Use HTTPS: $always_https"

  echo ""
  log_ok "Verification complete"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local command="${1:-all}"

  check_deps
  check_env

  echo ""
  echo "========================================================"
  echo "  Lynia Finance — Cloudflare Domain Setup"
  echo "  Domain: $DOMAIN"
  echo "  Zone ID: ${CF_ZONE_ID:0:8}..."
  echo "========================================================"
  echo ""

  case "$command" in
    dns)
      setup_dns
      ;;
    ssl)
      setup_ssl
      ;;
    security)
      setup_security
      setup_page_rules
      ;;
    health-checks)
      log_warn "Health checks require Cloudflare Pro plan."
      log_info "Configure via Dashboard → Traffic → Health Checks"
      ;;
    verify)
      verify
      ;;
    all)
      setup_dns
      echo ""
      setup_ssl
      echo ""
      setup_security
      echo ""
      setup_page_rules
      echo ""
      verify
      ;;
    *)
      echo "Usage: $0 [all|dns|ssl|security|health-checks|verify]"
      exit 1
      ;;
  esac

  echo ""
  log_ok "=========================================="
  log_ok "Cloudflare setup complete for $DOMAIN"
  log_ok "=========================================="
}

main "$@"
