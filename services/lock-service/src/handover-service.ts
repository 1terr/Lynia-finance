/**
 * Device Handover Service
 *
 * This file is a barrel re-export for backwards compatibility.
 * Implementation has been decomposed into:
 *  - handover/handover-types.ts       -- type/interface definitions
 *  - handover/handover-validation.ts  -- readiness checks, identity/deposit verification
 *  - handover/handover-workflow.ts    -- initiate, complete, status tracking
 *  - handover/commission-calculator.ts -- commission calculation
 *  - handover/index.ts               -- barrel re-exports
 *
 * The HandoverService class is preserved below as a facade that
 * delegates to the decomposed modules for backwards compatibility.
 */

import logger from '../../shared/utils/logger';
import {
  checkHandoverReadiness,
  verifyCustomerIdentity,
  verifyDepositPayment,
  recordDeviceCondition,
} from './handover/handover-validation';
import {
  initiateHandover,
  completeHandover,
  getHandoverStatus,
  generateHandoverConfirmation,
} from './handover/handover-workflow';
import { calculateDistributorCommission } from './handover/commission-calculator';
import type { DeviceCondition } from './handover/handover-types';

// Re-export all types and functions from decomposed modules
export * from './handover/index';

/**
 * Device Handover Service (class facade for backwards compatibility)
 * Manages the complete device handover workflow
 */
export class HandoverService {
  constructor() {
    logger.info('HandoverService initialized', { action: 'lock.handover.init' });
  }

  checkHandoverReadiness = checkHandoverReadiness;
  initiateHandover = initiateHandover;
  verifyCustomerIdentity = verifyCustomerIdentity;
  verifyDepositPayment = verifyDepositPayment;

  async recordDeviceCondition(handoverId: string, deviceCondition: DeviceCondition): Promise<void> {
    return recordDeviceCondition(handoverId, deviceCondition);
  }

  completeHandover = completeHandover;

  private calculateDistributorCommission = calculateDistributorCommission;

  getHandoverStatus = getHandoverStatus;
  generateHandoverConfirmation = generateHandoverConfirmation;
}
