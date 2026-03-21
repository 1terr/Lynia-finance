/**
 * Reservation Expiry Scheduler
 *
 * Scheduled Lambda that runs hourly to expire stale device reservations.
 * When a reservation expires:
 *   1. reservation.status → 'expired'
 *   2. device.status → 'in_stock' (only if currently 'reserved')
 *   3. An inventory_movement record is created for audit trail
 */

import { query, withTransaction } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';

interface ExpiredReservation {
  id: string;
  device_id: string;
  device_status: string;
}

/**
 * Lambda handler entry point. Invoked by EventBridge schedule (rate(1 hour)).
 */
export const handler = async (_event: Record<string, unknown>): Promise<{
  statusCode: number;
  body: string;
}> => {
  const startTime = Date.now();

  logger.info('Reservation expiry check started', {
    action: 'reservation-expiry.start',
    status: 'started',
  });

  try {
    // Find all active reservations that have passed their expiry time
    const { data: expired, error: fetchError } = await query<ExpiredReservation>(
      `SELECT
         dr.id,
         dr.device_id,
         d.status AS device_status
       FROM device_reservations dr
       JOIN devices d ON d.id = dr.device_id
       WHERE dr.status = 'active'
         AND dr.expires_at < NOW()`,
    );

    if (fetchError) {
      logger.error('Failed to fetch expired reservations', {
        action: 'reservation-expiry.fetch',
        status: 'failed',
        meta: { error: fetchError.message },
      });
      return { statusCode: 500, body: JSON.stringify({ error: fetchError.message }) };
    }

    if (expired.length === 0) {
      logger.info('No expired reservations found', {
        action: 'reservation-expiry.complete',
        status: 'completed',
        duration: Date.now() - startTime,
        metadata: { expired_count: 0 },
      });
      return { statusCode: 200, body: JSON.stringify({ expired_count: 0 }) };
    }

    let expiredCount = 0;
    let devicesReleased = 0;

    // Process each expired reservation in a transaction
    await withTransaction(async (tx) => {
      for (const reservation of expired) {
        // 1. Mark reservation as expired
        await tx(
          `UPDATE device_reservations SET status = 'expired', updated_at = NOW()
           WHERE id = $1 AND status = 'active'`,
          [reservation.id]
        );
        expiredCount++;

        // 2. Release device back to in_stock only if currently reserved
        if (reservation.device_status === 'reserved') {
          await tx(
            `UPDATE devices SET status = 'in_stock', updated_at = NOW()
             WHERE id = $1 AND status = 'reserved'`,
            [reservation.device_id]
          );
          devicesReleased++;
        }

        // 3. Record inventory movement for audit trail
        await tx(
          `INSERT INTO inventory_movements (
             device_id, movement_type, from_status, to_status, notes, created_at
           ) VALUES (
             $1, 'reservation_expired', 'reserved', 'in_stock',
             'Reservation expired automatically', NOW()
           )`,
          [reservation.device_id]
        );
      }
    });

    const duration = Date.now() - startTime;

    logger.info('Reservation expiry completed', {
      action: 'reservation-expiry.complete',
      status: 'completed',
      duration,
      metadata: {
        expired_count: expiredCount,
        devices_released: devicesReleased,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        expired_count: expiredCount,
        devices_released: devicesReleased,
        duration_ms: duration,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Reservation expiry failed', {
      action: 'reservation-expiry.error',
      status: 'failed',
      meta: { error: message },
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
    };
  }
};
