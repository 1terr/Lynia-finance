# M5: Create Cognito User Groups

**Time**: ~5 minutes
**Depends on**: M4 (Cognito User Pool must exist)
**What this does**: Creates the 5 user groups that control role-based access in the admin portal and distributor dashboard.

## What You Need

- `UserPoolId` from M4

## Step-by-Step

### 1. Set your environment

```bash
export ENV=development
export REGION=us-east-1
export USER_POOL_ID=REPLACE_WITH_USER_POOL_ID
```

### 2. Create all 5 user groups

Run these commands one by one:

```bash
# Group 1: admin - Full system access
aws cognito-idp create-group \
  --user-pool-id ${USER_POOL_ID} \
  --group-name admin \
  --description "Full system administrators with access to all features" \
  --precedence 1 \
  --region ${REGION}

# Group 2: manager - Branch/team management
aws cognito-idp create-group \
  --user-pool-id ${USER_POOL_ID} \
  --group-name manager \
  --description "Branch managers who can approve loans and manage teams" \
  --precedence 2 \
  --region ${REGION}

# Group 3: support - Customer support
aws cognito-idp create-group \
  --user-pool-id ${USER_POOL_ID} \
  --group-name support \
  --description "Customer support staff with read access to customer data" \
  --precedence 3 \
  --region ${REGION}

# Group 4: reports_viewer - Read-only reporting
aws cognito-idp create-group \
  --user-pool-id ${USER_POOL_ID} \
  --group-name reports_viewer \
  --description "Read-only access to reports and dashboards" \
  --precedence 4 \
  --region ${REGION}

# Group 5: distributor - Field agents
aws cognito-idp create-group \
  --user-pool-id ${USER_POOL_ID} \
  --group-name distributor \
  --description "Field agents who distribute devices and onboard customers" \
  --precedence 5 \
  --region ${REGION}
```

### 3. Verify all groups were created

```bash
aws cognito-idp list-groups \
  --user-pool-id ${USER_POOL_ID} \
  --query 'Groups[*].{Name:GroupName,Precedence:Precedence,Description:Description}' \
  --output table \
  --region ${REGION}
```

**Expected output**: A table with 5 groups (admin, manager, support, reports_viewer, distributor).

### 4. (Optional) Add users to groups

```bash
# Add an existing user to a group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ${USER_POOL_ID} \
  --username user@example.com \
  --group-name admin \
  --region ${REGION}
```

## Group Permissions Summary

| Group | Portal Access | Can Approve Loans | Can Lock Devices | Can View Reports |
|-------|--------------|-------------------|------------------|-----------------|
| admin | Admin Portal | Yes | Yes | Yes |
| manager | Admin Portal | Yes | Yes | Yes |
| support | Admin Portal | No | No | Yes |
| reports_viewer | Admin Portal | No | No | Yes |
| distributor | Distributor Dashboard | No | No | No |

## Troubleshooting

**"Group already exists"**
The group was already created. This is fine -- skip to the next group.

**"ResourceNotFoundException"**
The User Pool ID is wrong. Double-check the value from M4.

## What Happens Next

- Proceed to **M13: Enroll Users in MFA** (after users have been created)
