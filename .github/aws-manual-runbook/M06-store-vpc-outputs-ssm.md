# M6: Store VPC Outputs in SSM Parameter Store

**Time**: ~5 minutes
**Depends on**: M1 (VPC stack must be deployed)
**What this does**: Saves VPC resource IDs (subnet IDs, security group ID) into AWS Systems Manager Parameter Store so that `sam deploy` can automatically resolve them via `samconfig.toml`.

## Why This Is Needed

The `samconfig.toml` file for staging and production uses SSM parameter references like:

```
PrivateSubnet1Id={resolve:ssm:/staging/lynia/vpc/private-subnet-1}
```

If these SSM parameters don't exist, `sam deploy` will fail with a "parameter not found" error.

## What You Need

- AWS CLI configured with admin permissions
- The VPC CloudFormation stack name from M1 (e.g., `lynia-finance-staging-vpc` or `lynia-finance-prod-vpc`)

## Step-by-Step

### 1. Set your environment

Pick **one** environment to configure:

```bash
# For staging:
export ENV=staging
export STACK_NAME=lynia-finance-staging-vpc

# For production:
export ENV=production
export STACK_NAME=lynia-finance-prod-vpc
```

### 2. Get the VPC stack outputs

```bash
aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query 'Stacks[0].Outputs' \
  --output table \
  --region us-east-1
```

You should see outputs like:
- `PrivateSubnet1Id` → e.g., `subnet-0abc123def456`
- `PrivateSubnet2Id` → e.g., `subnet-0def789ghi012`
- `LambdaSecurityGroupId` → e.g., `sg-0abc123def456`

**Write these values down.** You'll use them in the next step.

### 3. Store values in SSM Parameter Store

Replace the placeholder values with the real outputs from step 2:

```bash
# Private Subnet 1
aws ssm put-parameter \
  --name "/${ENV}/lynia/vpc/private-subnet-1" \
  --type "String" \
  --value "REPLACE_WITH_PRIVATE_SUBNET_1_ID" \
  --description "Private subnet 1 for Lambda functions" \
  --region us-east-1

# Private Subnet 2
aws ssm put-parameter \
  --name "/${ENV}/lynia/vpc/private-subnet-2" \
  --type "String" \
  --value "REPLACE_WITH_PRIVATE_SUBNET_2_ID" \
  --description "Private subnet 2 for Lambda functions" \
  --region us-east-1

# Lambda Security Group
aws ssm put-parameter \
  --name "/${ENV}/lynia/vpc/lambda-sg" \
  --type "String" \
  --value "REPLACE_WITH_LAMBDA_SG_ID" \
  --description "Security group for Lambda functions" \
  --region us-east-1
```

### 4. Verify all parameters were stored

```bash
aws ssm get-parameters \
  --names \
    "/${ENV}/lynia/vpc/private-subnet-1" \
    "/${ENV}/lynia/vpc/private-subnet-2" \
    "/${ENV}/lynia/vpc/lambda-sg" \
  --query 'Parameters[*].{Name:Name,Value:Value}' \
  --output table \
  --region us-east-1
```

**Expected output**: A table showing all 3 parameters with the correct subnet/SG IDs.

### 5. (If you need to update a value later)

```bash
aws ssm put-parameter \
  --name "/${ENV}/lynia/vpc/private-subnet-1" \
  --type "String" \
  --value "NEW_SUBNET_ID_HERE" \
  --overwrite \
  --region us-east-1
```

Note the `--overwrite` flag — without it, the command will fail if the parameter already exists.

## How samconfig.toml Uses These

In `samconfig.toml`, the staging and production configs reference these parameters:

```toml
parameter_overrides = "... PrivateSubnet1Id={resolve:ssm:/staging/lynia/vpc/private-subnet-1} ..."
```

When you run `sam deploy --config-env staging`, SAM automatically resolves these SSM references and passes the real values to CloudFormation.

## Troubleshooting

**"ParameterNotFound" during sam deploy**
The SSM parameter doesn't exist yet. Run step 3 above.

**"ParameterAlreadyExists"**
The parameter was already created. Add `--overwrite` to the command.

**Wrong subnet/SG values**
Re-run step 2 to get the correct outputs from the VPC stack, then update with `--overwrite`.

## What Happens Next

- Complete **M7** (Store Cognito ARN in SSM) if not done yet
- Then run `sam deploy --config-env staging` or `sam deploy --config-env production`
