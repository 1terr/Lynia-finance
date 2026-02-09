/**
 * Jest Test Setup
 * Runs before all test suites
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
(process.env as Record<string, string>).NODE_ENV = 'test';
(process.env as Record<string, string>).LOG_LEVEL = 'error'; // Reduce noise during tests

// Global test timeout
jest.setTimeout(30000); // 30 seconds

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(), // Mock console.log
  debug: jest.fn(), // Mock console.debug
  info: jest.fn(), // Mock console.info
  warn: jest.fn(), // Keep warnings
  error: jest.fn(), // Keep errors
};

// Global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testDb: unknown;
    }
  }
}

// Cleanup after all tests
afterAll(async () => {
  // Close database connections, cleanup resources
  console.info('Test suite cleanup complete');
});
