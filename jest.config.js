module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'services/**/src/**/*.{ts,tsx}',
    '!services/**/src/**/*.d.ts',
    '!services/**/node_modules/**',
    '!services/**/dist/**'
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 35,
      lines: 40,
      statements: 40
    }
  },
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/services/$1',
    '^@supabase/supabase-js$': '<rootDir>/node_modules/@supabase/supabase-js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  verbose: true
};
