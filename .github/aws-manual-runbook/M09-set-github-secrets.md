# M9: Set GitHub Secrets for CI/CD

**Time**: ~5 minutes
**Depends on**: AWS IAM user or role for CI/CD (created in IAM stack or manually)
**What this does**: Configures the AWS credentials that GitHub Actions uses to deploy Lambda functions, run SAM build/deploy, and upload frontend assets.

## Why This Is Needed

The `.github/workflows/deploy.yml` pipeline uses `aws-actions/configure-aws-credentials` which reads `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from GitHub Secrets. Without these, every deployment will fail with "Unable to locate credentials."

## What You Need

- Admin access to the GitHub repository (Settings tab)
- An AWS IAM user or role dedicated to CI/CD deployments
- The access key ID and secret access key for that IAM user

## Step-by-Step

### 1. Create a dedicated CI/CD IAM user (if not already done)

If the IAM stack from `production-master.yaml` created a deployment role, you can use that. Otherwise, create a dedicated user:

```bash
# Create the user
aws iam create-user --user-name lynia-github-deployer

# Attach required policies
aws iam attach-user-policy \
  --user-name lynia-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-user-policy \
  --user-name lynia-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess

aws iam attach-user-policy \
  --user-name lynia-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AWSLambda_FullAccess

aws iam attach-user-policy \
  --user-name lynia-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/IAMFullAccess

aws iam attach-user-policy \
  --user-name lynia-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator

aws iam attach-user-policy \
  --user-name lynia-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonCognitoPowerUser

# Create access keys
aws iam create-access-key --user-name lynia-github-deployer
```

**Save the output!** It contains `AccessKeyId` and `SecretAccessKey`. You cannot retrieve the secret key again after this step.

### 2. Go to GitHub repository settings

1. Open your browser and go to your repository: `https://github.com/YOUR_ORG/Lynia-finance`
2. Click **Settings** (gear icon, top-right of the repo page)
3. In the left sidebar, click **Secrets and variables** → **Actions**

### 3. Add the required secrets

Click **"New repository secret"** for each of these:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | `AKIA...` (from step 1) | AWS access key for deployments |
| `AWS_SECRET_ACCESS_KEY` | The secret key from step 1 | AWS secret key for deployments |

**How to add each secret:**

1. Click **"New repository secret"**
2. Enter the **Name** exactly as shown (e.g., `AWS_ACCESS_KEY_ID`)
3. Paste the **Value**
4. Click **"Add secret"**

### 4. (Optional) Add environment-specific secrets

If you use GitHub Environments for staging/production separation:

1. Go to **Settings** → **Environments**
2. Click **"New environment"** and create `staging` and `production`
3. For each environment, add the same secrets but with environment-specific AWS credentials

This lets you use different AWS accounts or IAM roles for staging vs production.

### 5. Verify secrets are set

Go to **Settings** → **Secrets and variables** → **Actions**. You should see:

```
AWS_ACCESS_KEY_ID        Updated X minutes ago
AWS_SECRET_ACCESS_KEY    Updated X minutes ago
```

Note: GitHub never shows secret values after they're saved. You can only update or delete them.

### 6. Test the pipeline

Push a commit or manually trigger the workflow:

```bash
# From your local machine
git push origin main
```

Or go to **Actions** tab → select the deployment workflow → click **"Run workflow"**.

## Security Best Practices

1. **Use least-privilege IAM policies** — don't use admin access keys in CI/CD
2. **Rotate keys regularly** — update GitHub Secrets when you rotate AWS keys
3. **Consider OIDC** instead of long-lived access keys:
   ```yaml
   # In deploy.yml, use OIDC instead of access keys:
   - uses: aws-actions/configure-aws-credentials@v4
     with:
       role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
       aws-region: us-east-1
   ```
   This is more secure because there are no long-lived credentials to leak.
4. **Never commit AWS credentials to the repository**

## Troubleshooting

**"Unable to locate credentials" in GitHub Actions**
The secrets are not set or have wrong names. Check that `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are spelled exactly right.

**"Access Denied" during deploy**
The IAM user doesn't have enough permissions. Check the policies attached in step 1.

**"ExpiredTokenException"**
The access keys were deleted or deactivated. Create new keys and update GitHub Secrets.

## What Happens Next

- The CI/CD pipeline can now authenticate with AWS
- Proceed to **M10** (Set GitHub Variables) for non-secret configuration values
