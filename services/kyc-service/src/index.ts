import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { SmileIdentityService, SmileWebhookPayload } from './smile-identity-service';
import {
  validateImage as _validateImage,
  bufferToBase64 as _bufferToBase64,
  downloadWhatsAppImage as _downloadWhatsAppImage,
  validateZimbabweIDNumber
} from './image-processor';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const smileService = new SmileIdentityService();

/**
 * KYC Service Lambda Handler
 * Handles KYC verification via Smile Identity
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path;
    const method = event.httpMethod;

    // Route requests
    if (path === '/kyc/initiate' && method === 'POST') {
      return await initiateKYC(event);
    } else if (path === '/kyc/callback' && method === 'POST') {
      return await handleSmileCallback(event);
    } else if (path.match(/\/kyc\/[^/]+$/) && method === 'GET') {
      const customerId = event.pathParameters?.customerId;
      return await getKYCStatus(customerId!);
    } else if (path === '/kyc/retry' && method === 'POST') {
      return await retryKYC(event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://admin.lynia.finance'
      }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://admin.lynia.finance'
      }
    };
  }
};

/**
 * POST /kyc/initiate
 * Initiate KYC verification with Smile Identity
 */
async function initiateKYC(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    console.log(`Initiating KYC for customer ${customer_id}`);

    // Check for existing KYC submission
    const { data: existingSubmission } = await supabase
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customer_id)
      .in('status', ['pending', 'verified'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
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
          smile_job_id: existingSubmission.smile_identity_transaction_id
        }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    // Submit to Smile Identity
    const smileResult = await smileService.submitEnhancedKYC({
      customer_id,
      id_number: idValidation.normalized!,
      id_image_base64,
      selfie_image_base64,
      first_name,
      last_name,
      dob,
      phone_number
    });

    // Save KYC submission record
    const { data: submission, error: submissionError } = await supabase
      .from('kyc_submissions')
      .insert({
        customer_id: customer_id,
        id_document_type: 'NATIONAL_ID',
        id_number: idValidation.normalized,
        id_document_photo_url: 'stored_in_smile', // Images sent directly to Smile
        selfie_photo_url: 'stored_in_smile',
        smile_identity_transaction_id: smileResult.job_id,
        smile_identity_job_id: smileResult.smile_job_id,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (submissionError) {
      console.error('Error saving KYC submission:', submissionError);
      throw new Error('Failed to save KYC submission');
    }

    console.log(`KYC submission created: ${submission.id}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: smileResult.message,
        kyc_submission_id: submission.id,
        smile_job_id: smileResult.smile_job_id,
        status: 'pending'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };

  } catch (error) {
    console.error('Error initiating KYC:', error);

    // Handle Smile Identity errors
    if (error instanceof Error && error.message.includes('KYC verification failed')) {
      const errorResponse = smileService.handleSmileError(error as unknown as { response?: { data?: { code?: string; message?: string } } });

      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'KYC verification failed',
          message: errorResponse.user_message,
          retriable: errorResponse.retriable,
          retry_after: errorResponse.retry_after
        }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to initiate KYC',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
}

/**
 * POST /kyc/callback
 * Handle Smile Identity webhook callback
 */
async function handleSmileCallback(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Verify webhook signature (mandatory — reject unsigned requests)
    const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];
    if (!receivedSignature) {
      console.warn('Smile Identity webhook rejected: missing signature header');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const isValid = smileService.verifyWebhookSignature(receivedSignature, event.body || '');
    if (!isValid) {
      console.warn('Smile Identity webhook rejected: invalid signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const payload: SmileWebhookPayload = JSON.parse(event.body || '{}');

    console.log(`Processing Smile callback for job ${payload.smile_job_id}`);

    // Extract IDs
    const customer_id = payload.partner_params.user_id;
    const job_id = payload.partner_params.job_id;

    // Fetch KYC submission
    const { data: submission, error: fetchError } = await supabase
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('smile_identity_transaction_id', job_id)
      .single();

    if (fetchError || !submission) {
      console.error(`KYC submission not found for job ${job_id}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Submission not found' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Determine verification decision
    const { decision, reason } = smileService.determineVerificationDecision(payload.result);

    console.log(`KYC decision for ${customer_id}: ${decision} - ${reason}`);

    // Update KYC submission
    const updateData: Record<string, unknown> = {
      verification_decision: decision,
      verification_reason: reason,
      verification_confidence: payload.result.confidence_value,
      liveness_score: payload.result.liveness_check.score,
      face_match_score: payload.result.face_match.score,
      smile_identity_response: payload,
      updated_at: new Date().toISOString()
    };

    if (decision === 'APPROVED') {
      updateData.status = 'verified';
      updateData.verified_at = new Date().toISOString();
    } else if (decision === 'REJECTED') {
      updateData.status = 'rejected';
      updateData.rejected_at = new Date().toISOString();
    } else {
      updateData.status = 'manual_review';
      updateData.manual_review_required = true;
    }

    await supabase
      .from('kyc_submissions')
      .update(updateData)
      .eq('id', submission.id);

    // Update customer KYC status
    if (decision === 'APPROVED') {
      await supabase
        .from('customers')
        .update({
          kyc_status: 'verified',
          kyc_verified_at: new Date().toISOString(),
          full_name: payload.result.id_info.full_name,
          date_of_birth: payload.result.id_info.dob,
          gender: payload.result.id_info.gender === 'M' ? 'male' : 'female'
        })
        .eq('id', customer_id);

      console.log(`Customer ${customer_id} KYC approved`);

      // TODO: Trigger credit scoring (would be called by onboarding flow)
    } else if (decision === 'MANUAL_REVIEW') {
      // Create manual review task
      await supabase
        .from('kyc_manual_reviews')
        .insert({
          kyc_submission_id: submission.id,
          customer_id: customer_id,
          review_status: 'pending',
          sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          priority: 'normal',
          created_at: new Date().toISOString()
        });

      console.log(`Manual review created for customer ${customer_id}`);

      // TODO: Notify admin team
    }

    // TODO: Send notification to customer via WhatsApp

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' }),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error('Error processing Smile webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

/**
 * GET /kyc/{customerId}
 * Get KYC status for a customer
 */
async function getKYCStatus(customerId: string): Promise<APIGatewayProxyResult> {
  try {
    if (!customerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Customer ID required' }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    // Fetch latest KYC submission
    const { data: submission, error } = await supabase
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !submission) {
      // No KYC submission found
      return {
        statusCode: 200,
        body: JSON.stringify({
          customer_id: customerId,
          kyc_status: 'not_started',
          message: 'No KYC submission found'
        }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        customer_id: customerId,
        kyc_status: submission.status,
        kyc_submission_id: submission.id,
        submitted_at: submission.submitted_at,
        verified_at: submission.verified_at,
        rejected_at: submission.rejected_at,
        verification_confidence: submission.verification_confidence,
        verification_decision: submission.verification_decision,
        verification_reason: submission.verification_reason,
        manual_review_required: submission.manual_review_required
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };

  } catch (error) {
    console.error('Error fetching KYC status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch KYC status',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
}

/**
 * POST /kyc/retry
 * Retry KYC verification after a failure
 */
async function retryKYC(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { customer_id } = body;

    if (!customer_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Customer ID required' }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    // Check retry eligibility
    const { data: submissions } = await supabase
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false });

    if (!submissions || submissions.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No KYC submission found' }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    // Check if last submission is retriable
    const nonRetriableStatuses = ['verified'];
    if (nonRetriableStatuses.includes(lastSubmission.status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Cannot retry',
          message: 'KYC is already verified',
          current_status: lastSubmission.status
        }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        retry_allowed: true,
        attempts_remaining: 3 - totalAttempts,
        message: 'You can retry KYC verification. Please submit new documents.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };

  } catch (error) {
    console.error('Error checking retry eligibility:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to check retry eligibility',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://admin.lynia.finance' }
    };
  }
}
