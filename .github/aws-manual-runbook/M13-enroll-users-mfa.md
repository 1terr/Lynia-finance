# M13: Enroll Users in MFA

**Time**: ~5 minutes per user
**Depends on**: M4 (Cognito), M5 (groups created), users have been created
**What this does**: Ensures all admin and manager users have Multi-Factor Authentication (MFA) enabled for secure access to the admin portal.

## Why This Is Needed

The admin portal handles sensitive financial data — loan approvals, payment processing, customer PII, and device locking. MFA adds a second layer of security beyond passwords, protecting against compromised credentials.

The Cognito User Pool is configured to require MFA for admin and manager roles. Users who haven't set up MFA will be unable to sign in.

## What You Need

- AWS Console access or CLI
- The Cognito User Pool ID from M4
- A list of admin/manager users who need MFA
- Each user needs an authenticator app (Google Authenticator, Authy, Microsoft Authenticator)

## Step-by-Step

### 1. Set your environment

```bash
export USER_POOL_ID=REPLACE_WITH_USER_POOL_ID
export REGION=us-east-1
```

### 2. Create admin users (if not already created)

```bash
# Create an admin user
aws cognito-idp admin-create-user \
  --user-pool-id ${USER_POOL_ID} \
  --username admin@lynia.co.zw \
  --user-attributes \
    Name=email,Value=admin@lynia.co.zw \
    Name=email_verified,Value=true \
    Name=given_name,Value=Admin \
    Name=family_name,Value=User \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --region ${REGION}

# Add user to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ${USER_POOL_ID} \
  --username admin@lynia.co.zw \
  --group-name admin \
  --region ${REGION}
```

Repeat for each admin/manager user.

### 3. Set MFA preference for the user pool

Verify MFA is configured on the pool:

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id ${USER_POOL_ID} \
  --query 'UserPool.MfaConfiguration' \
  --output text \
  --region ${REGION}
```

Expected output: `ON` or `OPTIONAL`

If MFA is `OFF`, enable it:

```bash
aws cognito-idp set-user-pool-mfa-config \
  --user-pool-id ${USER_POOL_ID} \
  --mfa-configuration ON \
  --software-token-mfa-configuration Enabled=true \
  --region ${REGION}
```

### 4. User self-enrollment flow

Each user enrolls in MFA when they first sign in. Here's what happens:

1. **User signs in** with their temporary password
2. **Cognito forces a password change** (new password must meet policy)
3. **Cognito presents MFA setup** — shows a QR code or secret key
4. **User scans the QR code** with their authenticator app
5. **User enters the 6-digit code** from their app to verify
6. **MFA is now active** for that user

### 5. (Alternative) Admin-assisted TOTP setup via CLI

If a user can't complete the self-service flow, you can associate a TOTP device via CLI:

```bash
# Step A: Associate a software token
# (This requires the user's access token from a sign-in attempt)
aws cognito-idp associate-software-token \
  --session "SESSION_TOKEN_FROM_SIGN_IN" \
  --region ${REGION}
```

This returns a `SecretCode`. The user must:
1. Open their authenticator app
2. Tap "Add account" → "Enter a setup key"
3. Enter the `SecretCode`
4. Enter the account name (e.g., "Lynia Finance")

Then verify with:

```bash
aws cognito-idp verify-software-token \
  --session "SESSION_TOKEN" \
  --user-code "123456" \
  --region ${REGION}
```

### 6. Set MFA preference for individual users

After MFA is enrolled, set the preferred MFA method:

```bash
aws cognito-idp admin-set-user-mfa-preference \
  --user-pool-id ${USER_POOL_ID} \
  --username admin@lynia.co.zw \
  --software-token-mfa-settings Enabled=true,PreferredMfa=true \
  --region ${REGION}
```

### 7. Verify MFA is active for a user

```bash
aws cognito-idp admin-get-user \
  --user-pool-id ${USER_POOL_ID} \
  --username admin@lynia.co.zw \
  --query '{MFAOptions:MFAOptions,PreferredMfa:PreferredMfaSetting,Status:UserStatus}' \
  --region ${REGION}
```

### 8. List all users and their MFA status

```bash
aws cognito-idp list-users \
  --user-pool-id ${USER_POOL_ID} \
  --query 'Users[*].{Username:Username,Status:UserStatus,Enabled:Enabled}' \
  --output table \
  --region ${REGION}
```

## User Communication Template

Send this to each admin/manager user:

---

**Subject: Set Up Two-Factor Authentication for Lynia Finance**

Hi [Name],

Your Lynia Finance admin account has been created. Before you can sign in, you need to set up two-factor authentication (2FA).

**What you need:**
- A smartphone with an authenticator app installed:
  - [Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2) (Android)
  - [Google Authenticator](https://apps.apple.com/app/google-authenticator/id388497605) (iPhone)
  - Or [Authy](https://authy.com/download/) (any device)

**Steps:**
1. Go to: [Admin Portal URL]
2. Sign in with: Email: [their email], Password: [temporary password]
3. You'll be asked to create a new password
4. You'll see a QR code — scan it with your authenticator app
5. Enter the 6-digit code from the app
6. Done! From now on, you'll need your password + a code from the app to sign in

**Important:** Keep your authenticator app safe. If you lose access to it, contact IT support to reset your MFA.

---

## Troubleshooting

**"Software token MFA not enabled"**
Run step 3 to enable software token MFA on the user pool.

**User lost their authenticator device**
Reset their MFA so they can re-enroll:
```bash
aws cognito-idp admin-set-user-mfa-preference \
  --user-pool-id ${USER_POOL_ID} \
  --username user@lynia.co.zw \
  --software-token-mfa-settings Enabled=false,PreferredMfa=false \
  --region ${REGION}
```
Then have them sign in again to re-enroll.

**"NotAuthorizedException: User is not confirmed"**
The user hasn't verified their email. Confirm them:
```bash
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id ${USER_POOL_ID} \
  --username user@lynia.co.zw \
  --region ${REGION}
```

## Which Users Need MFA?

| Group | MFA Required? | Why |
|-------|--------------|-----|
| admin | **Yes** (mandatory) | Full system access, can approve loans, lock devices |
| manager | **Yes** (mandatory) | Can approve loans and manage teams |
| support | Recommended | Access to customer data |
| reports_viewer | Optional | Read-only access to reports |
| distributor | Optional | Limited dashboard access, field use |

## What Happens Next

- All admin and manager users should now have MFA active
- Proceed to **M14** (Deploy CloudFront + WAF) for frontend delivery and security
