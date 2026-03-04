/**
 * k6 Load Test: KYC Service
 *
 * Tests KYC submission, status check, and document verification endpoints.
 * External API dependent (DIDIT) - tests with mocked responses.
 *
 * Run: k6 run --env API_URL=https://staging-api.lyniafinance.com kyc-service.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { config, defaultHeaders, loadProfiles } from './config.js';

// Custom metrics
const kycSubmitLatency = new Trend('kyc_submit_duration', true);
const kycStatusLatency = new Trend('kyc_status_duration', true);
const kycErrors = new Counter('kyc_errors');
const kycSuccessRate = new Rate('kyc_success_rate');

const profile = loadProfiles[__ENV.LOAD_PROFILE || 'normal'];

export const options = {
  stages: profile.stages,
  thresholds: {
    ...profile.thresholds,
    kyc_submit_duration: ['p(95)<1000', 'p(99)<3000'],
    kyc_status_duration: ['p(95)<200', 'p(99)<500'],
    kyc_success_rate: ['rate>0.99'],
  },
  tags: {
    service: 'kyc-service',
    test_type: __ENV.LOAD_PROFILE || 'normal',
  },
};

const customerIds = Array.from({ length: 20 }, (_, i) => `test-customer-${String(i + 1).padStart(3, '0')}`);

export default function () {
  const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];

  // 60% - Status check (most common)
  group('KYC Status Check', () => {
    const res = http.get(
      `${config.baseUrl}/kyc/${customerId}`,
      { headers: defaultHeaders, tags: { endpoint: 'kyc_status' } }
    );

    kycStatusLatency.add(res.timings.duration);

    const success = check(res, {
      'kyc status returns 200 or 404': (r) => r.status === 200 || r.status === 404,
      'kyc status response time < 200ms': (r) => r.timings.duration < 200,
      'kyc response has valid structure': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          return body.data?.status !== undefined || body.status !== undefined;
        }
        return true;
      },
    });

    if (!success) kycErrors.add(1);
    kycSuccessRate.add(success);
  });

  // 20% - Submit new KYC
  if (Math.random() < 0.2) {
    group('KYC Submission', () => {
      const payload = JSON.stringify({
        customerId: customerId,
        idDocumentType: 'national_id',
        idNumber: `ZIM${Math.floor(Math.random() * 999999999)}`,
        idDocumentUrl: `https://storage.test.co/kyc/${customerId}/id.jpg`,
        selfieUrl: `https://storage.test.co/kyc/${customerId}/selfie.jpg`,
        firstName: 'Test',
        lastName: 'Customer',
        dateOfBirth: '1990-01-15',
      });

      const res = http.post(
        `${config.baseUrl}/kyc/submit`,
        payload,
        { headers: defaultHeaders, tags: { endpoint: 'kyc_submit' } }
      );

      kycSubmitLatency.add(res.timings.duration);

      const success = check(res, {
        'kyc submit returns 200 or 400': (r) => r.status === 200 || r.status === 400 || r.status === 409,
        'kyc submit response time < 1000ms': (r) => r.timings.duration < 1000,
      });

      if (!success) kycErrors.add(1);
      kycSuccessRate.add(success);
    });
  }

  // 20% - Get verification result
  if (Math.random() < 0.2) {
    group('KYC Verification Result', () => {
      const verificationId = `ver_${customerId}_${Math.floor(Math.random() * 100)}`;
      const res = http.get(
        `${config.baseUrl}/kyc/verification/${verificationId}`,
        { headers: defaultHeaders, tags: { endpoint: 'kyc_verification' } }
      );

      const success = check(res, {
        'verification returns 200 or 404': (r) => r.status === 200 || r.status === 404,
        'verification response time < 300ms': (r) => r.timings.duration < 300,
      });

      if (!success) kycErrors.add(1);
      kycSuccessRate.add(success);
    });
  }

  sleep(Math.random() * 3 + 1); // 1-4s think time (KYC is slower user flow)
}

export function handleSummary(data) {
  return {
    'reports/kyc-service-summary.json': JSON.stringify(data, null, 2),
  };
}
