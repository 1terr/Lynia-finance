/**
 * Notification Utilities
 *
 * Shared helpers for creating in-app notifications and sending
 * transfer-related email notifications via AWS SES.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import logger from './logger';

// ─── SES email infrastructure ───

/** Lazy singleton SES client */
let sesClient: SESClient | null = null;

function getSesClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({});
  }
  return sesClient;
}

const SES_SENDER_EMAIL = process.env.SES_SENDER_EMAIL || 'noreply@lynia.finance';

/**
 * Mask an email address for safe logging.
 * Example: "john.doe@example.com" -> "joh***@example.com"
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, 3);
  return `${visible}***@${domain}`;
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Build an HTML email body for transfer notifications.
 */
function buildTransferEmailHtml(params: {
  distributorName: string;
  transferType: string;
  deviceInfo: string;
  transferId: string;
}): string {
  const safe = {
    distributorName: escapeHtml(params.distributorName),
    transferType: escapeHtml(params.transferType),
    deviceInfo: escapeHtml(params.deviceInfo),
    transferId: escapeHtml(params.transferId),
  };
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background-color:#1a56db;padding:24px 32px;">
            <h1 style="color:#ffffff;margin:0;font-size:20px;">Lynia Finance</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="color:#1f2937;margin:0 0 16px;">Transfer Notification</h2>
            <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
              Hello <strong>${safe.distributorName}</strong>,
            </p>
            <table width="100%" cellpadding="12" cellspacing="0" style="background-color:#f9fafb;border-radius:6px;margin:0 0 24px;">
              <tr>
                <td style="color:#6b7280;border-bottom:1px solid #e5e7eb;">Transfer Type</td>
                <td style="color:#1f2937;border-bottom:1px solid #e5e7eb;font-weight:600;">${safe.transferType}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;border-bottom:1px solid #e5e7eb;">Device</td>
                <td style="color:#1f2937;border-bottom:1px solid #e5e7eb;font-weight:600;">${safe.deviceInfo}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;">Reference</td>
                <td style="color:#1f2937;font-weight:600;">${safe.transferId}</td>
              </tr>
            </table>
            <p style="color:#4b5563;line-height:1.6;margin:0;">
              Please log in to your dashboard to review and take action on this transfer.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:16px 32px;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">
              &copy; Lynia Finance. Advancing financial inclusion in Africa.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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
 * Send a transfer-related email notification via AWS SES.
 *
 * Best-effort delivery: logs errors but never throws, so email
 * failures do not block the transfer workflow.
 */
export async function sendTransferEmail(params: {
  to: string;
  distributorName: string;
  transferType: string;
  deviceInfo: string;
  transferId: string;
}): Promise<void> {
  const maskedTo = maskEmail(params.to);

  logger.info('Sending transfer email notification', {
    action: 'notification.email.send',
    status: 'started',
    email: maskedTo,
    transferType: params.transferType,
    transferId: params.transferId,
  });

  try {
    const subject = `Lynia Finance — Transfer ${params.transferType}: ${params.deviceInfo}`;

    const textBody = [
      `Hello ${params.distributorName},`,
      '',
      `A transfer event has occurred that requires your attention.`,
      '',
      `Transfer Type: ${params.transferType}`,
      `Device: ${params.deviceInfo}`,
      `Reference: ${params.transferId}`,
      '',
      'Please log in to your dashboard to review and take action.',
      '',
      '— Lynia Finance',
    ].join('\n');

    const htmlBody = buildTransferEmailHtml(params);

    const command = new SendEmailCommand({
      Source: SES_SENDER_EMAIL,
      Destination: {
        ToAddresses: [params.to],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: textBody },
          Html: { Data: htmlBody },
        },
      },
    });

    const response = await getSesClient().send(command);

    logger.info('Transfer email sent successfully', {
      action: 'notification.email.send',
      status: 'completed',
      email: maskedTo,
      messageId: response.MessageId,
      transferId: params.transferId,
    });
  } catch (error) {
    // Best-effort: log and continue — email failure must not block transfers
    logger.error('Transfer email send failed', {
      action: 'notification.email.send',
      status: 'failed',
      email: maskedTo,
      transferId: params.transferId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
