import { RouteHandler } from '../../../shared/utils/lambda-router';
import { db } from '../../../shared/clients/database';
import { getSecurityHeaders } from '../../../shared/utils/response';
import logger from '../../../shared/utils/logger';
import { validateZimbabweIDNumber } from '../image-processor';
import { kycProvider } from './provider-instance';
import { processKYCResult } from './process-kyc-result';

/**
 * POST /kyc/initiate
 * Initiate KYC verification via the configured provider
 */
export const handleInitiateKYC: RouteHandler = async (event, _params, _auth) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      customer_id,
      id_number,
      id_image_base64,
      selfie_image_base64,
      first_name,
      last_name,
      dob,
      phone_number
    } = body;

    // Validate required fields
    if (!customer_id || !id_number || !id_image_base64 || !selfie_image_base64) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
          required: ['customer_id', 'id_number', 'id_image_base64', 'selfie_image_base64']
        }),
        headers: getSecurityHeaders(event)
      };
    }

    // Validate ID number format
    const idValidation = validateZimbabweIDNumber(id_number);
    if (!idValidation.valid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid ID number',
          message: idValidation.error
        }),
        headers: getSecurityHeaders(event)
      };
    }

    logger.info(`Initiating KYC for customer ${customer_id} via ${kycProvider.providerName}`, {
      action: 'kyc.initiate',
      status: 'started',
      customerId: customer_id,
      provider: kycProvider.providerName,
    });

    // Check for existing KYC submission
    const { data: existingSubmission } = await db
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customer_id)
      .in('status', ['pending', 'verified'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .execute();

    // If already verified, return existing status
    if (existingSubmission && existingSubmission.status === 'verified') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'KYC already verified',
          status: 'verified',
          kyc_submission_id: existingSubmission.id
        }),
        headers: getSecurityHeaders(event)
      };
    }

    // If pending, return existing job
    if (existingSubmission && existingSubmission.status === 'pending') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'KYC verification already in progress',
          status: 'pending',
          kyc_submission_id: existingSubmission.id,
          provider_job_id: existingSubmission.provider_job_id
        }),
        headers: getSecurityHeaders(event)
      };
    }

    // Submit to KYC provider
    const providerResult = await kycProvider.submitVerification({
      customer_id,
      id_number: idValidation.normalized!,
      id_image_base64,
      selfie_image_base64,
      first_name,
      last_name,
      dob,
      phone_number
    });

    // Save KYC submission record (provider-agnostic columns)
    const submissionNumber = `KYC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const insertData: Record<string, unknown> = {
      customer_id: customer_id,
      submission_number: submissionNumber,
      id_document_type: 'NATIONAL_ID',
      id_number: idValidation.normalized,
      id_document_url: `stored_in_${kycProvider.providerName}`,
      selfie_url: `stored_in_${kycProvider.providerName}`,
      kyc_provider: kycProvider.providerName,
      provider_job_id: providerResult.provider_job_id,
      status: 'pending'
    };

    const { data: submission, error: submissionError } = await db
      .from('kyc_submissions')
      .insert(insertData)
      .select()
      .single()
      .execute();

    if (submissionError) {
      logger.error('Error saving KYC submission', {
        action: 'kyc.initiate',
        status: 'failed',
        errorMessage: String(submissionError),
        customerId: customer_id,
      });
      throw new Error('Failed to save KYC submission');
    }

    logger.info(`KYC submission created: ${submission.id}`, {
      action: 'kyc.initiate',
      status: 'completed',
      customerId: customer_id,
      submissionId: submission.id,
    });

    // If provider returned results synchronously (e.g., Didit standalone APIs),
    // process the decision immediately
    if (providerResult.synchronous_result) {
      await processKYCResult(
        submission.id,
        customer_id,
        providerResult.synchronous_result
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: providerResult.message,
        kyc_submission_id: submission.id,
        provider_job_id: providerResult.provider_job_id,
        status: providerResult.synchronous_result ? 'processing' : 'pending'
      }),
      headers: getSecurityHeaders(event)
    };

  } catch (error) {
    logger.error('Error initiating KYC', {
      action: 'kyc.initiate',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // Handle provider errors via the unified interface
    if (error instanceof Error && error.message.includes('KYC verification failed')) {
      const errorResponse = kycProvider.handleError(error);

      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'KYC verification failed',
          message: errorResponse.user_message,
          retriable: errorResponse.retriable,
          retry_after: errorResponse.retry_after
        }),
        headers: getSecurityHeaders(event)
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to initiate KYC',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};
