# M1: Deploy VPC Stack

**Time**: ~10 minutes
**Depends on**: Nothing (can be done first)
**What this does**: Creates the Virtual Private Cloud (VPC) with public/private subnets, NAT gateways, and security groups that all other services run inside.

## What You Need

- AWS CLI configured (`aws configure`)
- Admin permissions on your AWS account

## Step-by-Step

### 1. Set your environment

```bash
# Choose your environment: development, staging, or production
export ENV=development
export REGION=us-east-1
```

### 2. Create the S3 bucket for CloudFormation templates (first time only)

CloudFormation nested stacks require templates to be uploaded to S3.

```bash
aws s3 mb s3://lynia-finance-${ENV}-templates --region ${REGION} 2>/dev/null || true
```

### 3. Upload the VPC template to S3

```bash
aws s3 cp infrastructure/aws/vpc.yaml \
  s3://lynia-finance-${ENV}-templates/vpc.yaml
```

### 4. Deploy the VPC stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/vpc.yaml \
  --stack-name lynia-vpc-${ENV} \
  --parameter-overrides Environment=${ENV} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}
```

This takes 3-5 minutes. Wait for it to complete.

### 5. Verify the deployment

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-vpc-${ENV} \
  --query 'Stacks[0].StackStatus' \
  --output text \
  --region ${REGION}
```

**Expected output**: `CREATE_COMPLETE`

### 6. Get the VPC outputs (you will need these later)

```bash
# Get all outputs at once
aws cloudformation describe-stacks \
  --stack-name lynia-vpc-${ENV} \
  --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' \
  --output table \
  --region ${REGION}
```

**Write down these values** -- you will need them for M2 (RDS) and M6 (SSM):
- `VpcId` -- e.g., `vpc-0abc123def456`
- `PrivateSubnet1Id` -- e.g., `subnet-0abc123`
- `PrivateSubnet2Id` -- e.g., `subnet-0def456`
- `LambdaSecurityGroupId` -- e.g., `sg-0abc123`

## Troubleshooting

**Stack fails with "Resource limit exceeded"**
Your AWS account may have a VPC limit. Check: AWS Console > VPC > Your VPCs. Delete unused VPCs or request a limit increase.

**Stack fails with "The maximum number of NAT Gateways has been reached"**
NAT Gateways cost ~$0.045/hour each. For development, you can modify `vpc.yaml` to use a single NAT Gateway.

## What Happens Next

- Proceed to **M2: Deploy RDS** (needs VPC outputs)
- Proceed to **M6: Store VPC Outputs in SSM** (needs VPC outputs)
