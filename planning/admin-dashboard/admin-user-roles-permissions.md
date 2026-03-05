# Admin User Roles & Permissions

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.8 Admin Dashboard Design
**Task ID**: P1-T042
**Priority**: High
**Estimated Duration**: 4 hours

---

## 1. Overview

This specification defines the role-based access control (RBAC) system for the Lynia Finance Admin Dashboard. It establishes user roles, permissions, access control policies, and audit logging requirements to ensure secure and appropriate access to platform features and sensitive customer data.

**Key Objectives**:
- Define clear role hierarchies and permissions
- Implement principle of least privilege
- Enable fine-grained access control
- Ensure comprehensive audit logging
- Support role-based UI visibility
- Enable secure delegation of responsibilities

**Compliance Requirements**:
- Zimbabwe Data Protection Act compliance
- PII access restrictions
- Audit trail for all sensitive operations
- Role segregation for financial operations

---

## 2. User Role Definitions

### 2.1 Role Hierarchy

```typescript
// Role hierarchy and inheritance
enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  OPERATIONS_MANAGER = 'operations_manager',
  CUSTOMER_SUPPORT = 'customer_support',
  FINANCE_TEAM = 'finance_team',
  KYC_REVIEWER = 'kyc_reviewer',
  INVENTORY_MANAGER = 'inventory_manager',
  REPORTS_VIEWER = 'reports_viewer'
}

interface RoleDefinition {
  role: AdminRole;
  displayName: string;
  description: string;
  inheritsFrom?: AdminRole[];
  permissions: Permission[];
  restrictions: Restriction[];
  uiSections: UISectionAccess[];
}

const ROLE_DEFINITIONS: Record<AdminRole, RoleDefinition> = {
  [AdminRole.SUPER_ADMIN]: {
    role: AdminRole.SUPER_ADMIN,
    displayName: 'Super Administrator',
    description: 'Full system access including user management and system configuration',
    inheritsFrom: [], // No inheritance, explicit full access
    permissions: ['*'], // All permissions
    restrictions: [],
    uiSections: ['*'] // All UI sections
  },

  [AdminRole.OPERATIONS_MANAGER]: {
    role: AdminRole.OPERATIONS_MANAGER,
    displayName: 'Operations Manager',
    description: 'Manage loans, approvals, device handovers, and customer operations',
    inheritsFrom: [],
    permissions: [
      'loans:read',
      'loans:approve',
      'loans:reject',
      'loans:update',
      'customers:read',
      'customers:update',
      'devices:read',
      'devices:update',
      'devices:handover',
      'devices:lock',
      'devices:unlock',
      'payments:read',
      'kyc:read',
      'kyc:approve',
      'kyc:reject',
      'notifications:send',
      'reports:read'
    ],
    restrictions: [
      'no_user_management',
      'no_system_config',
      'no_payment_refunds'
    ],
    uiSections: [
      'dashboard',
      'customers',
      'loans',
      'devices',
      'payments_readonly',
      'reports'
    ]
  },

  [AdminRole.CUSTOMER_SUPPORT]: {
    role: AdminRole.CUSTOMER_SUPPORT,
    displayName: 'Customer Support',
    description: 'View customer data, send messages, basic support operations',
    inheritsFrom: [],
    permissions: [
      'customers:read',
      'loans:read',
      'devices:read',
      'payments:read',
      'kyc:read',
      'notifications:send',
      'support_tickets:manage'
    ],
    restrictions: [
      'read_only_financials',
      'no_approvals',
      'no_device_control'
    ],
    uiSections: [
      'dashboard_basic',
      'customers',
      'loans_readonly',
      'devices_readonly',
      'support'
    ]
  },

  [AdminRole.FINANCE_TEAM]: {
    role: AdminRole.FINANCE_TEAM,
    displayName: 'Finance Team',
    description: 'Payment tracking, reconciliation, collections, financial reporting',
    inheritsFrom: [],
    permissions: [
      'payments:read',
      'payments:reconcile',
      'payments:refund',
      'loans:read',
      'customers:read',
      'reports:read',
      'reports:export',
      'collections:manage'
    ],
    restrictions: [
      'no_loan_approvals',
      'no_kyc_access',
      'no_device_control'
    ],
    uiSections: [
      'dashboard_financial',
      'payments',
      'collections',
      'reports'
    ]
  },

  [AdminRole.KYC_REVIEWER]: {
    role: AdminRole.KYC_REVIEWER,
    displayName: 'KYC Reviewer',
    description: 'Manual KYC verification and identity validation',
    inheritsFrom: [],
    permissions: [
      'kyc:read',
      'kyc:approve',
      'kyc:reject',
      'kyc:request_resubmission',
      'customers:read',
      'customers:update_kyc_status'
    ],
    restrictions: [
      'no_financial_data',
      'no_loan_approvals',
      'no_device_control'
    ],
    uiSections: [
      'kyc_review_queue',
      'customers_kyc_only'
    ]
  },

  [AdminRole.INVENTORY_MANAGER]: {
    role: AdminRole.INVENTORY_MANAGER,
    displayName: 'Inventory Manager',
    description: 'Device inventory management, stock tracking, handover logistics',
    inheritsFrom: [],
    permissions: [
      'devices:read',
      'devices:create',
      'devices:update',
      'devices:delete',
      'devices:handover',
      'inventory:manage',
      'distributors:read',
      'distributors:manage'
    ],
    restrictions: [
      'no_financial_data',
      'no_customer_pii',
      'no_loan_approvals'
    ],
    uiSections: [
      'devices',
      'inventory',
      'distributors',
      'handovers'
    ]
  },

  [AdminRole.REPORTS_VIEWER]: {
    role: AdminRole.REPORTS_VIEWER,
    displayName: 'Reports Viewer',
    description: 'Read-only access to reports and analytics',
    inheritsFrom: [],
    permissions: [
      'reports:read',
      'reports:export',
      'dashboard:view'
    ],
    restrictions: [
      'read_only_all'
    ],
    uiSections: [
      'dashboard_readonly',
      'reports_readonly'
    ]
  }
};
```

---

## 3. Permission Model

### 3.1 Permission Structure

```typescript
// Permission format: resource:action
type Permission = string; // e.g., 'loans:approve', 'customers:read'

interface PermissionDefinition {
  permission: Permission;
  resource: string;
  action: string;
  description: string;
  requiresAuditLog: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Complete permission registry
const PERMISSIONS: PermissionDefinition[] = [
  // Customer permissions
  {
    permission: 'customers:read',
    resource: 'customers',
    action: 'read',
    description: 'View customer profiles and basic information',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },
  {
    permission: 'customers:update',
    resource: 'customers',
    action: 'update',
    description: 'Update customer information',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'customers:delete',
    resource: 'customers',
    action: 'delete',
    description: 'Delete customer records (soft delete)',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'customers:export',
    resource: 'customers',
    action: 'export',
    description: 'Export customer data',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },

  // Loan permissions
  {
    permission: 'loans:read',
    resource: 'loans',
    action: 'read',
    description: 'View loan applications and details',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },
  {
    permission: 'loans:approve',
    resource: 'loans',
    action: 'approve',
    description: 'Approve loan applications',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'loans:reject',
    resource: 'loans',
    action: 'reject',
    description: 'Reject loan applications',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'loans:update',
    resource: 'loans',
    action: 'update',
    description: 'Update loan details and terms',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'loans:override_limit',
    resource: 'loans',
    action: 'override_limit',
    description: 'Override credit limits and terms',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },

  // KYC permissions
  {
    permission: 'kyc:read',
    resource: 'kyc',
    action: 'read',
    description: 'View KYC submissions and documents',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'kyc:approve',
    resource: 'kyc',
    action: 'approve',
    description: 'Approve KYC submissions',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'kyc:reject',
    resource: 'kyc',
    action: 'reject',
    description: 'Reject KYC submissions',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'kyc:request_resubmission',
    resource: 'kyc',
    action: 'request_resubmission',
    description: 'Request KYC document resubmission',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },

  // Payment permissions
  {
    permission: 'payments:read',
    resource: 'payments',
    action: 'read',
    description: 'View payment transactions',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },
  {
    permission: 'payments:reconcile',
    resource: 'payments',
    action: 'reconcile',
    description: 'Perform payment reconciliation',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'payments:refund',
    resource: 'payments',
    action: 'refund',
    description: 'Process payment refunds',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },

  // Device permissions
  {
    permission: 'devices:read',
    resource: 'devices',
    action: 'read',
    description: 'View device inventory',
    requiresAuditLog: false,
    sensitivityLevel: 'low'
  },
  {
    permission: 'devices:create',
    resource: 'devices',
    action: 'create',
    description: 'Add new devices to inventory',
    requiresAuditLog: true,
    sensitivityLevel: 'medium'
  },
  {
    permission: 'devices:update',
    resource: 'devices',
    action: 'update',
    description: 'Update device information',
    requiresAuditLog: true,
    sensitivityLevel: 'medium'
  },
  {
    permission: 'devices:delete',
    resource: 'devices',
    action: 'delete',
    description: 'Remove devices from inventory',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },
  {
    permission: 'devices:lock',
    resource: 'devices',
    action: 'lock',
    description: 'Lock customer devices',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'devices:unlock',
    resource: 'devices',
    action: 'unlock',
    description: 'Unlock customer devices',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'devices:handover',
    resource: 'devices',
    action: 'handover',
    description: 'Process device handovers',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },

  // Distributor permissions
  {
    permission: 'distributors:read',
    resource: 'distributors',
    action: 'read',
    description: 'View distributor profiles, inventory, handovers, transfers, and commissions',
    requiresAuditLog: false,
    sensitivityLevel: 'low'
  },
  {
    permission: 'distributors:write',
    resource: 'distributors',
    action: 'write',
    description: 'Create/update distributors, allocate inventory, mark commissions as paid',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },

  // Notification permissions
  {
    permission: 'notifications:send',
    resource: 'notifications',
    action: 'send',
    description: 'Send notifications to customers',
    requiresAuditLog: true,
    sensitivityLevel: 'medium'
  },

  // Report permissions
  {
    permission: 'reports:read',
    resource: 'reports',
    action: 'read',
    description: 'View reports and analytics',
    requiresAuditLog: false,
    sensitivityLevel: 'low'
  },
  {
    permission: 'reports:export',
    resource: 'reports',
    action: 'export',
    description: 'Export report data',
    requiresAuditLog: true,
    sensitivityLevel: 'high'
  },

  // Admin user permissions
  {
    permission: 'admin_users:read',
    resource: 'admin_users',
    action: 'read',
    description: 'View admin users',
    requiresAuditLog: false,
    sensitivityLevel: 'medium'
  },
  {
    permission: 'admin_users:create',
    resource: 'admin_users',
    action: 'create',
    description: 'Create new admin users',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'admin_users:update',
    resource: 'admin_users',
    action: 'update',
    description: 'Update admin user roles and permissions',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },
  {
    permission: 'admin_users:delete',
    resource: 'admin_users',
    action: 'delete',
    description: 'Deactivate admin users',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  },

  // System permissions
  {
    permission: 'system:configure',
    resource: 'system',
    action: 'configure',
    description: 'Modify system configuration',
    requiresAuditLog: true,
    sensitivityLevel: 'critical'
  }
];
```

### 3.2 Permission Matrix

```markdown
| Permission                     | Super Admin | Ops Manager | Support | Finance | KYC Rev | Inventory | Reports |
|--------------------------------|-------------|-------------|---------|---------|---------|-----------|---------|
| **Customers**                  |             |             |         |         |         |           |         |
| customers:read                 | ✓           | ✓           | ✓       | ✓       | ✓       | -         | -       |
| customers:update               | ✓           | ✓           | -       | -       | ✓*      | -         | -       |
| customers:delete               | ✓           | -           | -       | -       | -       | -         | -       |
| customers:export               | ✓           | -           | -       | -       | -       | -         | -       |
| **Loans**                      |             |             |         |         |         |           |         |
| loans:read                     | ✓           | ✓           | ✓       | ✓       | -       | -         | -       |
| loans:approve                  | ✓           | ✓           | -       | -       | -       | -         | -       |
| loans:reject                   | ✓           | ✓           | -       | -       | -       | -         | -       |
| loans:update                   | ✓           | ✓           | -       | -       | -       | -         | -       |
| loans:override_limit           | ✓           | -           | -       | -       | -       | -         | -       |
| **KYC**                        |             |             |         |         |         |           |         |
| kyc:read                       | ✓           | ✓           | ✓       | -       | ✓       | -         | -       |
| kyc:approve                    | ✓           | ✓           | -       | -       | ✓       | -         | -       |
| kyc:reject                     | ✓           | ✓           | -       | -       | ✓       | -         | -       |
| kyc:request_resubmission       | ✓           | ✓           | -       | -       | ✓       | -         | -       |
| **Payments**                   |             |             |         |         |         |           |         |
| payments:read                  | ✓           | ✓           | ✓       | ✓       | -       | -         | -       |
| payments:reconcile             | ✓           | -           | -       | ✓       | -       | -         | -       |
| payments:refund                | ✓           | -           | -       | ✓       | -       | -         | -       |
| **Devices**                    |             |             |         |         |         |           |         |
| devices:read                   | ✓           | ✓           | ✓       | -       | -       | ✓         | -       |
| devices:create                 | ✓           | -           | -       | -       | -       | ✓         | -       |
| devices:update                 | ✓           | ✓           | -       | -       | -       | ✓         | -       |
| devices:delete                 | ✓           | -           | -       | -       | -       | ✓         | -       |
| devices:lock                   | ✓           | ✓           | -       | -       | -       | -         | -       |
| devices:unlock                 | ✓           | ✓           | -       | -       | -       | -         | -       |
| devices:handover               | ✓           | ✓           | -       | -       | -       | ✓         | -       |
| **Distributors**               |             |             |         |         |         |           |         |
| distributors:read              | ✓           | ✓           | -       | -       | -       | ✓         | -       |
| distributors:write             | ✓           | ✓           | -       | -       | -       | ✓         | -       |
| **Notifications**              |             |             |         |         |         |           |         |
| notifications:send             | ✓           | ✓           | ✓       | -       | -       | -         | -       |
| **Reports**                    |             |             |         |         |         |           |         |
| reports:read                   | ✓           | ✓           | -       | ✓       | -       | -         | ✓       |
| reports:export                 | ✓           | -           | -       | ✓       | -       | -         | ✓       |
| **Admin Users**                |             |             |         |         |         |           |         |
| admin_users:read               | ✓           | -           | -       | -       | -       | -         | -       |
| admin_users:create             | ✓           | -           | -       | -       | -       | -         | -       |
| admin_users:update             | ✓           | -           | -       | -       | -       | -         | -       |
| admin_users:delete             | ✓           | -           | -       | -       | -       | -         | -       |
| **System**                     |             |             |         |         |         |           |         |
| system:configure               | ✓           | -           | -       | -       | -       | -         | -       |

*KYC Reviewer can only update KYC status fields
```

---

## 4. Database Schema

### 4.1 Admin Users Table

```sql
-- Admin users table (extends Supabase auth.users)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role admin_role NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  phone_number VARCHAR(20),
  department VARCHAR(100),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id),
  last_login_at TIMESTAMPTZ,

  -- Security
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  notes TEXT,

  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT valid_role CHECK (role IN (
    'super_admin',
    'operations_manager',
    'customer_support',
    'finance_team',
    'kyc_reviewer',
    'inventory_manager',
    'reports_viewer'
  ))
);

-- Enum for admin roles
CREATE TYPE admin_role AS ENUM (
  'super_admin',
  'operations_manager',
  'customer_support',
  'finance_team',
  'kyc_reviewer',
  'inventory_manager',
  'reports_viewer'
);

-- Indexes
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_status ON admin_users(status);
CREATE INDEX idx_admin_users_email ON admin_users(email);
```

### 4.2 Audit Log Table

```sql
-- Comprehensive audit log for all admin actions
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor information
  admin_user_id UUID NOT NULL REFERENCES admin_users(id),
  admin_email VARCHAR(255) NOT NULL,
  admin_role admin_role NOT NULL,

  -- Action details
  action VARCHAR(100) NOT NULL, -- e.g., 'loan:approve', 'customer:update'
  resource_type VARCHAR(50) NOT NULL, -- e.g., 'loan', 'customer', 'device'
  resource_id UUID, -- ID of affected resource

  -- Context
  description TEXT,
  ip_address INET,
  user_agent TEXT,

  -- Data
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,

  -- Result
  status VARCHAR(20) NOT NULL, -- 'success', 'failure', 'error'
  error_message TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('success', 'failure', 'error'))
);

-- Indexes for fast audit queries
CREATE INDEX idx_audit_admin_user ON admin_audit_logs(admin_user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_action ON admin_audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_status ON admin_audit_logs(status);

-- Partitioning by month for performance (optional, for high volume)
-- ALTER TABLE admin_audit_logs PARTITION BY RANGE (created_at);
```

### 4.3 Permission Overrides Table (Optional)

```sql
-- For custom permission overrides beyond role defaults
CREATE TABLE admin_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  granted BOOLEAN NOT NULL, -- true = grant, false = revoke
  reason TEXT,
  granted_by UUID REFERENCES admin_users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(admin_user_id, permission)
);

CREATE INDEX idx_permission_overrides_user ON admin_permission_overrides(admin_user_id);
```

---

## 5. Row Level Security (RLS) Policies

### 5.1 Supabase RLS Policies

```sql
-- Enable RLS on admin tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Admin users can read their own profile
CREATE POLICY "Admin users can read own profile"
ON admin_users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Only super admins can manage other admin users
CREATE POLICY "Super admins can manage admin users"
ON admin_users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
  )
);

-- All active admins can read audit logs
CREATE POLICY "Active admins can read audit logs"
ON admin_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND status = 'active'
  )
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (admin_user_id = auth.uid());
```

---

## 6. Permission Checking Implementation

### 6.1 Permission Middleware

```typescript
// lib/permissions/middleware.ts
import { createServerClient } from '@/lib/supabase/server';
import { Permission } from '@/types/permissions';

export async function checkPermission(
  permission: Permission
): Promise<boolean> {
  const supabase = createServerClient();

  // Get current admin user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Get admin profile with role
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!adminUser || adminUser.status !== 'active') {
    return false;
  }

  // Super admin has all permissions
  if (adminUser.role === 'super_admin') {
    return true;
  }

  // Check role permissions
  const roleDefinition = ROLE_DEFINITIONS[adminUser.role];
  const hasPermission = roleDefinition.permissions.includes(permission) ||
                        roleDefinition.permissions.includes('*');

  if (!hasPermission) {
    return false;
  }

  // Check for permission overrides
  const { data: override } = await supabase
    .from('admin_permission_overrides')
    .select('granted, expires_at')
    .eq('admin_user_id', user.id)
    .eq('permission', permission)
    .maybeSingle();

  if (override) {
    // Check if override is expired
    if (override.expires_at && new Date(override.expires_at) < new Date()) {
      return hasPermission;
    }
    return override.granted;
  }

  return hasPermission;
}

// Check multiple permissions (OR logic)
export async function checkAnyPermission(
  permissions: Permission[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await checkPermission(permission)) {
      return true;
    }
  }
  return false;
}

// Check multiple permissions (AND logic)
export async function checkAllPermissions(
  permissions: Permission[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await checkPermission(permission))) {
      return false;
    }
  }
  return true;
}
```

### 6.2 API Route Protection

```typescript
// app/api/loans/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/permissions/middleware';
import { logAdminAction } from '@/lib/audit/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check permission
    const hasPermission = await checkPermission('loans:approve');

    if (!hasPermission) {
      await logAdminAction({
        action: 'loans:approve',
        resourceType: 'loan',
        resourceId: params.id,
        status: 'failure',
        errorMessage: 'Permission denied'
      });

      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Process loan approval
    const body = await request.json();

    // ... approval logic ...

    // Log successful action
    await logAdminAction({
      action: 'loans:approve',
      resourceType: 'loan',
      resourceId: params.id,
      status: 'success',
      newValues: body,
      metadata: { approvalAmount: body.amount }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    await logAdminAction({
      action: 'loans:approve',
      resourceType: 'loan',
      resourceId: params.id,
      status: 'error',
      errorMessage: error.message
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 6.3 UI Component Permission Guard

```typescript
// components/shared/PermissionGuard.tsx
'use client';

import { usePermission } from '@/lib/hooks/usePermission';
import { Permission } from '@/types/permissions';

interface PermissionGuardProps {
  permission: Permission | Permission[];
  requireAll?: boolean; // If true, requires all permissions (AND). Default: false (OR)
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  permission,
  requireAll = false,
  children,
  fallback = null
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = usePermission(permission, requireAll);

  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 h-8 rounded" />;
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage example
<PermissionGuard permission="loans:approve">
  <Button onClick={handleApprove}>Approve Loan</Button>
</PermissionGuard>

<PermissionGuard
  permission={['payments:reconcile', 'payments:refund']}
  requireAll={true}
>
  <RefundButton />
</PermissionGuard>
```

---

## 7. Audit Logging

### 7.1 Audit Logger Implementation

```typescript
// lib/audit/logger.ts
import { createServerClient } from '@/lib/supabase/server';

interface AuditLogInput {
  action: string;
  resourceType: string;
  resourceId?: string;
  description?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  status: 'success' | 'failure' | 'error';
  errorMessage?: string;
}

export async function logAdminAction(input: AuditLogInput) {
  const supabase = createServerClient();

  // Get current admin user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('email, role')
    .eq('id', user.id)
    .single();

  if (!adminUser) return;

  // Get request context (from headers)
  const headers = await import('next/headers');
  const headersList = headers.headers();
  const ipAddress = headersList.get('x-forwarded-for') ||
                    headersList.get('x-real-ip');
  const userAgent = headersList.get('user-agent');

  // Insert audit log
  await supabase.from('admin_audit_logs').insert({
    admin_user_id: user.id,
    admin_email: adminUser.email,
    admin_role: adminUser.role,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    description: input.description,
    ip_address: ipAddress,
    user_agent: userAgent,
    old_values: input.oldValues,
    new_values: input.newValues,
    metadata: input.metadata,
    status: input.status,
    error_message: input.errorMessage
  });
}
```

### 7.2 Automatic Audit Logging

```typescript
// lib/audit/decorator.ts
import { logAdminAction } from './logger';

// Decorator for automatic audit logging
export function AuditLog(action: string, resourceType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);

        await logAdminAction({
          action,
          resourceType,
          resourceId: args[0]?.id,
          newValues: args[0],
          status: 'success',
          metadata: {
            executionTime: Date.now() - startTime
          }
        });

        return result;
      } catch (error) {
        await logAdminAction({
          action,
          resourceType,
          resourceId: args[0]?.id,
          status: 'error',
          errorMessage: error.message
        });

        throw error;
      }
    };

    return descriptor;
  };
}

// Usage
class LoanService {
  @AuditLog('loans:approve', 'loan')
  async approveLoan(loanId: string, data: any) {
    // ... approval logic ...
  }
}
```

---

## 8. UI Role-Based Visibility

### 8.1 Navigation Menu Filtering

```typescript
// components/dashboard/Sidebar.tsx
'use client';

import { useAdminUser } from '@/lib/hooks/useAdminUser';
import { checkRoleAccess } from '@/lib/permissions/utils';

const NAVIGATION_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    requiredPermissions: []
  },
  {
    label: 'Customers',
    href: '/dashboard/customers',
    icon: UsersIcon,
    requiredPermissions: ['customers:read']
  },
  {
    label: 'Loans',
    href: '/dashboard/loans',
    icon: CreditCardIcon,
    requiredPermissions: ['loans:read']
  },
  {
    label: 'KYC Review',
    href: '/dashboard/kyc-review',
    icon: ShieldCheckIcon,
    requiredPermissions: ['kyc:read']
  },
  {
    label: 'Devices',
    href: '/dashboard/devices',
    icon: DevicePhoneMobileIcon,
    requiredPermissions: ['devices:read']
  },
  {
    label: 'Distributors',
    href: '/dashboard/distributors',
    icon: StoreIcon,
    requiredPermissions: ['distributors:read']
  },
  {
    label: 'Payments',
    href: '/dashboard/payments',
    icon: BanknotesIcon,
    requiredPermissions: ['payments:read']
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: ChartBarIcon,
    requiredPermissions: ['reports:read']
  },
  {
    label: 'Admin Users',
    href: '/dashboard/admin-users',
    icon: UserGroupIcon,
    requiredPermissions: ['admin_users:read']
  }
];

export function Sidebar() {
  const { adminUser, hasPermission } = useAdminUser();

  const visibleItems = NAVIGATION_ITEMS.filter(item => {
    if (item.requiredPermissions.length === 0) return true;
    return item.requiredPermissions.some(perm => hasPermission(perm));
  });

  return (
    <nav className="space-y-1">
      {visibleItems.map(item => (
        <SidebarItem key={item.href} {...item} />
      ))}
    </nav>
  );
}
```

---

## 9. Security Best Practices

### 9.1 Password Requirements

```typescript
// Password policy for admin users
const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventReuse: 5, // Cannot reuse last 5 passwords
  expiryDays: 90 // Force password change every 90 days
};
```

### 9.2 Session Management

```typescript
// Session timeout: 8 hours
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000;

// Idle timeout: 30 minutes
const IDLE_TIMEOUT = 30 * 60 * 1000;

// Failed login lockout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
```

### 9.3 Multi-Factor Authentication (MFA)

```typescript
// MFA requirement by role
const MFA_REQUIREMENTS = {
  super_admin: 'required',
  operations_manager: 'required',
  finance_team: 'required',
  kyc_reviewer: 'optional',
  customer_support: 'optional',
  inventory_manager: 'optional',
  reports_viewer: 'optional'
};
```

---

## 10. Testing Strategy

### 10.1 Permission Tests

```typescript
// __tests__/permissions.test.ts
import { checkPermission } from '@/lib/permissions/middleware';
import { ROLE_DEFINITIONS } from '@/lib/permissions/roles';

describe('Permission System', () => {
  it('super admin should have all permissions', async () => {
    // Mock user as super_admin
    expect(await checkPermission('loans:approve')).toBe(true);
    expect(await checkPermission('admin_users:delete')).toBe(true);
  });

  it('operations manager should approve loans but not create admin users', async () => {
    // Mock user as operations_manager
    expect(await checkPermission('loans:approve')).toBe(true);
    expect(await checkPermission('admin_users:create')).toBe(false);
  });

  it('customer support should only have read permissions', async () => {
    // Mock user as customer_support
    expect(await checkPermission('customers:read')).toBe(true);
    expect(await checkPermission('customers:update')).toBe(false);
    expect(await checkPermission('loans:approve')).toBe(false);
  });
});
```

---

## 11. Implementation Checklist

- [ ] Create admin_users table with role field
- [ ] Create admin_audit_logs table with partitioning
- [ ] Create admin_permission_overrides table
- [ ] Implement RLS policies on all admin tables
- [ ] Create permission checking middleware
- [ ] Implement audit logging system
- [ ] Build PermissionGuard React component
- [ ] Create usePermission and useAdminUser hooks
- [ ] Add role-based navigation filtering
- [ ] Implement API route protection
- [ ] Set up password policy enforcement
- [ ] Configure session timeout and idle detection
- [ ] Add MFA setup for required roles
- [ ] Create admin user management UI
- [ ] Build audit log viewer
- [ ] Write permission system tests
- [ ] Document role assignment workflow
- [ ] Create admin onboarding guide

---

## 12. Future Enhancements

1. **Attribute-Based Access Control (ABAC)**: Fine-grained permissions based on attributes (e.g., "approve loans under $300")
2. **Time-Based Permissions**: Temporary permission grants with auto-expiry
3. **Approval Workflows**: Multi-step approvals for sensitive operations
4. **IP Whitelisting**: Restrict admin access to specific IP ranges
5. **Anomaly Detection**: Alert on unusual admin behavior patterns
6. **Permission Analytics**: Track which permissions are actually used
7. **Role Templates**: Pre-configured role templates for common scenarios

---

**Document Status**: Complete
**Last Updated**: November 27, 2025
**Next Review**: Phase 2 Planning
