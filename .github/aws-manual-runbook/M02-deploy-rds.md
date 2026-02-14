# M2: Deploy RDS PostgreSQL Instance

**Time**: ~15 minutes (instance creation takes 5-10 min)
**Depends on**: M1 (VPC must be deployed first)
**What this does**: Creates a PostgreSQL 16 database instance inside your VPC's private subnets.

## What You Need

- VPC outputs from M1 (VpcId, PrivateSubnet1Id, PrivateSubnet2Id, LambdaSecurityGroupId)
- A strong database password (at least 16 characters, mixed case + numbers + symbols)

## Step-by-Step

### 1. Set your environment and VPC values

```bash
export ENV=development
export REGION=us-east-1

# Paste your VPC outputs from M1 here:
export VPC_ID=vpc-REPLACE_ME
export SUBNET_1=subnet-REPLACE_ME
export SUBNET_2=subnet-REPLACE_ME
export LAMBDA_SG=sg-REPLACE_ME
```

### 2. Generate a secure database password

```bash
# Generate a 24-character random password
export DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9!@#$%' | head -c 24)
echo "SAVE THIS PASSWORD SECURELY: ${DB_PASSWORD}"
```

**IMPORTANT**: Write this password down securely. You will need it for M8 (Secrets Manager). Do NOT commit it to any file.

### 3. Deploy the RDS stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/aws/rds.yaml \
  --stack-name lynia-rds-${ENV} \
  --parameter-overrides \
    Environment=${ENV} \
    VpcId=${VPC_ID} \
    PrivateSubnet1Id=${SUBNET_1} \
    PrivateSubnet2Id=${SUBNET_2} \
    LambdaSecurityGroupId=${LAMBDA_SG} \
    MasterUsername=lynia_admin \
    MasterUserPassword="${DB_PASSWORD}" \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}
```

This takes 5-10 minutes. Wait for completion.

### 4. Verify the deployment

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-rds-${ENV} \
  --query 'Stacks[0].StackStatus' \
  --output text \
  --region ${REGION}
```

**Expected output**: `CREATE_COMPLETE`

### 5. Get the RDS endpoint

```bash
aws cloudformation describe-stacks \
  --stack-name lynia-rds-${ENV} \
  --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' \
  --output table \
  --region ${REGION}
```

**Write down these values** -- you will need them for M3 (migrations) and M8 (Secrets Manager):
- `RDSEndpoint` -- e.g., `lynia-development.xxxxx.us-east-1.rds.amazonaws.com`
- `RDSPort` -- `5432`

### 6. Test connectivity (optional but recommended)

If you have `psql` installed and are on a bastion host or VPN with VPC access:

```bash
psql "postgresql://lynia_admin:${DB_PASSWORD}@YOUR_RDS_ENDPOINT:5432/lynia" -c "SELECT version();"
```

## Cost Estimate

| Environment | Instance | Monthly Cost |
|-------------|----------|-------------|
| Development | db.t4g.micro | ~$15/month |
| Staging | db.t4g.small | ~$30/month |
| Production | db.r6g.large (Multi-AZ) | ~$400/month |

## Troubleshooting

**Stack fails with "DB instance already exists"**
An RDS instance with that name already exists. Either delete it first or change the `Environment` parameter.

**Cannot connect to database**
The RDS instance is in private subnets with no public IP. You need either:
- An EC2 bastion host in the same VPC
- AWS Session Manager to port-forward
- The Lambda functions (which are in the same VPC) to connect

## What Happens Next

- Proceed to **M3: Run Database Migrations** (needs RDS endpoint)
- Proceed to **M8: Populate Secrets Manager** (needs RDS endpoint and password)
