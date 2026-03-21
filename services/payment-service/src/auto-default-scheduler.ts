import { db, query } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

interface AutoDefaultResult {
  processed: number;
  defaulted: number;
  errors: number;
  loanIds: string[];
}

/**
 * Auto-default loans that are 90+ days past due.
 * Runs daily via EventBridge cron (7am CAT / 5am UTC).
 * Idempotent: skips loans already in 'defaulted' status.
 */
export async function processAutoDefaults(): Promise<AutoDefaultResult> {
  const result: AutoDefaultResult = { processed: 0, defaulted: 0, errors: 0, loanIds: [] };

  logger.info('Starting auto-default scheduler', { action: 'auto-default.start' });

  try {
    // Find loans 90+ days past due that haven't been defaulted yet
    const { data: overdueLoans } = await query<{
      id: string;
      customer_id: string;
      loan_number: string;
      product_category: string;
      outstanding_balance_usd: number;
      next_payment_date: string;
    }>(
      `SELECT l.id, l.customer_id, l.loan_number, l.product_category,
              l.outstanding_balance_usd, l.next_payment_date
       FROM loans l
       WHERE l.status IN ('active', 'delinquent')
         AND l.next_payment_date IS NOT NULL
         AND l.next_payment_date < NOW() - INTERVAL '90 days'
         AND l.outstanding_balance_usd > 0
         AND l.deleted_at IS NULL
       ORDER BY l.next_payment_date ASC`,
      []
    );

    if (!overdueLoans || overdueLoans.length === 0) {
      logger.info('No loans eligible for auto-default', { action: 'auto-default.complete' });
      return result;
    }

    logger.info('Found loans eligible for auto-default', {
      action: 'auto-default.found',
      count: overdueLoans.length,
    });

    const sqs = new SQSClient({});

    for (const loan of overdueLoans) {
      result.processed++;

      try {
        // Update loan status to defaulted
        await db
          .from('loans')
          .update({
            status: 'defaulted',
            defaulted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', loan.id)
          .execute();

        result.defaulted++;
        result.loanIds.push(loan.id);

        logger.info('Loan auto-defaulted', {
          action: 'auto-default.defaulted',
          loanId: loan.id,
          loanNumber: loan.loan_number,
          productCategory: loan.product_category,
          outstandingBalance: loan.outstanding_balance_usd,
          daysPastDue: Math.floor(
            (Date.now() - new Date(loan.next_payment_date).getTime()) / (1000 * 60 * 60 * 24)
          ),
        });

        // Queue device lock for smartphone loans
        if (loan.product_category === 'smartphone') {
          try {
            const queueUrl = process.env.DEVICE_LOCK_QUEUE_URL;
            if (queueUrl) {
              await sqs.send(new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify({
                  action: 'lock',
                  loan_id: loan.id,
                  customer_id: loan.customer_id,
                  reason: 'auto_default_90_days',
                }),
              }));
            }
          } catch (lockError) {
            logger.error('Failed to queue device lock for defaulted loan', {
              action: 'auto-default.lock-queue-failed',
              loanId: loan.id,
              errorMessage: lockError instanceof Error ? lockError.message : String(lockError),
            });
          }
        }

        // Queue default notification
        try {
          const notificationQueueUrl = process.env.NOTIFICATION_QUEUE_URL;
          if (notificationQueueUrl) {
            await sqs.send(new SendMessageCommand({
              QueueUrl: notificationQueueUrl,
              MessageBody: JSON.stringify({
                type: 'loan_defaulted',
                loan_id: loan.id,
                customer_id: loan.customer_id,
                outstanding_balance: loan.outstanding_balance_usd,
              }),
            }));
          }
        } catch (notifError) {
          logger.error('Failed to queue default notification', {
            action: 'auto-default.notification-failed',
            loanId: loan.id,
            errorMessage: notifError instanceof Error ? notifError.message : String(notifError),
          });
        }

        // Create audit log entry
        try {
          await db.from('audit_log').insert({
            user_id: 'system',
            user_type: 'system',
            action: 'loan.auto_defaulted',
            entity_type: 'loan',
            entity_id: loan.id,
            description: `Loan ${loan.loan_number} auto-defaulted after 90+ days past due`,
            changes: JSON.stringify({
              loan_number: loan.loan_number,
              outstanding_balance: loan.outstanding_balance_usd,
              product_category: loan.product_category,
            }),
            created_at: new Date().toISOString(),
          }).execute();
        } catch (auditError) {
          // Non-blocking: audit log failure shouldn't stop processing
          logger.error('Failed to create audit log', {
            action: 'auto-default.audit-failed',
            loanId: loan.id,
          });
        }

      } catch (loanError) {
        result.errors++;
        logger.error('Failed to auto-default loan', {
          action: 'auto-default.loan-failed',
          loanId: loan.id,
          errorMessage: loanError instanceof Error ? loanError.message : String(loanError),
        });
      }
    }

  } catch (error) {
    logger.error('Auto-default scheduler failed', {
      action: 'auto-default.error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  logger.info('Auto-default scheduler completed', {
    action: 'auto-default.complete',
    ...result,
  });

  return result;
}
