/**
 * Payment Service Lambda Handler
 * Handles payment processing (EcoCash, OneMoney, O'mari, InnBucks)
 */

import { createRouter } from '../../shared/utils/lambda-router';
import { handleInitiatePayment } from './handlers/initiate-payment';
import { handleGetPaymentStatus } from './handlers/get-payment-status';
import { handleReconcilePayments } from './handlers/reconcile-payments';
import { handleEcoCashWebhook } from './handlers/webhook-ecocash';
import { handleOneMoneyWebhook } from './handlers/webhook-onemoney';
import { handleOmariWebhook } from './handlers/webhook-omari';
import { handleInnBucksWebhook } from './handlers/webhook-innbucks';

export const handler = createRouter({
  'POST /payments/initiate': handleInitiatePayment,
  'POST /payments/webhook/ecocash': handleEcoCashWebhook,
  'POST /payments/webhook/onemoney': handleOneMoneyWebhook,
  'POST /payments/webhook/omari': handleOmariWebhook,
  'POST /payments/webhook/innbucks': handleInnBucksWebhook,
  'GET /payments/:paymentId': handleGetPaymentStatus,
  'POST /payments/reconcile': handleReconcilePayments,
}, { serviceName: 'payment-service', skipAuth: true });
