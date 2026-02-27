import { createHmac } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { requireEnv } from '../../shared/utils/require-env';
import { CircuitBreaker } from '../../shared/utils/circuit-breaker';
import logger from '../../shared/utils/logger';

const trustonicCircuitBreaker = new CircuitBreaker({ name: 'trustonic-api', failureThreshold: 5, resetTimeout: 60000 });

/**
 * Trustonic Configuration
 */
interface TrustonicConfig {
  api_key: string;
  api_secret: string;
  base_url: string;
  environment: 'sandbox' | 'production';
}

/**
 * Trustonic Device Enrollment
 */
export interface TrustonicEnrollment {
  device_id: string;
  imei: string;
  customer_reference: string;
  trustonic_device_id: string;
  enrollment_status: 'pending' | 'enrolled' | 'failed';
  enrolled_at?: Date;
}

/**
 * Trustonic Lock Request
 */
export interface TrustonicLockRequest {
  device_id: string;
  imei: string;
  lock_message: string;
  lock_reason: string;
  allow_emergency_calls: boolean;
  emergency_numbers: string[];
}

/**
 * Trustonic Unlock Request
 */
export interface TrustonicUnlockRequest {
  device_id: string;
  unlock_reason: string;
}

/**
 * Trustonic Lock Status Response
 */
export interface TrustonicLockStatus {
  device_id: string;
  lock_status: 'locked' | 'unlocked';
  locked_at?: Date;
  unlocked_at?: Date;
  lock_reason?: string;
  can_emergency_call: boolean;
}

/**
 * Trustonic Provider
 * Handles Trustonic device lock/unlock integration
 *
 * NOTE: This is a mock provider for testing. Replace with actual Trustonic API integration in production.
 */
export class TrustonicProvider {
  private config: TrustonicConfig;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      api_key: requireEnv('TRUSTONIC_API_KEY'),
      api_secret: requireEnv('TRUSTONIC_API_SECRET'),
      base_url: process.env.TRUSTONIC_BASE_URL || 'https://api.trustonic.com/v1',
      environment: (process.env.TRUSTONIC_ENV || 'sandbox') as 'sandbox' | 'production'
    };

    this.client = axios.create({
      baseURL: this.config.base_url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.api_key
      }
    });

    logger.info('TrustonicProvider initialized', { action: 'lock.trustonic.init', environment: this.config.environment });
  }

  /**
   * Enroll device with Trustonic (during handover)
   */
  async enrollDevice(
    deviceId: string,
    imei: string,
    customerReference: string
  ): Promise<TrustonicEnrollment> {
    try {
      logger.info('Enrolling device with Trustonic', { action: 'lock.trustonic.enroll', deviceId, imei: imei.slice(-4) });

      // In sandbox mode, simulate enrollment
      if (this.config.environment === 'sandbox') {
        return this.mockEnrollDevice(deviceId, imei, customerReference);
      }

      // Production: Call actual Trustonic API
      const payload = {
        imei: imei,
        customer_reference: customerReference,
        allow_emergency_calls: true,
        emergency_numbers: ['999', '994', '993', '112'],
        metadata: {
          lynia_device_id: deviceId,
          enrollment_date: new Date().toISOString()
        }
      };

      const signature = this.generateSignature(payload);
      const response = await trustonicCircuitBreaker.execute(() =>
        this.client.post('/devices/enroll', payload, {
          headers: { 'X-Signature': signature }
        })
      );

      logger.info('Device enrolled with Trustonic', { action: 'lock.trustonic.enroll', deviceId, trustonicDeviceId: response.data.device_id });

      return {
        device_id: deviceId,
        imei: imei,
        customer_reference: customerReference,
        trustonic_device_id: response.data.device_id,
        enrollment_status: 'enrolled',
        enrolled_at: new Date()
      };

    } catch (error) {
      logger.error('Error enrolling device with Trustonic', { action: 'lock.trustonic.enroll', deviceId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Trustonic enrollment failed: ${errorMessage}`);
      }

      throw new Error(`Device enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Lock device via Trustonic API
   */
  async lockDevice(request: TrustonicLockRequest): Promise<void> {
    try {
      logger.info('Locking device via Trustonic', { action: 'lock.trustonic.lock', deviceId: request.device_id });

      // In sandbox mode, simulate lock
      if (this.config.environment === 'sandbox') {
        await this.mockLockDevice(request);
        return;
      }

      // Production: Call actual Trustonic API
      const payload = {
        device_id: request.device_id,
        lock_message: request.lock_message,
        lock_reason: request.lock_reason,
        allow_emergency_calls: request.allow_emergency_calls,
        emergency_numbers: request.emergency_numbers
      };

      const signature = this.generateSignature(payload);
      await trustonicCircuitBreaker.execute(() =>
        this.client.post(`/devices/${request.device_id}/lock`, payload, {
          headers: { 'X-Signature': signature }
        })
      );

      logger.info('Device locked successfully via Trustonic', { action: 'lock.trustonic.lock', deviceId: request.device_id });

    } catch (error) {
      logger.error('Error locking device via Trustonic', { action: 'lock.trustonic.lock', deviceId: request.device_id, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Trustonic lock failed: ${errorMessage}`);
      }

      throw new Error(`Device lock failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unlock device via Trustonic API
   */
  async unlockDevice(request: TrustonicUnlockRequest): Promise<void> {
    try {
      logger.info('Unlocking device via Trustonic', { action: 'lock.trustonic.unlock', deviceId: request.device_id });

      // In sandbox mode, simulate unlock
      if (this.config.environment === 'sandbox') {
        await this.mockUnlockDevice(request);
        return;
      }

      // Production: Call actual Trustonic API
      const payload = {
        device_id: request.device_id,
        unlock_reason: request.unlock_reason
      };

      const signature = this.generateSignature(payload);
      await trustonicCircuitBreaker.execute(() =>
        this.client.post(`/devices/${request.device_id}/unlock`, payload, {
          headers: { 'X-Signature': signature }
        })
      );

      logger.info('Device unlocked successfully via Trustonic', { action: 'lock.trustonic.unlock', deviceId: request.device_id });

    } catch (error) {
      logger.error('Error unlocking device via Trustonic', { action: 'lock.trustonic.unlock', deviceId: request.device_id, errorMessage: error instanceof Error ? error.message : 'Unknown error' });

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Trustonic unlock failed: ${errorMessage}`);
      }

      throw new Error(`Device unlock failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get device lock status from Trustonic
   */
  async getLockStatus(deviceId: string): Promise<TrustonicLockStatus> {
    try {
      // In sandbox mode, return mock status
      if (this.config.environment === 'sandbox') {
        return this.mockGetLockStatus(deviceId);
      }

      // Production: Call actual Trustonic API
      const response = await trustonicCircuitBreaker.execute(() =>
        this.client.get(`/devices/${deviceId}/status`)
      );

      return {
        device_id: deviceId,
        lock_status: response.data.lock_status,
        locked_at: response.data.locked_at ? new Date(response.data.locked_at) : undefined,
        unlocked_at: response.data.unlocked_at ? new Date(response.data.unlocked_at) : undefined,
        lock_reason: response.data.lock_reason,
        can_emergency_call: response.data.can_emergency_call
      };

    } catch (error) {
      logger.error('Error getting lock status from Trustonic', { action: 'lock.trustonic.getStatus', deviceId, errorMessage: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error(`Failed to get lock status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HMAC signature for Trustonic API requests
   */
  private generateSignature(payload: Record<string, unknown>): string {
    const payloadString = JSON.stringify(payload);
    return createHmac('sha256', this.config.api_secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Mock device enrollment (sandbox mode)
   */
  private mockEnrollDevice(
    deviceId: string,
    imei: string,
    customerReference: string
  ): TrustonicEnrollment {
    logger.debug('Enrolling device with Trustonic', { action: 'lock.trustonic.enroll', mode: 'sandbox', deviceId, imei: imei.slice(-4) });

    return {
      device_id: deviceId,
      imei: imei,
      customer_reference: customerReference,
      trustonic_device_id: `trustonic_${deviceId}`,
      enrollment_status: 'enrolled',
      enrolled_at: new Date()
    };
  }

  /**
   * Mock device lock (sandbox mode)
   */
  private async mockLockDevice(request: TrustonicLockRequest): Promise<void> {
    logger.debug('Locking device', { action: 'lock.trustonic.lock', mode: 'sandbox', deviceId: request.device_id, lockReason: request.lock_reason, emergencyCallsAllowed: request.allow_emergency_calls });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Mock device unlock (sandbox mode)
   */
  private async mockUnlockDevice(request: TrustonicUnlockRequest): Promise<void> {
    logger.debug('Unlocking device', { action: 'lock.trustonic.unlock', mode: 'sandbox', deviceId: request.device_id, unlockReason: request.unlock_reason });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Mock get lock status (sandbox mode)
   */
  private mockGetLockStatus(deviceId: string): TrustonicLockStatus {
    logger.debug('Getting lock status', { action: 'lock.trustonic.getStatus', mode: 'sandbox', deviceId });

    return {
      device_id: deviceId,
      lock_status: 'unlocked',
      can_emergency_call: true
    };
  }

  /**
   * Generate lock message for customer
   */
  generateLockMessage(reason: string): string {
    return `Payment overdue. ${reason}. Contact Lynia Finance: +263 771 234 567. Emergency calls are still available.`;
  }

  /**
   * Zimbabwe emergency numbers
   */
  getEmergencyNumbers(): string[] {
    return ['999', '994', '993', '112'];
  }
}
