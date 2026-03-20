import { db } from '../../shared/clients/database';
import { TrustonicProvider } from './trustonic-provider';
import logger from '../../shared/utils/logger';

/**
 * Lock Trigger
 */
export interface LockTrigger {
  trigger_id: string;
  loan_id: string;
  customer_id: string;
  device_id: string;
  trigger_type: 'missed_payment' | 'severe_default' | 'fraud' | 'theft';
  severity: 'warning' | 'lock';
  triggered_at: Date;
  grace_period_until: Date;
  lock_scheduled_at: Date;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
}

/**
 * Lock Event
 */
export interface LockEvent {
  id: string;
  device_id: string;
  action: 'lock' | 'unlock';
  reason: string;
  performed_by: 'system' | 'admin' | 'customer_payment';
  admin_user_id?: string;
  executed_at: Date;
  execution_status: 'success' | 'failed';
  error_message?: string;
  lock_provider: 'trustonic';
}

/**
 * Lock Management Service
 * Handles automated device lock/unlock workflows
 */
export class LockManagementService {
  private trustonic: TrustonicProvider;

  constructor() {
    this.trustonic = new TrustonicProvider();

    logger.info('LockManagementService initialized', { action: 'lock.management.init' });
  }

  /**
   * Lock device (via Trustonic)
   */
  async lockDevice(
    deviceId: string,
    reason: string,
    performedBy: 'system' | 'admin' | 'customer_payment' = 'system',
    adminUserId?: string
  ): Promise<void> {
    try {
      logger.info('Locking device', { action: 'lock.management.lockDevice', deviceId, reason });

      // Get device details
      const { data: device, error: deviceError } = await db
        .from('devices')
        .select('*, customers(*)')
        .eq('id', deviceId)
        .single()
        .execute();

      if (deviceError || !device) {
        throw new Error('Device not found');
      }

      // Check if already locked
      if (device.lock_status === 'locked') {
        logger.info('Device already locked', { action: 'lock.management.lockDevice', deviceId });
        return;
      }

      // Check if enrolled with Trustonic
      if (!device.trustonic_device_id) {
        throw new Error('Device not enrolled with Trustonic');
      }

      // Lock via Trustonic API
      const lockMessage = this.trustonic.generateLockMessage(reason);
      await this.trustonic.lockDevice({
        device_id: device.trustonic_device_id,
        imei: device.imei,
        lock_message: lockMessage,
        lock_reason: reason,
        allow_emergency_calls: true,
        emergency_numbers: this.trustonic.getEmergencyNumbers()
      });

      // Update device status in database
      await db
        .from('devices')
        .update({
          lock_status: 'locked',
          locked_at: new Date().toISOString(),
          lock_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId)
        .execute();

      // Create lock event record
      await db
        .from('device_lock_history')
        .insert({
          device_id: deviceId,
          action: 'lock',
          reason: reason,
          performed_by: performedBy,
          admin_user_id: adminUserId,
          execution_status: 'success',
          lock_provider: 'trustonic',
          created_at: new Date().toISOString()
        })
        .execute();

      logger.info('Device locked successfully', { action: 'lock.management.lockDevice', deviceId });

    } catch (error) {
      logger.error('Error locking device', { action: 'lock.management.lockDevice', deviceId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

      // Create failed lock event
      await db
        .from('device_lock_history')
        .insert({
          device_id: deviceId,
          action: 'lock',
          reason: reason,
          performed_by: performedBy,
          admin_user_id: adminUserId,
          execution_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          lock_provider: 'trustonic',
          created_at: new Date().toISOString()
        })
        .execute();

      throw error;
    }
  }

  /**
   * Unlock device (via Trustonic)
   */
  async unlockDevice(
    deviceId: string,
    reason: string,
    performedBy: 'system' | 'admin' | 'customer_payment' = 'system',
    adminUserId?: string
  ): Promise<void> {
    try {
      logger.info('Unlocking device', { action: 'lock.management.unlockDevice', deviceId, reason });

      // Get device details
      const { data: device, error: deviceError } = await db
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .single()
        .execute();

      if (deviceError || !device) {
        throw new Error('Device not found');
      }

      // Check if already unlocked
      if (device.lock_status === 'unlocked') {
        logger.info('Device already unlocked', { action: 'lock.management.unlockDevice', deviceId });
        return;
      }

      // Check if enrolled with Trustonic
      if (!device.trustonic_device_id) {
        throw new Error('Device not enrolled with Trustonic');
      }

      // Unlock via Trustonic API
      await this.trustonic.unlockDevice({
        device_id: device.trustonic_device_id,
        unlock_reason: reason
      });

      // Update device status in database
      await db
        .from('devices')
        .update({
          lock_status: 'unlocked',
          unlocked_at: new Date().toISOString(),
          lock_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId)
        .execute();

      // Create unlock event record
      await db
        .from('device_lock_history')
        .insert({
          device_id: deviceId,
          action: 'unlock',
          reason: reason,
          performed_by: performedBy,
          admin_user_id: adminUserId,
          execution_status: 'success',
          lock_provider: 'trustonic',
          created_at: new Date().toISOString()
        })
        .execute();

      logger.info('Device unlocked successfully', { action: 'lock.management.unlockDevice', deviceId });

    } catch (error) {
      logger.error('Error unlocking device', { action: 'lock.management.unlockDevice', deviceId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

      // Create failed unlock event
      await db
        .from('device_lock_history')
        .insert({
          device_id: deviceId,
          action: 'unlock',
          reason: reason,
          performed_by: performedBy,
          admin_user_id: adminUserId,
          execution_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          lock_provider: 'trustonic',
          created_at: new Date().toISOString()
        })
        .execute();

      throw error;
    }
  }

  /**
   * Get device lock status
   */
  async getLockStatus(deviceId: string): Promise<{
    device_id: string;
    lock_status: 'locked' | 'unlocked';
    locked_at?: Date;
    unlocked_at?: Date;
    lock_reason?: string;
  }> {
    try {
      const { data: device, error } = await db
        .from('devices')
        .select('id, lock_status, locked_at, unlocked_at, lock_reason')
        .eq('id', deviceId)
        .single()
        .execute();

      if (error || !device) {
        throw new Error('Device not found');
      }

      return {
        device_id: device.id,
        lock_status: device.lock_status,
        locked_at: device.locked_at ? new Date(device.locked_at) : undefined,
        unlocked_at: device.unlocked_at ? new Date(device.unlocked_at) : undefined,
        lock_reason: device.lock_reason
      };

    } catch (error) {
      logger.error('Error getting lock status', { action: 'lock.management.getLockStatus', deviceId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Process automated device locks (runs daily via cron job)
   */
  async processAutomatedLocks(): Promise<{
    checked: number;
    triggered: number;
    locked: number;
    cancelled: number;
    failed: number;
  }> {
    try {
      logger.info('Starting automated device lock processing', { action: 'lock.management.processAutomated' });

      let checked = 0;
      let triggered = 0;
      let locked = 0;
      let cancelled = 0;
      let failed = 0;

      // Step 1: Check for new overdue loans (7+ days)
      // Skip digital loans — they have no physical device to lock.
      // Digital loan overdue handling is done by the notification service instead.
      const { data: overdueLoans, error: overdueError } = await db
        .from('loans')
        .select('*, devices(*), customers(*)')
        .eq('status', 'active')
        .neq('product_category', 'digital')
        .not('device_id', 'is', null)
        .lt('next_payment_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .execute();

      if (overdueError) {
        logger.error('Error fetching overdue loans', { action: 'lock.management.processAutomated', errorMessage: overdueError instanceof Error ? overdueError.message : 'Unknown error' });
      } else if (overdueLoans) {
        checked += overdueLoans.length;

        for (const loan of overdueLoans) {
          // Safety check: skip loans with no device (e.g. digital loans)
          if (!loan.device_id) {
            logger.info('Skipping loan with no device (digital loan)', { action: 'lock.management.processAutomated', loanId: loan.id });
            continue;
          }

          // Check if trigger already exists
          const { data: existingTrigger } = await db
            .from('device_lock_triggers')
            .select('*')
            .eq('loan_id', loan.id)
            .eq('trigger_type', 'missed_payment')
            .in('status', ['pending', 'executed'])
            .single()
            .execute();

          if (existingTrigger) {
            continue; // Already triggered
          }

          // Create lock trigger with 3-day grace period
          const gracePeriodUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          await db
            .from('device_lock_triggers')
            .insert({
              loan_id: loan.id,
              customer_id: loan.customer_id,
              device_id: loan.device_id,
              trigger_type: 'missed_payment',
              severity: 'warning',
              triggered_at: new Date().toISOString(),
              grace_period_until: gracePeriodUntil.toISOString(),
              lock_scheduled_at: gracePeriodUntil.toISOString(),
              status: 'pending',
              created_at: new Date().toISOString()
            })
            .execute();

          triggered++;
          logger.info('Lock trigger created', { action: 'lock.management.processAutomated', loanId: loan.id, gracePeriodUntil: gracePeriodUntil.toISOString() });
        }
      }

      // Step 2: Execute scheduled locks (grace period expired)
      const { data: scheduledLocks, error: scheduledError } = await db
        .from('device_lock_triggers')
        .select('*, loans(*, devices(*))')
        .lte('lock_scheduled_at', new Date().toISOString())
        .eq('status', 'pending')
        .execute();

      if (scheduledError) {
        logger.error('Error fetching scheduled locks', { action: 'lock.management.processAutomated', errorMessage: scheduledError instanceof Error ? scheduledError.message : 'Unknown error' });
      } else if (scheduledLocks) {
        for (const trigger of scheduledLocks) {
          // Check if payment received during grace period
          const paymentReceived = await this.checkPaymentDuringGracePeriod(
            trigger.loan_id,
            trigger.triggered_at,
            new Date()
          );

          if (paymentReceived) {
            // Cancel lock (customer paid during grace period)
            await db
              .from('device_lock_triggers')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: 'Payment received during grace period',
                updated_at: new Date().toISOString()
              })
              .eq('trigger_id', trigger.trigger_id)
              .execute();

            cancelled++;
            logger.info('Lock cancelled - payment received', { action: 'lock.management.processAutomated', deviceId: trigger.device_id });
            continue;
          }

          // Execute automated lock
          try {
            await this.lockDevice(
              trigger.device_id,
              `Payment overdue - ${trigger.trigger_type}`,
              'system'
            );

            // Update trigger status
            await db
              .from('device_lock_triggers')
              .update({
                status: 'executed',
                executed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('trigger_id', trigger.trigger_id)
              .execute();

            locked++;
            logger.info('Device locked successfully', { action: 'lock.management.processAutomated', deviceId: trigger.device_id });

          } catch (error) {
            logger.error('Failed to lock device', { action: 'lock.management.processAutomated', deviceId: trigger.device_id, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

            // Mark as failed
            await db
              .from('device_lock_triggers')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
                updated_at: new Date().toISOString()
              })
              .eq('trigger_id', trigger.trigger_id)
              .execute();

            failed++;
          }
        }
      }

      logger.info('Automated lock processing complete', { action: 'lock.management.processAutomated', checked, triggered, locked, cancelled, failed });

      return { checked, triggered, locked, cancelled, failed };

    } catch (error) {
      logger.error('Error during automated lock processing', { action: 'lock.management.processAutomated', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Handle payment received - automatically unlock if overdue cleared
   */
  async handlePaymentReceived(paymentId: string): Promise<void> {
    try {
      logger.info('Handling payment received', { action: 'lock.management.handlePayment', paymentId });

      // Get payment details
      const { data: payment, error: paymentError } = await db
        .from('payments')
        .select('*, loans(*, devices(*))')
        .eq('id', paymentId)
        .single()
        .execute();

      if (paymentError || !payment) {
        logger.error('Payment not found', { action: 'lock.management.handlePayment', paymentId, errorMessage: paymentError instanceof Error ? paymentError.message : 'Unknown error' });
        return;
      }

      // Check if device is locked
      if (payment.loans?.devices?.lock_status !== 'locked') {
        logger.info('Device not locked, no unlock needed', { action: 'lock.management.handlePayment', paymentId });
        return;
      }

      // Check if overdue loan is fully repaid with no balance
      const { data: loan } = await db
        .from('loans')
        .select('outstanding_balance, status')
        .eq('id', payment.loan_id)
        .single()
        .execute();

      if (!loan) {
        logger.error('Loan not found', { action: 'lock.management.handlePayment', paymentId });
        return;
      }

      // CRITICAL: Only unlock if outstanding balance is zero
      if (loan.outstanding_balance === 0) {
        logger.info('Loan fully repaid - unlocking device', { action: 'lock.management.handlePayment', loanId: payment.loan_id });

        await this.unlockDevice(
          payment.loans.device_id,
          'Overdue payment cleared - no outstanding balance',
          'customer_payment'
        );
      } else {
        logger.info('Loan still has outstanding balance', { action: 'lock.management.handlePayment', loanId: payment.loan_id });
      }

    } catch (error) {
      logger.error('Error handling payment received', { action: 'lock.management.handlePayment', paymentId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Check if payment was made during grace period
   */
  private async checkPaymentDuringGracePeriod(
    loanId: string,
    gracePeriodStart: Date | string,
    gracePeriodEnd: Date | string
  ): Promise<boolean> {
    const { data: payments, error } = await db
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .gte('completed_at', new Date(gracePeriodStart).toISOString())
      .lte('completed_at', new Date(gracePeriodEnd).toISOString())
      .eq('status', 'completed')
      .execute();

    if (error) {
      logger.error('Error checking payments during grace period', { action: 'lock.management.checkGracePeriod', loanId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }

    return payments && payments.length > 0;
  }

  /**
   * Generate lock warning notification message
   */
  generateLockWarningMessage(daysUntilLock: number, amountDue: number): string {
    return `
⚠️ *Payment Overdue*

Your payment of $${amountDue.toFixed(2)} is overdue.

If payment is not received within ${daysUntilLock} days, your device will be temporarily locked.

*Amount Due*: $${amountDue.toFixed(2)}

Emergency calls will remain available even if locked.

[Pay Now] [Contact Support]
    `.trim();
  }

  /**
   * Generate lock notification message
   */
  generateLockNotificationMessage(amountDue: number): string {
    return `
🔒 *Device Locked*

Your device has been temporarily locked due to missed payment.

*Amount Due*: $${amountDue.toFixed(2)}

Pay now to unlock your device immediately.

Emergency calls are still available.

[Pay Now] [Contact Support]
    `.trim();
  }

  /**
   * Generate unlock notification message
   */
  generateUnlockNotificationMessage(amountPaid: number): string {
    return `
✅ *Device Unlocked*

Thank you for your payment!

Your device has been unlocked and is now fully functional.

*Payment Received*: $${amountPaid.toFixed(2)}

[View Receipt] [Main Menu]
    `.trim();
  }
}
