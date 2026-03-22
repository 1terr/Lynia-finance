/**
 * Sync Scheduler Module
 *
 * Scheduling, queue management, and sync logging for Fineract sync operations.
 * Handles SQS-based retry with exponential backoff.
 */

import { db } from '../database';
import { SQSQueues } from '../../utils/sqs-publisher';
import { logger } from '../../utils/logger';

// ============================================================
// SYNC LOGGING
// ============================================================

export interface SyncLogEntry {
  entity_type: string;
  entity_id: string;
  fineract_id?: number;
  operation: string;
  direction: string;
  status: string;
  request_payload?: unknown;
  response_payload?: unknown;
  error_message?: string;
  http_status_code?: number;
  duration_ms?: number;
  lambda_request_id?: string;
}

/**
 * Queue a failed sync for SQS-based retry with exponential backoff.
 * Non-blocking -- errors are caught and logged.
 */
export async function queueSyncRetry(entry: {
  entityType: string;
  entityId: string;
  operation: string;
  requestPayload: Record<string, unknown>;
  errorMessage: string;
}): Promise<void> {
  try {
    await SQSQueues.retryFineractSync({
      entityType: entry.entityType,
      entityId: entry.entityId,
      operation: entry.operation,
      requestPayload: entry.requestPayload,
      retryCount: 0,
      originalError: entry.errorMessage,
    });
    logger.info('Queued SQS retry', { action: 'fineract_sync.queue_retry', entityType: entry.entityType, operation: entry.operation, entityId: entry.entityId });
  } catch (sqsError) {
    // SQS publish failure is non-fatal; reconciliation job is the safety net
    logger.error('Failed to queue SQS retry', { action: 'fineract_sync.queue_retry', error: sqsError instanceof Error ? sqsError.message : String(sqsError) });
  }
}

/**
 * Write a sync log entry to the database.
 * Non-blocking -- logging failures never propagate.
 */
export async function logSync(entry: SyncLogEntry): Promise<void> {
  try {
    await db
      .from('fineract_sync_log')
      .insert({
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        fineract_id: entry.fineract_id,
        operation: entry.operation,
        direction: entry.direction,
        status: entry.status,
        request_payload: entry.request_payload ? JSON.stringify(entry.request_payload) : null,
        response_payload: entry.response_payload ? JSON.stringify(entry.response_payload) : null,
        error_message: entry.error_message,
        http_status_code: entry.http_status_code,
        duration_ms: entry.duration_ms,
        completed_at: entry.status === 'success' ? new Date().toISOString() : null,
        lambda_request_id: entry.lambda_request_id || process.env.AWS_LAMBDA_LOG_STREAM_NAME,
      })
      .execute();
  } catch (logError) {
    // Never let sync logging failures propagate
    logger.error('Failed to write sync log', { action: 'fineract_sync.log', error: logError instanceof Error ? logError.message : String(logError) });
  }
}
