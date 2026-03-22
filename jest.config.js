module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/services'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(date-fns|uuid)/)'
  ],
  collectCoverageFrom: [
    'services/**/src/**/*.{ts,tsx}',
    '!services/**/src/**/*.d.ts',
    '!services/**/node_modules/**',
    '!services/**/dist/**',
    '!services/admin-service/src/handlers/global-search.ts',
    '!services/admin-service/src/handlers/commission-reports.ts',
    '!services/admin-service/src/handlers/distributor-performance.ts',
    '!services/admin-service/src/handlers/device-loan-chain.ts',
    '!services/admin-service/src/handlers/lock-effectiveness.ts',
    '!services/investor-reporting-service/src/handlers/data-freshness.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 48,
      functions: 60,
      lines: 62,
      statements: 62
    }
  },
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/services/$1',
    '^@supabase/supabase-js$': '<rootDir>/tests/helpers/supabase-stub.ts',
    '^uuid$': '<rootDir>/tests/helpers/uuid-stub.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  verbose: true
};
