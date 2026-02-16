# Deploy to Staging

Run the staging deployment pipeline. Staging deploys automatically on every push to `master`, but can also be triggered manually.

## How staging deploys are triggered

| Trigger | What happens |
|---------|--------------|
| `git push origin master` | Automatically runs staging deploy (push event) |
| `gh workflow run deploy.yml --ref master -f environment=staging` | Manual trigger |
| `gh workflow run deploy.yml --ref master -f environment=production` | Skips staging, goes straight to production |

Every push to master triggers a full pipeline: Lint & Test -> Security Scan -> Build -> **Deploy to Staging**. Production is only triggered via `workflow_dispatch`.

## Key differences from production

| Aspect | Staging | Production |
|--------|---------|------------|
| Stack name | `lynia-finance-staging` | `lynia-finance-prod` |
| VPC stacks | Usually don't exist (`staging-lynia-vpc`) | Always exist (`production-lynia-vpc`) |
| VpcEnabled | `false` (placeholders used) | `true` (real subnet/SG IDs) |
| Cognito | Placeholder ARN if no `staging-lynia-cognito` stack | Real ARN from `production-lynia-cognito` |
| SmileEnvironment | `sandbox` | `production` |
| Secrets prefix | `STAGING_*` | `PRODUCTION_*` |
| ROLLBACK_COMPLETE handling | Auto-deletes and recreates | Must verify manually before deploy |
| Inter-service URLs | Empty on first deploy, resolved on subsequent | Resolved from existing stack |

## Pre-flight checks

1. **Verify changes are pushed to master:**
   ```bash
   git status
   git log origin/master..HEAD --oneline
   ```
   Staging auto-triggers on push, so pushing is the deploy trigger.

2. **Check staging stack state** (only needed when debugging failures):
   ```bash
   aws cloudformation describe-stacks --stack-name lynia-finance-staging \
     --query 'Stacks[0].StackStatus' --output text
   ```
   The pipeline auto-handles `ROLLBACK_COMPLETE` (deletes and recreates).

3. **Check for resource name conflicts** (if adding new named resources to template.yaml):
   ```bash
   aws lambda list-functions --query "Functions[?contains(FunctionName, 'staging-lynia')].FunctionName" --output table
   aws cloudwatch list-dashboards --dashboard-name-prefix staging-lynia
   ```

## Manual trigger

```bash
gh workflow run deploy.yml --ref master -f environment=staging
```

## Monitor the deploy

```bash
# Find the run (push-triggered runs show the commit message, manual runs show "Deploy to AWS")
gh run list --workflow=deploy.yml --limit=5

# Watch a specific run
gh run view RUN_ID

# If it fails, get the error
gh run view RUN_ID --log-failed | tail -40
```

## Staging-specific failure causes and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `PrivateSubnet1Id= is not a valid format` | No VPC stack exists, parameter resolves to empty | Pipeline uses `subnet-placeholder` defaults; if this fails, the resolve step is broken |
| `CognitoUserPoolArn= is not a valid format` | No Cognito stack exists | Pipeline uses placeholder ARN `arn:aws:cognito-idp:us-east-1:000000000000:userpool/placeholder` |
| `ROLLBACK_COMPLETE` blocking deploy | Previous fresh stack creation failed | Pipeline auto-deletes and retries; if stuck, manually delete: `aws cloudformation delete-stack --stack-name lynia-finance-staging` |
| `ResourceExistenceCheck` on Lambda/Dashboard | Resource with same `FunctionName`/`DashboardName` exists in another stack | Delete the conflicting stack or rename the resource in template.yaml |
| `ScoringApiUrl` / `WhatsAppApiUrl` empty | First-ever deploy, no existing stack to resolve URLs from | Deploys with empty strings; services work but inter-service calls fail until second deploy |
| `Circular dependency between resources` | Fresh stack creation exposes the API Gateway <-> Lambda cycle | Already fixed by using `ScoringApiUrl`/`WhatsAppApiUrl` template parameters instead of `!Ref LyniaApi` |
| Secret parameters empty | `STAGING_*` GitHub secrets not configured | Shell `${VAR:-placeholder}` fallbacks handle this; services deploy but won't connect to external APIs |

## Staging infrastructure notes

- **No VPC**: Staging Lambdas run outside VPC (`VpcEnabled=false`) because `staging-lynia-vpc` doesn't exist. This means staging Lambdas can't reach RDS directly (RDS is in the production VPC). This is acceptable for CI/CD validation.
- **No Cognito**: Staging uses a placeholder Cognito ARN. API Gateway authorizer won't validate tokens properly. This is acceptable — staging validates the deployment machinery, not auth flows.
- **Inter-service URLs on first deploy**: `ScoringApiUrl` and `WhatsAppApiUrl` are empty on the first deploy because no existing stack exists to read outputs from. After the first successful deploy, subsequent deploys resolve the URLs from the stack outputs. If WhatsApp/Scoring inter-service calls fail in staging, redeploy once.
- **FineractDashboard**: The `IsProduction` condition means the CloudWatch dashboard is only created in production, not staging.

## Post-deploy verification

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name lynia-finance-staging \
  --query 'Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime}' --output table

# Get staging API URL
aws cloudformation describe-stacks --stack-name lynia-finance-staging \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text

# Health check (replace URL with output above)
curl -s -o /dev/null -w "%{http_code}" STAGING_API_URL/health
```

## Promoting staging to production

After staging deploy succeeds:
```bash
# Verify staging passed
gh run list --workflow=deploy.yml --limit=5

# Trigger production deploy
gh workflow run deploy.yml --ref master -f environment=production

# Or use the deploy-production command for full pre-flight checks
```
