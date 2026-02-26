import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import { kycProvider } from './provider-instance';
import { processKYCResult } from './process-kyc-result';

/**
 * POST /kyc/callback
 * Handle KYC provider webhook callback (provider-agnostic)
 */
export const handleKYCCallback: RouteHandler = async (event, _params, _auth) => {
  try {
    // Verify webhook signature (mandatory — reject unsigned requests)
    const receivedSignature =
      event.headers['x-signature'] || event.headers['X-Signature'] ||
      event.headers['x-webhook-signature'] || event.headers['X-Webhook-Signature'] || '';
    const timestamp = event.headers['x-webhook-timestamp'] || event.headers['X-Webhook-Timestamp'];

    if (!receivedSignature) {
      logger.warn('KYC webhook rejected: missing signature header', {
        action: 'kyc.callback',
        status: 'failed',
        errorMessage: 'Missing signature header',
      });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const isValid = kycProvider.verifyWebhookSignature(receivedSignature, event.body || '', timestamp);
    if (!isValid) {
      logger.warn('KYC webhook rejected: invalid signature', {
        action: 'kyc.callback',
        status: 'failed',
        errorMessage: 'Invalid signature',
      });
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Parse the webhook payload into a normalized result
    const verificationResult = kycProvider.parseWebhookPayload(event.body || '{}');

    logger.info(`Processing ${kycProvider.providerName} callback for job ${verificationResult.provider_job_id}`, {
      action: 'kyc.callback',
      status: 'started',
      provider: kycProvider.providerName,
      providerJobId: verificationResult.provider_job_id,
    });

    // Fetch KYC submission by provider job ID
    const { data: submission, error: fetchError } = await db
      .from('kyc_submissions')
      .select('*')
      .eq('provider_job_id', verificationResult.provider_job_id)
      .single()
      .execute();

    if (fetchError || !submission) {
      logger.error(`KYC submission not found for provider job ${verificationResult.provider_job_id}`, {
        action: 'kyc.callback',
        status: 'failed',
        errorMessage: 'Submission not found',
        providerJobId: verificationResult.provider_job_id,
      });
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Submission not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Idempotency guard: skip if already processed to prevent race conditions
    if (submission.status === 'verified' || submission.status === 'rejected') {
      logger.info(`KYC callback already processed for submission ${submission.id}, skipping`, {
        action: 'kyc.callback',
        status: 'completed',
        submissionId: submission.id,
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Already processed' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Process the KYC result
    await processKYCResult(submission.id, submission.customer_id, verificationResult);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    logger.error('Error processing KYC webhook', {
      action: 'kyc.callback',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
