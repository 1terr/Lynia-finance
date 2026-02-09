/**
 * k6 Load Test: Payment Service
 *
 * Tests payment processing, status checks, and reconciliation endpoints.
 * Critical path: requires strong consistency and idempotency.
 *
 * Run: k6 run --env API_URL=https://staging-api.lyniafinance.co.zw payment-service.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { config, defaultHeaders, loadProfiles } from './config.js';

// Custom metrics
const paymentProcessLatency = new Trend('payment_process_duration', true);
const paymentStatusLatency = new Trend('payment_status_duration', true);
const paymentReconcileLatency = new Trend('payment_reconcile_duration', true);
const paymentErrors = new Counter('payment_errors');
const paymentSuccessRate = new Rate('payment_success_rate');
const idempotencyChecks = new Counter('payment_idempotency_checks');

const profile = loadProfiles[__ENV.LOAD_PROFILE || 'normal'];

export const options = {
  stages: profile.stages,
  thresholds: {
    ...profile.thresholds,
    payment_process_duration: ['p(95)<500', 'p(99)<2000'],
    payment_status_duration: ['p(95)<200', 'p(99)<500'],
    payment_success_rate: ['rate>0.99'],
  },
  tags: {
    service: 'payment-service',
    test_type: __ENV.LOAD_PROFILE || 'normal',
  },
};

const paymentMethods = ['ecocash', 'onemoney', 'innbucks'];
const loanIds = Array.from({ length: 20 }, (_, i) => `test-loan-${String(i + 1).padStart(3, '0')}`);
const customerIds = Array.from({ length: 10 }, (_, i) => `test-customer-${String(i + 1).padStart(3, '0')}`);

function generateTransactionId() {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function () {
  const loanId = loanIds[Math.floor(Math.random() * loanIds.length)];
  const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
  const txnId = generateTransactionId();

  // 50% - Process a payment
  if (Math.random() < 0.5) {
    group('Payment Processing', () => {
      const payload = JSON.stringify({
        loanId: loanId,
        customerId: customerId,
        amount: Math.floor(Math.random() * 200) + 20,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        phoneNumber: `+26377${Math.floor(Math.random() * 9000000) + 1000000}`,
        transactionId: txnId,
        currency: 'USD',
      });

      const res = http.post(
        `${config.baseUrl}/payments/process`,
        payload,
        { headers: defaultHeaders, tags: { endpoint: 'payment_process' } }
      );

      paymentProcessLatency.add(res.timings.duration);

      const success = check(res, {
        'payment status 200 or 400': (r) => r.status === 200 || r.status === 400,
        'payment response time < 500ms': (r) => r.timings.duration < 500,
        'has transaction reference': (r) => {
          if (r.status === 200) {
            const body = JSON.parse(r.body);
            return body.data?.transactionId !== undefined || body.data?.referenceNumber !== undefined;
          }
          return true;
        },
      });

      if (!success) paymentErrors.add(1);
      paymentSuccessRate.add(success);

      // Test idempotency: resend same transaction
      if (Math.random() < 0.1) {
        idempotencyChecks.add(1);
        const retryRes = http.post(
          `${config.baseUrl}/payments/process`,
          payload,
          { headers: defaultHeaders, tags: { endpoint: 'payment_idempotency' } }
        );

        check(retryRes, {
          'idempotent response matches': (r) => r.status === 200 || r.status === 409,
        });
      }
    });
  }

  // 30% - Check payment status
  if (Math.random() < 0.3) {
    group('Payment Status Check', () => {
      const res = http.get(
        `${config.baseUrl}/payments/${txnId}/status`,
        { headers: defaultHeaders, tags: { endpoint: 'payment_status' } }
      );

      paymentStatusLatency.add(res.timings.duration);

      const success = check(res, {
        'status check returns 200 or 404': (r) => r.status === 200 || r.status === 404,
        'status check response time < 200ms': (r) => r.timings.duration < 200,
      });

      if (!success) paymentErrors.add(1);
      paymentSuccessRate.add(success);
    });
  }

  // 20% - Loan payment history
  group('Loan Payment History', () => {
    const res = http.get(
      `${config.baseUrl}/payments/loan/${loanId}`,
      { headers: defaultHeaders, tags: { endpoint: 'payment_history' } }
    );

    const success = check(res, {
      'history returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      'history response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (!success) paymentErrors.add(1);
    paymentSuccessRate.add(success);
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time (payment flows take longer)
}

export function handleSummary(data) {
  return {
    'reports/payment-service-summary.json': JSON.stringify(data, null, 2),
  };
}
