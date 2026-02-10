/**
 * k6 Load Test: Notification Service
 *
 * Tests notification sending, history retrieval, and reminder scheduling.
 * Async/queue-based - focuses on throughput and queue acceptance rate.
 *
 * Run: k6 run --env API_URL=https://staging-api.lyniafinance.com notification-service.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { config, defaultHeaders, loadProfiles } from './config.js';

// Custom metrics
const notifySendLatency = new Trend('notify_send_duration', true);
const notifyHistoryLatency = new Trend('notify_history_duration', true);
const notifyErrors = new Counter('notify_errors');
const notifySuccessRate = new Rate('notify_success_rate');

const profile = loadProfiles[__ENV.LOAD_PROFILE || 'normal'];

export const options = {
  stages: profile.stages,
  thresholds: {
    ...profile.thresholds,
    notify_send_duration: ['p(95)<300', 'p(99)<1000'],
    notify_history_duration: ['p(95)<200', 'p(99)<500'],
    notify_success_rate: ['rate>0.99'],
  },
  tags: {
    service: 'notification-service',
    test_type: __ENV.LOAD_PROFILE || 'normal',
  },
};

const customerIds = Array.from({ length: 20 }, (_, i) => `test-customer-${String(i + 1).padStart(3, '0')}`);
const loanIds = Array.from({ length: 20 }, (_, i) => `test-loan-${String(i + 1).padStart(3, '0')}`);
const notificationTypes = ['payment_reminder', 'payment_confirmation', 'loan_approved', 'kyc_status', 'device_locked'];

export default function () {
  const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];

  // 40% - Send notification
  if (Math.random() < 0.4) {
    group('Send Notification', () => {
      const payload = JSON.stringify({
        customerId: customerId,
        loanId: loanIds[Math.floor(Math.random() * loanIds.length)],
        type: 'whatsapp',
        template: notificationTypes[Math.floor(Math.random() * notificationTypes.length)],
        recipientPhone: `+26377${Math.floor(Math.random() * 9000000) + 1000000}`,
        message: 'Test notification from load test',
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      });

      const res = http.post(
        `${config.baseUrl}/notifications/send`,
        payload,
        { headers: defaultHeaders, tags: { endpoint: 'notify_send' } }
      );

      notifySendLatency.add(res.timings.duration);

      const success = check(res, {
        'notify send returns 200 or 202': (r) => r.status === 200 || r.status === 202,
        'notify send response time < 300ms': (r) => r.timings.duration < 300,
      });

      if (!success) notifyErrors.add(1);
      notifySuccessRate.add(success);
    });
  }

  // 40% - Notification history
  group('Notification History', () => {
    const res = http.get(
      `${config.baseUrl}/notifications/${customerId}`,
      { headers: defaultHeaders, tags: { endpoint: 'notify_history' } }
    );

    notifyHistoryLatency.add(res.timings.duration);

    const success = check(res, {
      'history returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      'history response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (!success) notifyErrors.add(1);
    notifySuccessRate.add(success);
  });

  // 20% - Reminder schedule check
  if (Math.random() < 0.2) {
    group('Reminder Schedule', () => {
      const res = http.get(
        `${config.baseUrl}/notifications/reminders/pending`,
        { headers: defaultHeaders, tags: { endpoint: 'reminder_pending' } }
      );

      const success = check(res, {
        'reminders returns 200': (r) => r.status === 200,
        'reminders response time < 300ms': (r) => r.timings.duration < 300,
      });

      if (!success) notifyErrors.add(1);
      notifySuccessRate.add(success);
    });
  }

  sleep(Math.random() * 1.5 + 0.5);
}

export function handleSummary(data) {
  return {
    'reports/notification-service-summary.json': JSON.stringify(data, null, 2),
  };
}
