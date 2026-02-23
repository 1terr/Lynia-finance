import {
  createDistributor,
  createPendingHandovers,
  createInventoryDevices,
  createCommissions,
  createDashboardStats,
  createHandoverResult,
} from './factories';

// ── API Response Wrapper Types ──

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: object;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Response Wrapper Factories ──

export function createApiSuccess<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
  };
}

export function createApiError(
  message: string,
  code: string = 'UNKNOWN_ERROR',
  details?: object
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// ── Standard API Response Mocks ──

export const mockApiResponses = {
  // Auth & Profile
  getProfile: () => createApiSuccess(createDistributor()),

  updateProfile: () => createApiSuccess({ message: 'Profile updated successfully' }),

  // Handovers
  getPendingHandovers: () => createApiSuccess(createPendingHandovers(3)),

  submitHandover: () => createApiSuccess(createHandoverResult(true)),

  verifyCustomerIdentity: () =>
    createApiSuccess({ verified: true, message: 'Identity verified' }),

  verifyImei: () =>
    createApiSuccess({ verified: true, message: 'IMEI verified' }),

  verifyDepositPayment: () =>
    createApiSuccess({ verified: true, message: 'Payment verified' }),

  // Inventory
  getInventory: () => createApiSuccess(createInventoryDevices(10)),

  // Commissions
  getCommissions: () => createApiSuccess(createCommissions(5)),

  // Dashboard Stats
  getDashboardStats: () => createApiSuccess(createDashboardStats()),

  // Error responses
  unauthorized: () => createApiError('Unauthorized', 'AUTH_INVALID_TOKEN'),

  notFound: () => createApiError('Resource not found', 'NOT_FOUND'),

  validationError: (message: string = 'Validation failed') =>
    createApiError(message, 'VALIDATION_ERROR'),

  serverError: () => createApiError('Internal server error', 'SERVER_ERROR'),
};

// ── Response Helper Functions ──

/**
 * Create a delayed response (simulates network latency)
 */
export function createDelayedResponse<T>(
  response: ApiResponse<T>,
  delayMs: number = 100
): Promise<ApiResponse<T>> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(response), delayMs);
  });
}

/**
 * Create a rejected promise (simulates network failure)
 */
export function createNetworkError(
  message: string = 'Network request failed'
): Promise<never> {
  return Promise.reject(new Error(message));
}
