/**
 * k6 Load Testing - Shared Configuration
 *
 * Centralized config for all k6 load test scripts.
 * Load profiles: normal (100 VUs), peak (500 VUs), stress (1000 VUs).
 */

// Environment detection
const BASE_URL = __ENV.API_URL || 'https://staging-api.lyniafinance.co.zw';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';

export const config = {
  baseUrl: BASE_URL,
  authToken: AUTH_TOKEN,
};

/** Standard headers for authenticated API requests */
export const defaultHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

/** Standard headers for public endpoints (no auth) */
export const publicHeaders = {
  'Content-Type': 'application/json',
};

/**
 * Load profiles matching SLO targets from CLAUDE.md:
 *   - p50: 100ms, p95: 300ms, p99: 1000ms
 *   - Error rate < 0.1% normal, < 1% peak
 */
export const loadProfiles = {
  /** Normal: 100 concurrent users, steady state */
  normal: {
    stages: [
      { duration: '1m', target: 10 },   // warm-up
      { duration: '2m', target: 50 },   // ramp-up
      { duration: '5m', target: 100 },  // sustained normal load
      { duration: '1m', target: 0 },    // cool-down
    ],
    thresholds: {
      http_req_duration: ['p(95)<300', 'p(99)<1000'],
      http_req_failed: ['rate<0.001'],  // < 0.1% error rate
      http_reqs: ['rate>50'],           // minimum throughput
    },
  },

  /** Peak: 500 concurrent users, stress testing */
  peak: {
    stages: [
      { duration: '1m', target: 50 },   // warm-up
      { duration: '3m', target: 250 },  // ramp-up
      { duration: '5m', target: 500 },  // sustained peak load
      { duration: '2m', target: 100 },  // step-down
      { duration: '1m', target: 0 },    // cool-down
    ],
    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<2000'],
      http_req_failed: ['rate<0.01'],  // < 1% error rate
      http_reqs: ['rate>100'],
    },
  },

  /** Stress: 1000 concurrent users, find breaking points */
  stress: {
    stages: [
      { duration: '1m', target: 100 },  // warm-up
      { duration: '3m', target: 500 },  // ramp to peak
      { duration: '5m', target: 1000 }, // sustained stress
      { duration: '2m', target: 500 },  // step-down
      { duration: '1m', target: 0 },    // cool-down
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000', 'p(99)<5000'],
      http_req_failed: ['rate<0.05'],  // < 5% error rate at stress
    },
  },

  /** Spike: sudden burst to find system limits */
  spike: {
    stages: [
      { duration: '30s', target: 50 },   // warm-up
      { duration: '10s', target: 1000 }, // spike
      { duration: '2m', target: 1000 },  // hold spike
      { duration: '30s', target: 50 },   // recover
      { duration: '1m', target: 0 },     // cool-down
    ],
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      http_req_failed: ['rate<0.10'],
    },
  },
};

/**
 * SLO thresholds from CLAUDE.md monitoring section
 */
export const sloThresholds = {
  availability: 0.999,       // 99.9%
  p50LatencyMs: 100,
  p95LatencyMs: 300,
  p99LatencyMs: 1000,
  errorRateCritical: 0.05,   // 5%
  errorRateWarning: 0.01,    // 1%
  coldStartMaxMs: 3000,
  dashboardFcpMs: 1500,
  dashboardTtiMs: 3000,
};
