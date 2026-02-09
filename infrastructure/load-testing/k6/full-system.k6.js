/**
 * k6 Full System Load Test
 *
 * Runs a combined load test across all services with realistic traffic distribution.
 * Simulates production-like traffic patterns based on expected user behavior.
 *
 * Traffic distribution (from artillery-config.yml):
 *   30% - Credit Score Lookup (scoring-service)
 *   25% - WhatsApp Webhook (whatsapp-service)
 *   20% - Payment Processing (payment-service)
 *   10% - KYC Status Check (kyc-service)
 *   10% - Device Lock Status (lock-service)
 *    5% - Notification History (notification-service)
 *
 * Run: k6 run --env API_URL=https://staging-api.lyniafinance.co.zw full-system.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { config, defaultHeaders, publicHeaders, loadProfiles } from './config.js';

// Per-service latency metrics
const scoringLatency = new Trend('scoring_api_duration', true);
const whatsappLatency = new Trend('whatsapp_api_duration', true);
const paymentLatency = new Trend('payment_api_duration', true);
const kycLatency = new Trend('kyc_api_duration', true);
const lockLatency = new Trend('lock_api_duration', true);
const notificationLatency = new Trend('notification_api_duration', true);

// Aggregate metrics
const totalErrors = new Counter('total_errors');
const totalSuccess = new Rate('total_success_rate');
const serviceDistribution = new Counter('service_requests');

const profile = loadProfiles[__ENV.LOAD_PROFILE || 'normal'];

export const options = {
  stages: profile.stages,
  thresholds: {
    ...profile.thresholds,
    // Per-service SLOs
    scoring_api_duration: ['p(95)<300', 'p(99)<1000'],
    whatsapp_api_duration: ['p(95)<200', 'p(99)<500'],
    payment_api_duration: ['p(95)<500', 'p(99)<2000'],
    kyc_api_duration: ['p(95)<300', 'p(99)<1000'],
    lock_api_duration: ['p(95)<300', 'p(99)<1000'],
    notification_api_duration: ['p(95)<300', 'p(99)<1000'],
    // Aggregate
    total_success_rate: ['rate>0.99'],
  },
  tags: {
    test_type: 'full_system',
    load_profile: __ENV.LOAD_PROFILE || 'normal',
  },
};

// Test data pools
const customerIds = Array.from({ length: 50 }, (_, i) => `test-customer-${String(i + 1).padStart(3, '0')}`);
const loanIds = Array.from({ length: 30 }, (_, i) => `test-loan-${String(i + 1).padStart(3, '0')}`);
const deviceIds = Array.from({ length: 30 }, (_, i) => `test-device-${String(i + 1).padStart(3, '0')}`);
const phoneNumbers = Array.from({ length: 50 }, (_, i) => `+26377${String(1000000 + i).padStart(7, '0')}`);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function scoringRequest() {
  const customerId = pick(customerIds);
  const res = http.get(
    `${config.baseUrl}/scoring/${customerId}`,
    { headers: defaultHeaders, tags: { service: 'scoring' } }
  );
  scoringLatency.add(res.timings.duration);
  serviceDistribution.add(1, { service: 'scoring' });
  return check(res, {
    'scoring: valid status': (r) => r.status === 200 || r.status === 404,
    'scoring: p95 target': (r) => r.timings.duration < 300,
  });
}

function whatsappRequest() {
  const phone = pick(phoneNumbers);
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-test',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '+263771000000', phone_number_id: 'test-id' },
          messages: [{
            from: phone.replace('+', ''),
            id: `wamid.${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'text',
            text: { body: pick(['Hello', 'Balance', 'Pay', '1', 'Help']) },
          }],
        },
        field: 'messages',
      }],
    }],
  });

  const res = http.post(
    `${config.baseUrl}/whatsapp/webhook`,
    payload,
    { headers: publicHeaders, tags: { service: 'whatsapp' } }
  );
  whatsappLatency.add(res.timings.duration);
  serviceDistribution.add(1, { service: 'whatsapp' });
  return check(res, {
    'whatsapp: returns 200': (r) => r.status === 200,
    'whatsapp: p95 target': (r) => r.timings.duration < 200,
  });
}

function paymentRequest() {
  const res = http.post(
    `${config.baseUrl}/payments/process`,
    JSON.stringify({
      loanId: pick(loanIds),
      customerId: pick(customerIds),
      amount: Math.floor(Math.random() * 200) + 20,
      paymentMethod: pick(['ecocash', 'onemoney', 'innbucks']),
      phoneNumber: pick(phoneNumbers),
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      currency: 'USD',
    }),
    { headers: defaultHeaders, tags: { service: 'payment' } }
  );
  paymentLatency.add(res.timings.duration);
  serviceDistribution.add(1, { service: 'payment' });
  return check(res, {
    'payment: valid status': (r) => r.status === 200 || r.status === 400,
    'payment: p95 target': (r) => r.timings.duration < 500,
  });
}

function kycRequest() {
  const customerId = pick(customerIds);
  const res = http.get(
    `${config.baseUrl}/kyc/${customerId}`,
    { headers: defaultHeaders, tags: { service: 'kyc' } }
  );
  kycLatency.add(res.timings.duration);
  serviceDistribution.add(1, { service: 'kyc' });
  return check(res, {
    'kyc: valid status': (r) => r.status === 200 || r.status === 404,
    'kyc: p95 target': (r) => r.timings.duration < 300,
  });
}

function lockRequest() {
  const deviceId = pick(deviceIds);
  const res = http.get(
    `${config.baseUrl}/locks/${deviceId}`,
    { headers: defaultHeaders, tags: { service: 'lock' } }
  );
  lockLatency.add(res.timings.duration);
  serviceDistribution.add(1, { service: 'lock' });
  return check(res, {
    'lock: valid status': (r) => r.status === 200 || r.status === 404,
    'lock: p95 target': (r) => r.timings.duration < 300,
  });
}

function notificationRequest() {
  const customerId = pick(customerIds);
  const res = http.get(
    `${config.baseUrl}/notifications/${customerId}`,
    { headers: defaultHeaders, tags: { service: 'notification' } }
  );
  notificationLatency.add(res.timings.duration);
  serviceDistribution.add(1, { service: 'notification' });
  return check(res, {
    'notification: valid status': (r) => r.status === 200 || r.status === 404,
    'notification: p95 target': (r) => r.timings.duration < 300,
  });
}

export default function () {
  const rand = Math.random() * 100;
  let success;

  if (rand < 30) {
    success = scoringRequest();
  } else if (rand < 55) {
    success = whatsappRequest();
  } else if (rand < 75) {
    success = paymentRequest();
  } else if (rand < 85) {
    success = kycRequest();
  } else if (rand < 95) {
    success = lockRequest();
  } else {
    success = notificationRequest();
  }

  if (!success) totalErrors.add(1);
  totalSuccess.add(success);

  sleep(Math.random() * 1.5 + 0.3);
}

export function handleSummary(data) {
  return {
    'reports/full-system-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 provides a built-in text summary; this is a fallback
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    profile: __ENV.LOAD_PROFILE || 'normal',
    metrics: {
      total_requests: data.metrics?.http_reqs?.values?.count || 0,
      error_rate: data.metrics?.http_req_failed?.values?.rate || 0,
      p50: data.metrics?.http_req_duration?.values?.['p(50)'] || 0,
      p95: data.metrics?.http_req_duration?.values?.['p(95)'] || 0,
      p99: data.metrics?.http_req_duration?.values?.['p(99)'] || 0,
      avg: data.metrics?.http_req_duration?.values?.avg || 0,
    },
  }, null, 2);
}
