import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

/**
 * POST /kyc/retry
 * Retry KYC verification after a failure
 */
export const handleRetryKYC: RouteHandler = async (event, _params, _auth) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { customer_id } = body;

    if (!customer_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Customer ID required' }),
        headers: getSecurityHeaders(event)
      };
    }

    // Check retry eligibility
    const { data: submissions } = await db
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .execute();

    if (!submissions || submissions.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No KYC submission found' }),
        headers: getSecurityHeaders(event)
      };
    }

    const totalAttempts = submissions.length;
    const lastSubmission = submissions[0];

    // Check maximum retry limit (3 attempts)
    if (totalAttempts >= 3) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Maximum retry attempts reached',
          message: 'You have reached the maximum number of KYC attempts. Please contact support.',
          attempts_used: totalAttempts,
          max_attempts: 3
        }),
        headers: getSecurityHeaders(event)
      };
    }

    // Check if last submission is retriable
    if (lastSubmission.status === 'verified') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Cannot retry',
          message: 'KYC is already verified',
          current_status: lastSubmission.status
        }),
        headers: getSecurityHeaders(event)
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        retry_allowed: true,
        attempts_remaining: 3 - totalAttempts,
        message: 'You can retry KYC verification. Please submit new documents.'
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error checking retry eligibility', {
      action: 'kyc.retry',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to check retry eligibility',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
