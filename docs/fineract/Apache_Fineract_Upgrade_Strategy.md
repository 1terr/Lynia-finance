# Apache Fineract Upgrade Strategy for Lynia Finance

## Overview
This document outlines the strategy to keep Lynia Finance updated with the latest Apache Fineract releases while maintaining custom Lynia Finance features.

---

## Git Setup

### Remote Repositories
```bash
# Your Lynia Finance repository (origin)
origin: https://github.com/1terr/Lynia-finance.git

# Apache Fineract upstream (apache-fineract) - ALREADY CONFIGURED ✓
apache-fineract: https://github.com/apache/fineract.git
```

---

## Branch Structure

### Recommended Branches

1. **`master`** (Production)
   - Your stable Lynia Finance code
   - Fully tested and ready for production
   - Only merge from `develop` after thorough testing

2. **`develop`** (Development)
   - Active development branch
   - Where you integrate Apache Fineract updates
   - Where you develop new Lynia Finance features

3. **`fineract-upstream-tracking`** (Tracking)
   - Tracks pure Apache Fineract versions
   - No customizations - just official releases
   - Makes it easy to see what changed in Apache Fineract

4. **`fineract-v1.13-integration`** (Integration) - ALREADY CREATED ✓
   - Integration branch for current version
   - Where you merge Fineract v1.13.0 with your customizations

---

## Upgrade Workflow

### When a New Apache Fineract Version is Released

#### Step 1: Fetch Latest from Apache Fineract
```bash
# Fetch all tags and branches from Apache Fineract
git fetch apache-fineract --tags

# List available versions
git tag --list '1.*' --sort=-v:refname | head -10
```

#### Step 2: Update Tracking Branch
```bash
# Switch to tracking branch
git checkout fineract-upstream-tracking

# Update to latest version (e.g., 1.14.0)
git merge 1.14.0 --ff-only

# Tag it for reference
git tag -a lynia-fineract-v1.14.0 -m "Apache Fineract v1.14.0 baseline"
```

#### Step 3: Create Integration Branch
```bash
# Create a new integration branch from the new version
git checkout -b fineract-v1.14-integration 1.14.0
```

#### Step 4: Merge Your Customizations
```bash
# Merge your develop branch into the integration branch
git merge develop --no-commit

# Review conflicts and changes
git status
git diff --cached
```

#### Step 5: Resolve Conflicts
- Carefully review merge conflicts
- Understand what changed in Apache Fineract
- Preserve your Lynia Finance customizations
- Test thoroughly

```bash
# After resolving conflicts
git add .
git commit -m "Integrate Lynia Finance customizations with Apache Fineract v1.14.0"
```

#### Step 6: Test Integration
- Run all tests
- Test critical Lynia Finance features
- Verify Apache Fineract core functionality
- Check database migrations

```bash
# Run tests (adjust based on your setup)
./gradlew clean test
./gradlew integrationTest
```

#### Step 7: Merge to Develop
```bash
# Switch to develop
git checkout develop

# Merge the tested integration
git merge fineract-v1.14-integration

# Push to your repository
git push origin develop
```

#### Step 8: Deploy to Production
```bash
# After thorough testing on develop
git checkout master
git merge develop
git push origin master
```

---

## Monitoring for Updates

### Method 1: GitHub Watch
1. Go to https://github.com/apache/fineract
2. Click "Watch" → "Custom" → "Releases"
3. Get notifications when new versions are released

### Method 2: Periodic Checks
```bash
# Check for new versions monthly or quarterly
git fetch apache-fineract --tags
git tag --list '1.*' --sort=-v:refname | head -5

# Compare with your current version
git describe --tags
```

### Method 3: GitHub Actions (Automated)
Create a GitHub Action to check for new Apache Fineract releases:

```yaml
# .github/workflows/check-fineract-updates.yml
name: Check Apache Fineract Updates

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
  workflow_dispatch:

jobs:
  check-updates:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Fetch Apache Fineract
        run: |
          git remote add apache-fineract https://github.com/apache/fineract.git
          git fetch apache-fineract --tags

      - name: Check for new versions
        run: |
          LATEST=$(git tag --list '1.*' --sort=-v:refname | head -1)
          echo "Latest Apache Fineract version: $LATEST"
          # Add notification logic here
```

---

## Version Tracking

### Create Tags for Each Upgrade
```bash
# Tag your current state before upgrading
git tag -a lynia-v1.0.0-fineract-1.13.0 -m "Lynia Finance v1.0.0 based on Fineract 1.13.0"

# Tag after successful upgrade
git tag -a lynia-v1.1.0-fineract-1.14.0 -m "Lynia Finance v1.1.0 based on Fineract 1.14.0"
```

### Keep a Changelog
Document what changed in each Apache Fineract version and how it affects Lynia Finance.

---

## Best Practices

### 1. **Document Your Customizations**
Keep a list of all files/modules you've customized:
- Custom modules in `/custom/lynia/`
- Modified core files
- Custom database migrations
- Custom API endpoints

### 2. **Minimize Core Modifications**
- Use Apache Fineract's extension points
- Keep customizations in separate modules when possible
- Follow the custom module pattern (see `/custom/acme/` examples)

### 3. **Test Before Merging**
- Create a test environment
- Run automated tests
- Perform manual testing of critical features
- Test database migrations

### 4. **Incremental Updates**
- Don't skip versions if possible
- Update regularly (e.g., quarterly)
- Smaller updates = easier conflict resolution

### 5. **Review Release Notes**
Before upgrading, read Apache Fineract's release notes:
- Breaking changes
- Deprecated features
- Security fixes
- Database schema changes

---

## Rollback Strategy

### If Upgrade Fails
```bash
# Return to previous stable version
git checkout master

# Or revert the merge
git revert -m 1 <merge-commit-hash>
```

### Database Rollback
- Keep database backups before migrations
- Test migrations on staging first
- Document rollback procedures

---

## Current Status

- **Current Apache Fineract Version**: 1.13.0
- **Integration Branch Created**: `fineract-v1.13-integration` ✓
- **Remote Added**: `apache-fineract` ✓
- **Latest Available Version**: 1.13.0
- **Next Release to Monitor**: 1.13.1 or 1.14.0

---

## Quick Reference Commands

```bash
# Check for new versions
git fetch apache-fineract --tags && git tag --list '1.*' --sort=-v:refname | head -5

# Create new integration branch
git checkout -b fineract-v1.X.X-integration 1.X.X

# View changes between versions
git log --oneline 1.13.0..1.14.0

# Compare files between versions
git diff 1.13.0..1.14.0 -- path/to/file

# View your customizations vs Apache Fineract
git diff apache-fineract/develop...develop
```

---

## Support Resources

- **Apache Fineract**: https://fineract.apache.org/
- **GitHub Repository**: https://github.com/apache/fineract
- **Documentation**: https://fineract.apache.org/docs/
- **Mailing List**: dev@fineract.apache.org
- **JIRA**: https://issues.apache.org/jira/browse/FINERACT

---

## Notes

- Always backup your database before upgrading
- Test on staging/development environment first
- Keep your team informed of upgrade plans
- Document any issues encountered during upgrades
- Consider LTS (Long Term Support) versions for stability

---

**Last Updated**: 2025-10-30
**Document Version**: 1.0
**Maintained By**: Lynia Finance Development Team
