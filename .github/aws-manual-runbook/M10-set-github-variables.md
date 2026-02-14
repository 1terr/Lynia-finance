# M10: Set GitHub Variables for Frontend Deployment

**Time**: ~10 minutes
**Depends on**: M4 (Cognito), M1 (VPC), SAM deploy complete, CloudFront created
**What this does**: Sets non-secret configuration values (Cognito IDs, API URLs, CloudFront distribution IDs, S3 bucket names) that the frontend build and deployment workflows need.

## Why This Is Needed

The frontend apps (admin portal, distributor dashboard) need to know:
- Which Cognito User Pool to authenticate against
- What API URL to call
- Which S3 bucket to upload built files to
- Which CloudFront distribution to invalidate after deploy

These are not secrets (they're embedded in client-side JavaScript), so they go in GitHub Variables, not Secrets.

## What You Need

- Admin access to the GitHub repository
- Outputs from previous steps:
  - Cognito User Pool ID and Client ID (from M4)
  - API Gateway URL (from `sam deploy` output)
  - S3 bucket names (from frontend-hosting stack)
  - CloudFront distribution IDs (from frontend-hosting stack)

## Step-by-Step

### 1. Gather all required values

Run these commands to get the values you need:

```bash
export ENV=production
export REGION=us-east-1

# Get Cognito values
echo "=== Cognito ==="
aws cognito-idp list-user-pools --max-results 10 \
  --query "UserPools[?Name=='lynia-finance-${ENV}-users'].Id" \
  --output text --region ${REGION}

# Get the User Pool ID, then get the client ID
export USER_POOL_ID=REPLACE_WITH_OUTPUT_ABOVE
aws cognito-idp list-user-pool-clients \
  --user-pool-id ${USER_POOL_ID} \
  --query 'UserPoolClients[0].ClientId' \
  --output text --region ${REGION}

# Get API Gateway URL from SAM stack
echo "=== API Gateway ==="
aws cloudformation describe-stacks \
  --stack-name lynia-finance-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`LyniaApiUrl`].OutputValue' \
  --output text --region ${REGION}

# Get S3 bucket names and CloudFront IDs from frontend stack
echo "=== Frontend Hosting ==="
aws cloudformation describe-stacks \
  --stack-name lynia-finance-prod \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Bucket`) || contains(OutputKey, `Distribution`) || contains(OutputKey, `Url`)].{Key:OutputKey,Value:OutputValue}' \
  --output table --region ${REGION}
```

### 2. Go to GitHub repository settings

1. Open your repository: `https://github.com/YOUR_ORG/Lynia-finance`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click the **"Variables"** tab (next to the "Secrets" tab)

### 3. Add all required variables

Click **"New repository variable"** for each:

| Variable Name | Example Value | Where to get it |
|---------------|---------------|-----------------|
| `COGNITO_USER_POOL_ID` | `us-east-1_AbCdEfGhI` | M4 output or step 1 |
| `COGNITO_CLIENT_ID` | `1a2b3c4d5e6f7g8h` | Step 1 |
| `COGNITO_DOMAIN` | `lynia-production.auth.us-east-1.amazoncognito.com` | Cognito console → App integration → Domain |
| `API_URL` | `https://abc123.execute-api.us-east-1.amazonaws.com/Prod` | SAM deploy output |
| `ADMIN_PORTAL_BUCKET` | `lynia-finance-production-admin-portal` | Frontend stack output |
| `ADMIN_PORTAL_DISTRIBUTION_ID` | `E1A2B3C4D5E6F7` | Frontend stack output |
| `DISTRIBUTOR_DASHBOARD_BUCKET` | `lynia-finance-production-distributor-dashboard` | Frontend stack output |
| `DISTRIBUTOR_DASHBOARD_DISTRIBUTION_ID` | `E7F6G5H4I3J2K1` | Frontend stack output |

**How to add each variable:**

1. Click **"New repository variable"**
2. Enter the **Name** exactly as shown
3. Enter the **Value**
4. Click **"Add variable"**

### 4. (Optional) Add staging-specific variables

If you want separate staging values, use GitHub Environments:

1. Go to **Settings** → **Environments** → **staging**
2. Under "Environment variables", add the same variable names with staging values

The workflow can then use:
```yaml
environment: staging  # or production
```

### 5. Verify all variables

Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab.

You should see all 8 variables listed with their values (variables are visible, unlike secrets).

### 6. Update frontend build configs

Make sure the frontend apps read these values during build. The Next.js apps should have `.env.production` or `next.config.js` that references them:

```bash
# The GitHub Actions workflow should pass these as build-time env vars:
NEXT_PUBLIC_COGNITO_USER_POOL_ID=${{ vars.COGNITO_USER_POOL_ID }}
NEXT_PUBLIC_COGNITO_CLIENT_ID=${{ vars.COGNITO_CLIENT_ID }}
NEXT_PUBLIC_API_URL=${{ vars.API_URL }}
```

## Troubleshooting

**Frontend shows "undefined" for API URL**
The variable name in the workflow doesn't match what the frontend code reads. Check `next.config.js` or `.env` files for the expected variable names (usually prefixed with `NEXT_PUBLIC_`).

**CloudFront invalidation fails**
The distribution ID is wrong. Go to AWS CloudFront console and verify the correct distribution ID.

**"Bucket does not exist" during frontend deploy**
The S3 bucket name is wrong or the frontend-hosting stack hasn't been deployed yet.

## What Happens Next

- Frontend builds will now have the correct configuration
- Proceed to **M11** (Domain DNS Delegation) to set up the custom domain
