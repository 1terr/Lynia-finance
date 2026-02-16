#!/usr/bin/env bash
# ============================================================
# ACM Certificate Request Script for Fineract ALB
# Item 3 from Phase 8 deferred items
#
# Requests an ACM certificate for the Fineract ALB endpoint
# and outputs the validation records needed for DNS verification.
# ============================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
DOMAIN="${2:-fineract.lynia.finance}"
REGION="${AWS_REGION:-us-east-1}"

# Environment-specific subdomain
if [ "${ENVIRONMENT}" != "production" ]; then
  DOMAIN="${ENVIRONMENT}-${DOMAIN}"
fi

echo "=== ACM Certificate Request ==="
echo "Environment: ${ENVIRONMENT}"
echo "Domain:      ${DOMAIN}"
echo "Region:      ${REGION}"
echo ""

echo "[1/4] Checking for existing certificates..."
EXISTING=$(aws acm list-certificates \
  --region "${REGION}" \
  --query "CertificateSummaryList[?DomainName=='${DOMAIN}'].CertificateArn" \
  --output text 2>/dev/null || echo "")

if [ -n "${EXISTING}" ] && [ "${EXISTING}" != "None" ]; then
  echo "Certificate already exists: ${EXISTING}"
  echo ""
  STATUS=$(aws acm describe-certificate \
    --certificate-arn "${EXISTING}" \
    --region "${REGION}" \
    --query "Certificate.Status" \
    --output text)
  echo "Status: ${STATUS}"

  if [ "${STATUS}" = "ISSUED" ]; then
    echo "Certificate is already issued and valid."
    echo "ARN: ${EXISTING}"
    exit 0
  elif [ "${STATUS}" = "PENDING_VALIDATION" ]; then
    echo "Certificate is pending validation. Showing DNS records..."
    aws acm describe-certificate \
      --certificate-arn "${EXISTING}" \
      --region "${REGION}" \
      --query "Certificate.DomainValidationOptions[*].ResourceRecord" \
      --output table
    exit 0
  fi
fi

echo "[2/4] Requesting new ACM certificate..."
CERT_ARN=$(aws acm request-certificate \
  --domain-name "${DOMAIN}" \
  --validation-method DNS \
  --region "${REGION}" \
  --tags "Key=Environment,Value=${ENVIRONMENT}" "Key=Service,Value=fineract" \
  --query "CertificateArn" \
  --output text)

echo "Certificate ARN: ${CERT_ARN}"

echo "[3/4] Waiting for DNS validation records..."
sleep 5

VALIDATION=$(aws acm describe-certificate \
  --certificate-arn "${CERT_ARN}" \
  --region "${REGION}" \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
  --output json)

echo ""
echo "=== DNS VALIDATION RECORD ==="
echo "Add this CNAME record to your DNS provider:"
echo ""
echo "${VALIDATION}" | python3 -c "
import sys, json
r = json.load(sys.stdin)
print(f\"  Type:  CNAME\")
print(f\"  Name:  {r['Name']}\")
print(f\"  Value: {r['Value']}\")
" 2>/dev/null || echo "${VALIDATION}"

echo ""
echo "[4/4] To attach to Fineract ALB after validation:"
echo ""
echo "  # Get the ALB ARN"
echo "  ALB_ARN=\$(aws elbv2 describe-load-balancers --names ${ENVIRONMENT}-fineract-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
echo ""
echo "  # Get HTTPS listener ARN"
echo "  LISTENER_ARN=\$(aws elbv2 describe-listeners --load-balancer-arn \$ALB_ARN --query 'Listeners[?Port==\`443\`].ListenerArn' --output text)"
echo ""
echo "  # Update listener with certificate"
echo "  aws elbv2 modify-listener --listener-arn \$LISTENER_ARN --certificates CertificateArn=${CERT_ARN}"
echo ""
echo "Certificate will auto-validate once DNS record is created."
echo "Check status: aws acm describe-certificate --certificate-arn ${CERT_ARN} --query Certificate.Status"