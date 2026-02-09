#!/bin/bash
# Lynia Finance - k6 Load Test Runner
#
# Usage:
#   ./run-k6-tests.sh <environment> [profile] [service]
#
# Arguments:
#   environment  - development|staging|production (required)
#   profile      - normal|peak|stress|spike (default: normal)
#   service      - scoring|payment|whatsapp|kyc|lock|notification|full (default: full)
#
# Examples:
#   ./run-k6-tests.sh staging                      # Full system, normal load
#   ./run-k6-tests.sh staging peak scoring          # Scoring service, peak load
#   ./run-k6-tests.sh staging stress full            # Full system, stress test

set -euo pipefail

ENVIRONMENT=${1:-staging}
LOAD_PROFILE=${2:-normal}
SERVICE=${3:-full}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_DIR="${SCRIPT_DIR}/reports"

# API URLs per environment
case $ENVIRONMENT in
  staging)
    API_URL="https://staging-api.lyniafinance.co.zw"
    ;;
  production)
    API_URL="https://api.lyniafinance.co.zw"
    ;;
  development)
    API_URL="https://development-api.lyniafinance.co.zw"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    echo "Usage: $0 <development|staging|production> [normal|peak|stress|spike] [scoring|payment|whatsapp|kyc|lock|notification|full]"
    exit 1
    ;;
esac

# Map service to script file
case $SERVICE in
  scoring)    SCRIPT="scoring-service.k6.js" ;;
  payment)    SCRIPT="payment-service.k6.js" ;;
  whatsapp)   SCRIPT="whatsapp-webhook.k6.js" ;;
  kyc)        SCRIPT="kyc-service.k6.js" ;;
  lock)       SCRIPT="lock-service.k6.js" ;;
  notification) SCRIPT="notification-service.k6.js" ;;
  full)       SCRIPT="full-system.k6.js" ;;
  *)
    echo "Unknown service: $SERVICE"
    exit 1
    ;;
esac

echo "============================================"
echo " Lynia Finance - k6 Load Test"
echo " Environment:  $ENVIRONMENT"
echo " Load Profile: $LOAD_PROFILE"
echo " Service:      $SERVICE"
echo " API URL:      $API_URL"
echo " Timestamp:    $TIMESTAMP"
echo "============================================"

# Check k6 is installed
if ! command -v k6 &> /dev/null; then
  echo ""
  echo "k6 is not installed. Install with:"
  echo "  brew install k6          # macOS"
  echo "  snap install k6          # Linux"
  echo "  choco install k6         # Windows"
  echo ""
  echo "Or download from: https://k6.io/docs/get-started/installation/"
  exit 1
fi

# Create reports directory
mkdir -p "$REPORT_DIR"

echo ""
echo "Starting k6 load test..."
echo ""

# Run the load test
k6 run \
  --env API_URL="$API_URL" \
  --env LOAD_PROFILE="$LOAD_PROFILE" \
  --out json="${REPORT_DIR}/k6-${SERVICE}-${LOAD_PROFILE}-${TIMESTAMP}.json" \
  --summary-trend-stats="min,avg,med,max,p(50),p(90),p(95),p(99)" \
  "${SCRIPT_DIR}/${SCRIPT}" \
  2>&1 | tee "${REPORT_DIR}/k6-${SERVICE}-${LOAD_PROFILE}-${TIMESTAMP}.log"

echo ""
echo "============================================"
echo " Load test complete!"
echo " JSON:  ${REPORT_DIR}/k6-${SERVICE}-${LOAD_PROFILE}-${TIMESTAMP}.json"
echo " Log:   ${REPORT_DIR}/k6-${SERVICE}-${LOAD_PROFILE}-${TIMESTAMP}.log"
echo "============================================"
