#!/bin/bash
###############################################################################
# Deploy to AWS Production Environment
# Usage: ./scripts/deploy-production.sh
###############################################################################

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════"
echo "  Lynia Finance - Deploy to PRODUCTION"
echo "  ⚠️  WARNING: Production Deployment"
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

# PRODUCTION SAFETY CHECKS
echo "⚠️  PRODUCTION DEPLOYMENT SAFETY CHECKS"
echo "─────────────────────────────────────────────────────────"
echo ""

# Confirm production deployment
echo "You are about to deploy to PRODUCTION."
echo "This will affect live customers and real payments."
echo ""
read -p "Type 'PRODUCTION' to confirm: " -r
echo ""
if [[ ! $REPLY == "PRODUCTION" ]]; then
    echo "Deployment cancelled. You must type 'PRODUCTION' exactly."
    exit 0
fi

echo ""
read -p "Have you tested in staging? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please test in staging environment first."
    exit 1
fi

echo ""
read -p "Do you have a rollback plan? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please prepare a rollback plan before deploying to production."
    exit 1
fi

echo ""
echo "Step 1: Building Lambda functions..."
echo "─────────────────────────────────────────────────────────"
sam build --config-env production --cached --parallel

echo ""
echo "Step 2: Validating SAM template..."
echo "─────────────────────────────────────────────────────────"
sam validate --lint

echo ""
echo "Step 3: Deploying to AWS PRODUCTION..."
echo "─────────────────────────────────────────────────────────"
sam deploy \
  --config-env production \
  --no-fail-on-empty-changeset \
  --parameter-overrides "$(cat config/parameters-production.json | jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")')"

# Production deploy requires manual changeset confirmation

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Deployment to PRODUCTION Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name lynia-finance-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)

echo "📡 API Gateway URL: $API_URL"
echo ""
echo "✅ PRODUCTION CHECKLIST:"
echo "  [ ] Verify all endpoints are responding"
echo "  [ ] Check CloudWatch logs for errors"
echo "  [ ] Monitor error rates in CloudWatch dashboard"
echo "  [ ] Test critical flows (payment, KYC, WhatsApp)"
echo "  [ ] Notify team in Slack/Teams"
echo ""
echo "View logs: sam logs --config-env production --tail"
echo "View metrics: https://console.aws.amazon.com/cloudwatch"
echo "Rollback: aws cloudformation delete-stack --stack-name lynia-finance-prod"
echo ""
