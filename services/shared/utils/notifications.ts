/**
 * Notification Utilities
 *
 * Shared helpers for creating in-app notifications and sending
 * transfer-related email notifications (email is stubbed until
 * SES infrastructure is ready).
 */

import logger from './logger';

/**
 * Parameters for creating an in-app notification.
 */
interface CreateNotificationParams {
  recipient_type: 'admin' | 'distributor';
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: string;
}

/**
 * Insert a notification into the notifications table.
 *
 * @param tx - Transaction query function (from withTransaction) or raw query
 * @param params - Notification fields
 */
export async function createNotification(
  tx: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ data: T[]; error: Error | null }>,
  params: CreateNotificationParams
): Promise<void> {
  await tx(
    `INSERT INTO notifications
       (recipient_type, recipient_id, type, title, message, reference_type, reference_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      params.recipient_type,
      params.recipient_id,
      params.type,
      params.title,
      params.message,
      params.reference_type || null,
      params.reference_id || null,
    ]
  );
}

/**
 * Create a notification for admins about a transfer event.
 * Sends to all admin users (recipient_id = 'all' by convention;
 * the frontend filters by recipient_type = 'admin').
 */
export async function notifyAdminsOfTransferEvent(
  tx: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ data: T[]; error: Error | null }>,
  opts: {
    type: string;
    title: string;
    message: string;
    transferId: string;
  }
): Promise<void> {
  await createNotification(tx, {
    recipient_type: 'admin',
    recipient_id: 'all',
    type: opts.type,
    title: opts.title,
    message: opts.message,
    reference_type: 'stock_transfer',
    reference_id: opts.transferId,
  });
}

/**
 * Create a notification for a specific distributor about a transfer event.
 */
export async function notifyDistributorOfTransferEvent(
  tx: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ data: T[]; error: Error | null }>,
  opts: {
    distributorId: string;
    type: string;
    title: string;
    message: string;
    transferId: string;
  }
): Promise<void> {
  await createNotification(tx, {
    recipient_type: 'distributor',
    recipient_id: opts.distributorId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    reference_type: 'stock_transfer',
    reference_id: opts.transferId,
  });
}

/**
 * Send a transfer-related email notification.
 *
 * Stub implementation — logs the email intent. Actual SES integration
 * will be added when email infrastructure is ready.
 */
export async function sendTransferEmail(params: {
  to: string;
  distributorName: string;
  transferType: string;
  deviceInfo: string;
  transferId: string;
}): Promise<void> {
  // TODO: Integrate with SES when email infrastructure is ready
  logger.info('Transfer email notification queued', {
    action: 'notification.email.queued',
    to: params.to,
    distributorName: params.distributorName,
    transferType: params.transferType,
    deviceInfo: params.deviceInfo,
    transferId: params.transferId,
  });
}
