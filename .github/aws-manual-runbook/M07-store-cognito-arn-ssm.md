# M7: Store Cognito User Pool ARN in SSM Parameter Store

**Time**: ~3 minutes
**Depends on**: M4 (Cognito User Pool must exist)
**What this does**: Saves the Cognito User Pool ARN into SSM Parameter Store so that `sam deploy` can resolve it automatically for API Gateway authorization.

## Why This Is Needed

The SAM template uses the Cognito User Pool ARN to create an API Gateway authorizer. The `samconfig.toml` references it via SSM:

```
CognitoUserPoolArn={resolve:ssm:/staging/lynia/cognito/user-pool-arn}
```

Without this parameter, `sam deploy` will fail.

## What You Need

- AWS CLI configured with admin permissions
- The `UserPoolId` from M4

## Step-by-Step

### 1. Set your environment

```bash
# For staging:
export ENV=staging
export USER_POOL_ID=REPLACE_WITH_USER_POOL_ID

# For production:
export ENV=production
export USER_POOL_ID=REPLACE_WITH_USER_POOL_ID
```

### 2. Get the User Pool ARN

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id ${USER_POOL_ID} \
  --query 'UserPool.Arn' \
  --output text \
  --region us-east-1
```

This will output something like:

```
arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_AbCdEfGhI
```

**Copy this ARN.**

### 3. Store the ARN in SSM Parameter Store

```bash
aws ssm put-parameter \
  --name "/${ENV}/lynia/cognito/user-pool-arn" \
  --type "String" \
  --value "REPLACE_WITH_THE_ARN_FROM_STEP_2" \
  --description "Cognito User Pool ARN for API Gateway authorizer" \
  --region us-east-1
```

### 4. Verify the parameter

```bash
aws ssm get-parameter \
  --name "/${ENV}/lynia/cognito/user-pool-arn" \
  --query 'Parameter.Value' \
  --output text \
  --region us-east-1
```

**Expected output**: The full Cognito User Pool ARN.

### 5. (One-liner shortcut — get ARN and store it in one step)

If you prefer, you can combine steps 2 and 3:

```bash
aws ssm put-parameter \
  --name "/${ENV}/lynia/cognito/user-pool-arn" \
  --type "String" \
  --value "$(aws cognito-idp describe-user-pool \
    --user-pool-id ${USER_POOL_ID} \
    --query 'UserPool.Arn' \
    --output text \
    --region us-east-1)" \
  --description "Cognito User Pool ARN for API Gateway authorizer" \
  --region us-east-1
```

## Troubleshooting

**"ParameterNotFound" during sam deploy**
Run step 3 to create the parameter.

**"ParameterAlreadyExists"**
Add `--overwrite` to the `put-parameter` command.

**"ResourceNotFoundException" when describing user pool**
The `USER_POOL_ID` is wrong. Go to the AWS Cognito console → User Pools and find the correct ID.

## What Happens Next

- You now have all SSM parameters needed for `sam deploy`
- Run `sam build --cached --parallel` then `sam deploy --config-env staging` (or `production`)
