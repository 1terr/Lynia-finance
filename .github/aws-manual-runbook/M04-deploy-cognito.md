# M4: Deploy Cognito User Pool

**Time**: ~10 minutes
**Depends on**: Nothing (can be done in parallel with M1)
**What this does**: Creates the Amazon Cognito User Pool that handles authentication for the admin portal and distributor dashboard.

## What You Need

- AWS CLI configured
- The file `infrastructure/aws/cognito.yaml` (already in the repo)

## Step-by-Step

### 1. Set your environment

```bash
export ENV=development
export REGION=us-east-1
```

### 2. Deploy the Cognito stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/cognito.yaml \
  --stack-name lynia-cognito-${ENV} \
  --parameter-overrides \
    Environment=${ENV} \
    DeployId=$(date +%Y%m%d%H%M%S) \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}
```

### 3. Verify the deployment

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-cognito-${ENV} \
  --query 'Stacks[0].StackStatus' \
  --output text \
  --region ${REGION}
```

**Expected output**: `CREATE_COMPLETE`

### 4. Get the Cognito outputs

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-cognito-${ENV} \
  --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' \
  --output table \
  --region ${REGION}
```

**Write down these values** -- you will need them for M5, M7, M9, and M10:
- `UserPoolId` -- e.g., `us-east-1_AbCdEfGhI`
- `UserPoolArn` -- e.g., `arn:aws:cognito-idp:us-east-1:123456789:userpool/us-east-1_AbCdEfGhI`
- `AdminClientId` -- e.g., `1abc2def3ghi4jkl5mno`
- `DistributorClientId` -- e.g., `6pqr7stu8vwx9yza0bcd`

### 5. Create your first admin user

```bash
# Replace with your actual email
export ADMIN_EMAIL=admin@lynia.co.zw
export USER_POOL_ID=REPLACE_WITH_USER_POOL_ID

# Create the user
aws cognito-idp admin-create-user \
  --user-pool-id ${USER_POOL_ID} \
  --username ${ADMIN_EMAIL} \
  --user-attributes Name=email,Value=${ADMIN_EMAIL} Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --region ${REGION}
```

The user will be forced to change their password on first login.

### 6. Add the user to the admin group

```bash
# First, the admin group must exist (see M5)
# Then add the user:
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ${USER_POOL_ID} \
  --username ${ADMIN_EMAIL} \
  --group-name admin \
  --region ${REGION}
```

## Understanding Cognito Clients

The template creates **two** app clients:

| Client | Who Uses It | Token Lifetime |
|--------|-------------|----------------|
| Admin Portal Client | Staff (admin, manager, support) | Access: 1 hour, Refresh: 30 days |
| Distributor Client | Field agents (distributors) | Access: 1 hour, Refresh: 7 days |

Each frontend app uses its own Client ID to authenticate users.

## Troubleshooting

**Stack fails with "User Pool already exists"**
A Cognito User Pool with that name already exists. Either delete the old one or change `Environment`.

**"User does not exist" when adding to group**
Make sure you created the user first (Step 5) and the group exists (M5).

## What Happens Next

- Proceed to **M5: Create Cognito User Groups** (needs UserPoolId)
- Proceed to **M7: Store Cognito ARN in SSM** (needs UserPoolArn)
- Proceed to **M10: Set GitHub Variables** (needs UserPoolId and ClientIds)
