#!/bin/bash
# Check for Apache Fineract Updates
# Usage: ./scripts/check-fineract-updates.sh

set -e

echo "=========================================="
echo "Apache Fineract Update Checker"
echo "=========================================="
echo ""

# Fetch latest tags from Apache Fineract
echo "📡 Fetching latest Apache Fineract releases..."
git fetch apache-fineract --tags --quiet

# Get the latest version
LATEST_VERSION=$(git tag --list '1.*' --sort=-v:refname | head -1)
echo "✅ Latest Apache Fineract version: $LATEST_VERSION"
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Show recent versions
echo "📋 Recent Apache Fineract versions:"
git tag --list '1.*' --sort=-v:refname | head -10
echo ""

# Check if there are new versions
echo "=========================================="
echo "🔍 Checking for updates..."
echo ""

# Get the last integrated version from tags
LAST_INTEGRATED=$(git tag --list 'lynia-*-fineract-*' --sort=-v:refname | head -1)

if [ -z "$LAST_INTEGRATED" ]; then
    echo "⚠️  No Lynia integration tags found."
    echo "💡 Tip: Tag your current integration with:"
    echo "   git tag -a lynia-v1.0.0-fineract-1.13.0 -m 'Description'"
else
    echo "✅ Last integrated version tag: $LAST_INTEGRATED"
fi

echo ""
echo "=========================================="
echo "📚 Quick Actions:"
echo ""
echo "1. View changes in latest version:"
echo "   git log --oneline $LATEST_VERSION | head -20"
echo ""
echo "2. Create integration branch:"
echo "   git checkout -b fineract-v1.X.X-integration $LATEST_VERSION"
echo ""
echo "3. Compare versions:"
echo "   git log --oneline 1.13.0..$LATEST_VERSION"
echo ""
echo "4. View release notes:"
echo "   Visit: https://github.com/apache/fineract/releases/tag/$LATEST_VERSION"
echo ""
echo "=========================================="
