import { createHash } from 'crypto';
import { db } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import { AuthContext } from '../../../shared/middleware/authorization';

export const COGNITO_ADMIN_ROLES = ['super_admin', 'admin'];

/** Map DB admin_users row to the frontend AdminUser shape. */
export function mapAdminUser(row: Record<string, unknown>) {
  const fullName = (row.full_name as string) || '';
  const parts = fullName.split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  return {
    id: row.id,
    email: row.email,
    first_name: firstName,
    last_name: lastName,
    role: row.role,
    is_active: row.status === 'active',
    department: row.department || null,
    phone_number: row.phone_number || null,
    last_login_at: row.last_login_at || null,
    login_count: row.login_count || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Record an action in the audit_log table. */
export async function auditLog(
  auth: AuthContext,
  action: string,
  entityType: string,
  entityId: string | null,
  description: string,
  changes?: Record<string, unknown>
) {
  try {
    await db.from('audit_log').insert({
      user_id: auth.userId,
      user_type: 'admin',
      user_email: auth.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      changes: changes ? JSON.stringify(changes) : null,
      created_at: new Date().toISOString(),
    }).execute();
  } catch (err) {
    logger.error('Failed to write audit log', {
      action: 'admin.auditLog',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

export function hashNationalId(nationalId: string): string {
  return createHash('sha256').update(nationalId).digest('hex');
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\+?\d{3})\d{4}(\d{3})/, '$1****$2');
}

/** Map audit log action to frontend event_type for icon rendering */
export function mapActionToEventType(action: string): string {
  if (action.includes('create') || action.includes('register')) return 'create';
  if (action.includes('approve')) return 'approve';
  if (action.includes('reject')) return 'reject';
  if (action.includes('payment') || action.includes('repayment')) return 'payment';
  if (action.includes('lock')) return 'lock';
  if (action.includes('unlock')) return 'unlock';
  if (action.includes('login')) return 'login';
  return 'update';
}
