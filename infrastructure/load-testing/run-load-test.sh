#!/bin/bash
# Lynia Finance - Load Test Runner
# Usage: ./run-load-test.sh <environment>
# Example: ./run-load-test.sh staging

set -euo pipefail

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_DIR="${SCRIPT_DIR}/reports"

# API URLs per environment
case $ENVIRONMENT in
  staging)
    API_URL="https://staging-api.lyniafinance.com"
    ;;
  production)
    API_URL="https://api.lyniafinance.com"
    ;;
  development)
    API_URL="https://development-api.lyniafinance.com"
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    echo "Usage: $0 <development|staging|production>"
    exit 1
    ;;
esac

echo "============================================"
echo " Lynia Finance Load Test"
echo " Environment: $ENVIRONMENT"
echo " API URL: $API_URL"
echo " Timestamp: $TIMESTAMP"
echo "============================================"

# Check Artillery is installed
if ! command -v npx &> /dev/null; then
  echo "Error: npx not found. Please install Node.js."
  exit 1
fi

# Create reports directory
mkdir -p "$REPORT_DIR"

# Run the load test
echo ""
echo "Starting load test..."
echo ""

API_URL=$API_URL npx artillery run \
  "${SCRIPT_DIR}/artillery-config.yml" \
  --output "${REPORT_DIR}/report-${ENVIRONMENT}-${TIMESTAMP}.json" \
  2>&1 | tee "${REPORT_DIR}/output-${ENVIRONMENT}-${TIMESTAMP}.log"

# Generate HTML report
echo ""
echo "Generating HTML report..."
npx artillery report \
  "${REPORT_DIR}/report-${ENVIRONMENT}-${TIMESTAMP}.json" \
  --output "${REPORT_DIR}/report-${ENVIRONMENT}-${TIMESTAMP}.html"

echo ""
echo "============================================"
echo " Load test complete!"
echo " JSON: ${REPORT_DIR}/report-${ENVIRONMENT}-${TIMESTAMP}.json"
echo " HTML: ${REPORT_DIR}/report-${ENVIRONMENT}-${TIMESTAMP}.html"
echo " Log:  ${REPORT_DIR}/output-${ENVIRONMENT}-${TIMESTAMP}.log"
echo "============================================"
