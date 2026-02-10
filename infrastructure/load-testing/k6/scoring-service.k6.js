/**
 * k6 Load Test: Scoring Service
 *
 * Tests credit score calculation and lookup endpoints under load.
 * Critical path: highest traffic endpoint (30% of total requests).
 *
 * Run: k6 run --env API_URL=https://staging-api.lyniafinance.com scoring-service.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { config, defaultHeaders, loadProfiles } from './config.js';

// Custom metrics
const scoringLatency = new Trend('scoring_lookup_duration', true);
const scoringCalculateLatency = new Trend('scoring_calculate_duration', true);
const scoringErrors = new Counter('scoring_errors');
const scoringSuccessRate = new Rate('scoring_success_rate');

// Select load profile from environment (default: normal)
const profile = loadProfiles[__ENV.LOAD_PROFILE || 'normal'];

export const options = {
  stages: profile.stages,
  thresholds: {
    ...profile.thresholds,
    scoring_lookup_duration: ['p(95)<200', 'p(99)<500'],
    scoring_calculate_duration: ['p(95)<500', 'p(99)<1500'],
    scoring_success_rate: ['rate>0.99'],
  },
  tags: {
    service: 'scoring-service',
    test_type: __ENV.LOAD_PROFILE || 'normal',
  },
};

const customerIds = [
  'test-customer-001', 'test-customer-002', 'test-customer-003',
  'test-customer-004', 'test-customer-005', 'test-customer-006',
  'test-customer-007', 'test-customer-008', 'test-customer-009',
  'test-customer-010',
];

export default function () {
  const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];

  group('Credit Score Lookup', () => {
    const res = http.get(
      `${config.baseUrl}/scoring/${customerId}`,
      { headers: defaultHeaders, tags: { endpoint: 'scoring_lookup' } }
    );

    scoringLatency.add(res.timings.duration);

    const success = check(res, {
      'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'response time < 300ms': (r) => r.timings.duration < 300,
      'has valid response body': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          return body.data !== undefined || body.score !== undefined;
        }
        return true;
      },
    });

    if (!success) {
      scoringErrors.add(1);
    }
    scoringSuccessRate.add(success);
  });

  // 30% of requests also trigger a score calculation
  if (Math.random() < 0.3) {
    group('Credit Score Calculation', () => {
      const payload = JSON.stringify({
        customerId: customerId,
        scoringData: {
          monthlyIncome: Math.floor(Math.random() * 1000) + 200,
          employmentStatus: ['employed', 'self_employed', 'unemployed'][Math.floor(Math.random() * 3)],
          existingDebt: Math.floor(Math.random() * 500),
          transactionHistory: Array.from({ length: Math.floor(Math.random() * 12) }, (_, i) => ({
            type: 'REPAYMENT',
            amount: Math.floor(Math.random() * 100) + 20,
            onTime: Math.random() > 0.2,
            date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
          })),
        },
      });

      const res = http.post(
        `${config.baseUrl}/scoring/calculate`,
        payload,
        { headers: defaultHeaders, tags: { endpoint: 'scoring_calculate' } }
      );

      scoringCalculateLatency.add(res.timings.duration);

      const success = check(res, {
        'calculate status is 200 or 400': (r) => r.status === 200 || r.status === 400,
        'calculate response time < 500ms': (r) => r.timings.duration < 500,
        'score in valid range': (r) => {
          if (r.status === 200) {
            const body = JSON.parse(r.body);
            return body.data?.scaledScore >= 300 && body.data?.scaledScore <= 850;
          }
          return true;
        },
      });

      if (!success) {
        scoringErrors.add(1);
      }
      scoringSuccessRate.add(success);
    });
  }

  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}

export function handleSummary(data) {
  return {
    'reports/scoring-service-summary.json': JSON.stringify(data, null, 2),
  };
}
