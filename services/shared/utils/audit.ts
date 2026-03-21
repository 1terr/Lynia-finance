/**
 * Shared audit logging utilities for customer-facing and system operations.
 *
 * The admin-service has its own auditLog() helper that requires AuthContext
 * (see services/admin-service/src/handlers/helpers.ts). This module provides
 * a lightweight variant for non-admin contexts (WhatsApp commands, scheduled
 * jobs, system events) where there is no authenticated admin user.
 */

import { db } from '../clients/database';
import logger from './logger';

interface AuditLogEntry {
  /** Who performed the action: customer ID, 'system', or admin user ID */
  userId: string;
  /** Type of actor: 'customer', 'system', or 'admin' */
  userType: 'customer' | 'system' | 'admin';
  /** Dot-separated action identifier, e.g. 'payment.initiated', 'loan.defaulted' */
  action: string;
  /** Type of entity affected, e.g. 'loan', 'payment', 'device' */
  entityType: string;
  /** ID of the entity affected */
  entityId: string | null;
  /** Human-readable description of the action */
  description: string;
  /** Optional structured data about what changed */
  changes?: Record<string, unknown>;
}

/**
 * Write an audit log entry for customer-facing or system operations.
 * Non-blocking: errors are logged but never thrown.
 */
export async function auditLogEntry(entry: AuditLogEntry): Promise<void> {
  try {
    await db.from('audit_log').insert({
      user_id: entry.userId,
      user_type: entry.userType,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      description: entry.description,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
      created_at: new Date().toISOString(),
    }).execute();
  } catch (err) {
    logger.error('Failed to write audit log', {
      action: 'audit.write_failed',
      status: 'failed',
      originalAction: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
