import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';

/**
 * GET /kyc/:customerId
 * Get KYC status for a customer
 */
export const handleGetKYCStatus: RouteHandler = async (event, params, _auth) => {
  try {
    const customerId = params.customerId;

    if (!customerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Customer ID required' }),
        headers: getSecurityHeaders(event)
      };
    }

    // Fetch latest KYC submission
    const { data: submission, error } = await db
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customerId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    if (error || !submission) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          customer_id: customerId,
          kyc_status: 'not_started',
          message: 'No KYC submission found'
        }),
        headers: getSecurityHeaders(event)
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        customer_id: customerId,
        kyc_status: submission.status,
        kyc_submission_id: submission.id,
        kyc_provider: submission.kyc_provider,
        submitted_at: submission.submitted_at,
        verified_at: submission.verified_at,
        rejected_at: submission.rejected_at,
        verification_confidence: submission.verification_confidence,
        verification_decision: submission.verification_decision,
        verification_reason: submission.verification_reason,
        manual_review_required: submission.manual_review_required
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error fetching KYC status', {
      action: 'kyc.status',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch KYC status',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
