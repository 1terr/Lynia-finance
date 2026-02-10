/**
 * k6 Load Test: Lock Service
 *
 * Tests device lock/unlock operations and status checks.
 * Eventual consistency acceptable per CLAUDE.md architecture guidelines.
 *
 * Run: k6 run --env API_URL=https://staging-api.lyniafinance.com lock-service.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { config, defaultHeaders, loadProfiles } from './config.js';

// Custom metrics
const lockStatusLatency = new Trend('lock_status_duration', true);
const lockActionLatency = new Trend('lock_action_duration', true);
const lockErrors = new Counter('lock_errors');
const lockSuccessRate = new Rate('lock_success_rate');

const profile = loadProfiles[__ENV.LOAD_PROFILE || 'normal'];

export const options = {
  stages: profile.stages,
  thresholds: {
    ...profile.thresholds,
    lock_status_duration: ['p(95)<200', 'p(99)<500'],
    lock_action_duration: ['p(95)<1000', 'p(99)<3000'],
    lock_success_rate: ['rate>0.99'],
  },
  tags: {
    service: 'lock-service',
    test_type: __ENV.LOAD_PROFILE || 'normal',
  },
};

const deviceIds = Array.from({ length: 30 }, (_, i) => `test-device-${String(i + 1).padStart(3, '0')}`);
const loanIds = Array.from({ length: 20 }, (_, i) => `test-loan-${String(i + 1).padStart(3, '0')}`);
const customerIds = Array.from({ length: 10 }, (_, i) => `test-customer-${String(i + 1).padStart(3, '0')}`);

export default function () {
  const deviceId = deviceIds[Math.floor(Math.random() * deviceIds.length)];

  // 60% - Device status check (most common)
  group('Device Lock Status', () => {
    const res = http.get(
      `${config.baseUrl}/locks/${deviceId}`,
      { headers: defaultHeaders, tags: { endpoint: 'lock_status' } }
    );

    lockStatusLatency.add(res.timings.duration);

    const success = check(res, {
      'lock status returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      'lock status response time < 200ms': (r) => r.timings.duration < 200,
      'has valid lock status': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          const validStatuses = ['unlocked', 'locked', 'emergency_unlocked'];
          return validStatuses.includes(body.data?.lockStatus) || validStatuses.includes(body.data?.lock_status);
        }
        return true;
      },
    });

    if (!success) lockErrors.add(1);
    lockSuccessRate.add(success);
  });

  // 15% - Lock device
  if (Math.random() < 0.15) {
    group('Lock Device', () => {
      const loanId = loanIds[Math.floor(Math.random() * loanIds.length)];
      const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];

      const payload = JSON.stringify({
        deviceId: deviceId,
        loanId: loanId,
        customerId: customerId,
        action: 'lock',
        reason: 'load_test_payment_missed',
        lockType: 'auto_payment_missed',
        daysPastDue: Math.floor(Math.random() * 30) + 7,
      });

      const res = http.post(
        `${config.baseUrl}/locks/execute`,
        payload,
        { headers: defaultHeaders, tags: { endpoint: 'lock_execute' } }
      );

      lockActionLatency.add(res.timings.duration);

      const success = check(res, {
        'lock action returns valid status': (r) => [200, 400, 404, 409].includes(r.status),
        'lock action response time < 1000ms': (r) => r.timings.duration < 1000,
      });

      if (!success) lockErrors.add(1);
      lockSuccessRate.add(success);
    });
  }

  // 10% - Unlock device
  if (Math.random() < 0.1) {
    group('Unlock Device', () => {
      const loanId = loanIds[Math.floor(Math.random() * loanIds.length)];
      const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];

      const payload = JSON.stringify({
        deviceId: deviceId,
        loanId: loanId,
        customerId: customerId,
        action: 'unlock',
        reason: 'load_test_payment_received',
      });

      const res = http.post(
        `${config.baseUrl}/locks/execute`,
        payload,
        { headers: defaultHeaders, tags: { endpoint: 'unlock_execute' } }
      );

      lockActionLatency.add(res.timings.duration);

      const success = check(res, {
        'unlock action returns valid status': (r) => [200, 400, 404, 409].includes(r.status),
        'unlock action response time < 1000ms': (r) => r.timings.duration < 1000,
      });

      if (!success) lockErrors.add(1);
      lockSuccessRate.add(success);
    });
  }

  // 15% - Lock history
  group('Device Lock History', () => {
    const res = http.get(
      `${config.baseUrl}/locks/${deviceId}/history`,
      { headers: defaultHeaders, tags: { endpoint: 'lock_history' } }
    );

    const success = check(res, {
      'lock history returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      'lock history response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (!success) lockErrors.add(1);
    lockSuccessRate.add(success);
  });

  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  return {
    'reports/lock-service-summary.json': JSON.stringify(data, null, 2),
  };
}
