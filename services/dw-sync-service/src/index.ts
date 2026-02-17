/**
 * DW Sync Service
 *
 * Processes real-time business events from SQS and incrementally
 * updates the data warehouse (dw schema) tables. This replaces the
 * nightly-only ETL for core fact tables, enabling real-time analytics.
 *
 * Event types:
 *   payment.confirmed    → Upsert fact_payment + update fact_loan
 *   loan.created         → Upsert fact_loan + ensure dimensions
 *   loan.disbursed       → Upsert fact_loan
 *   loan.status_changed  → Upsert fact_loan
 *   loan.written_off     → Upsert fact_loan
 *   kyc.completed        → Upsert fact_kyc + update dim_customer
 *   credit.scored        → Upsert fact_credit_decision
 *
 * The nightly ETL still runs as a reconciliation safety net.
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import logger from '../../shared/utils/logger';
import { syncPayment } from './handlers/sync-payment';
import { syncLoan } from './handlers/sync-loan';
import { syncKYC } from './handlers/sync-kyc';
import { syncCreditDecision } from './handlers/sync-credit-decision';

interface DWSyncEvent {
  eventType: string;
  entityId: string;
  entityType: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

const LOAN_EVENTS = ['loan.created', 'loan.disbursed', 'loan.status_changed', 'loan.written_off'];

async function processRecord(record: SQSRecord): Promise<void> {
  const event: DWSyncEvent = JSON.parse(record.body);
  const op = logger.startOperation(`dw-sync.${event.eventType}`);

  try {
    logger.info('Processing DW sync event', {
      action: `dw-sync.${event.eventType}`,
      status: 'started',
      metadata: { entityId: event.entityId, entityType: event.entityType },
    });

    if (event.eventType === 'payment.confirmed') {
      await syncPayment(event.entityId);
    } else if (LOAN_EVENTS.includes(event.eventType)) {
      await syncLoan(event.entityId);
    } else if (event.eventType === 'kyc.completed') {
      await syncKYC(event.entityId);
    } else if (event.eventType === 'credit.scored') {
      await syncCreditDecision(event.entityId);
    } else {
      logger.warn('Unknown DW sync event type', {
        action: 'dw-sync.unknown',
        status: 'completed',
        metadata: { eventType: event.eventType },
      });
      return;
    }

    op.succeed({ entityId: event.entityId });
  } catch (error) {
    op.fail(error);
    throw error; // Re-throw to let SQS retry
  }
}

export const handler = async (event: SQSEvent): Promise<void> => {
  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    logger.error('DW sync batch had failures', {
      action: 'dw-sync.batch',
      status: 'failed',
      metadata: {
        total: results.length,
        failed: failures.length,
        succeeded: results.length - failures.length,
      },
    });
    // Throw to signal partial batch failure — SQS will retry failed messages
    throw new Error(`${failures.length}/${results.length} DW sync events failed`);
  }
};
