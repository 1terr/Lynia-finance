#!/bin/bash
###############################################################################
# Deploy to AWS Staging Environment
# Usage: ./scripts/deploy-staging.sh
###############################################################################

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════"
echo "  Lynia Finance - Deploy to Staging"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

echo "✓ AWS CLI configured"
echo ""

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI not installed. Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

echo "✓ AWS SAM CLI installed"
echo ""

# Show current AWS identity
echo "Current AWS Identity:"
aws sts get-caller-identity
echo ""

# Confirm deployment
read -p "Deploy to STAGING environment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "Step 1: Building Lambda functions..."
echo "─────────────────────────────────────────────────────────"
sam build --config-env staging --cached --parallel

echo ""
echo "Step 2: Validating SAM template..."
echo "─────────────────────────────────────────────────────────"
sam validate --lint

echo ""
echo "Step 3: Deploying to AWS..."
echo "─────────────────────────────────────────────────────────"
sam deploy \
  --config-env staging \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides "$(cat config/parameters-staging.json | jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")')"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Deployment to Staging Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name lynia-finance-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)

echo "📡 API Gateway URL: $API_URL"
echo ""
echo "Test endpoints:"
echo "  - Health Check: curl $API_URL/health"
echo "  - Scoring: curl -X POST $API_URL/scoring/calculate"
echo ""
echo "View logs: sam logs --config-env staging --tail"
echo "View in AWS Console: https://console.aws.amazon.com/cloudformation"
echo ""
