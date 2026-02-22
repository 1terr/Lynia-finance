/**
 * Common API response types used across all Lynia Finance dashboards.
 */

/**
 * Standard API success response envelope.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Standard API error response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Generic paginated response for list endpoints.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRecords: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Standard API response (either success or error).
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
