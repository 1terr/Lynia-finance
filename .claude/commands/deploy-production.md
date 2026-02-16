# Deploy to Production

Run the full production deployment pipeline with all safety checks.

## Pre-flight checks (run ALL before triggering deploy)

1. **Verify working tree is clean:**
   ```bash
   git status
   ```
   If there are uncommitted changes, commit or stash them first.

2. **Verify master is up to date:**
   ```bash
   git log origin/master..HEAD --oneline
   ```
   If there are unpushed commits, push them first.

3. **Check production stack is in a deployable state:**
   ```bash
   aws cloudformation describe-stacks --stack-name lynia-finance-prod \
     --query 'Stacks[0].StackStatus' --output text
   ```
   - `UPDATE_COMPLETE` or `CREATE_COMPLETE` = OK
   - `UPDATE_ROLLBACK_COMPLETE` = OK (previous update failed, rolled back)
   - `ROLLBACK_COMPLETE` = BLOCKED (must delete stack first, then redeploy)

4. **Check for resource name conflicts** (if adding new Lambda/Dashboard/Queue):
   ```bash
   # Check Lambda names
   aws lambda list-functions --query "Functions[?contains(FunctionName, 'production-lynia')].FunctionName" --output table
   # Check dashboard names
   aws cloudwatch list-dashboards --dashboard-name-prefix production-lynia
   ```
   If a resource with the same name exists in another stack, resolve the conflict before deploying.

5. **Verify staging deploy passed recently:**
   ```bash
   gh run list --workflow=deploy.yml --limit=5
   ```
   At least one recent push-triggered run should show `success`.

## Trigger production deploy

```bash
gh workflow run deploy.yml --ref master -f environment=production
```

## Monitor the deploy

```bash
# Get the run ID
sleep 15 && gh run list --workflow=deploy.yml --limit=3

# Watch the run (replace RUN_ID)
gh run view RUN_ID

# If it fails, get the error
gh run view RUN_ID --log-failed | tail -40
```

## Common failure causes and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ParameterName= is not a valid format` | GitHub secret is empty | Ensure shell-level `${VAR:-placeholder}` fallbacks in deploy.yml |
| `AWS::EarlyValidation::ResourceExistenceCheck` | Resource with same name exists in another stack | Delete the other stack or rename the resource |
| `Circular dependency between resources` | API Gateway <-> Lambda ref cycle | Use template Parameters for inter-service URLs, not `!Ref ApiGateway` |
| `ROLLBACK_COMPLETE` | Previous fresh stack creation failed | Delete the stack, then redeploy |
| `confirm_changeset` hangs | samconfig.toml requires confirmation | Ensure `--no-confirm-changeset` in deploy.yml |
| `AccessDenied` on resource creation | IAM permissions missing for deploy user | Add the missing permission to `github-actions-deploy` user |

## Post-deploy verification

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name lynia-finance-prod \
  --query 'Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime}' --output table

# Health check
curl -s -o /dev/null -w "%{http_code}" https://kly80hrgca.execute-api.us-east-1.amazonaws.com/Prod/health

# Run smoke tests
bash scripts/deployment-smoke-test.sh
```