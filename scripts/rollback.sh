#!/bin/bash
###############################################################################
# Rollback AWS Deployment
# Usage: ./scripts/rollback.sh <environment>
# Example: ./scripts/rollback.sh staging
###############################################################################

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: ./scripts/rollback.sh <environment>"
    echo "Environments: staging | production"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo "❌ Invalid environment. Must be 'staging' or 'production'."
    exit 1
fi

STACK_NAME="lynia-finance-${ENVIRONMENT}"

echo "═══════════════════════════════════════════════════════"
echo "  Lynia Finance - Rollback $ENVIRONMENT"
echo "  ⚠️  WARNING: This will revert to the previous version"
echo "═══════════════════════════════════════════════════════"
echo ""

# Show current stack status
echo "Current stack status:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].{Status:StackStatus,LastUpdate:LastUpdatedTime}' \
  --output table

echo ""

# Confirm rollback
if [ "$ENVIRONMENT" == "production" ]; then
    read -p "Type 'ROLLBACK' to confirm production rollback: " -r
    if [[ ! $REPLY == "ROLLBACK" ]]; then
        echo "Rollback cancelled."
        exit 0
    fi
else
    read -p "Rollback $ENVIRONMENT environment? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Rollback cancelled."
        exit 0
    fi
fi

echo ""
echo "Rolling back to previous version..."
echo "─────────────────────────────────────────────────────────"

# Get previous stack template
aws cloudformation get-template \
  --stack-name $STACK_NAME \
  --template-stage Original \
  --output json > /tmp/previous-template.json

# Create change set for rollback
aws cloudformation create-change-set \
  --stack-name $STACK_NAME \
  --change-set-name rollback-$(date +%Y%m%d-%H%M%S) \
  --template-body file:///tmp/previous-template.json

echo ""
echo "Change set created. Review in AWS Console before executing."
echo ""
echo "To execute rollback:"
echo "  aws cloudformation execute-change-set --change-set-name <change-set-name> --stack-name $STACK_NAME"
echo ""
echo "To cancel:"
echo "  aws cloudformation delete-change-set --change-set-name <change-set-name> --stack-name $STACK_NAME"
echo ""
