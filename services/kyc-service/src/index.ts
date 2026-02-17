import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/clients/database';
import { getSecurityHeaders } from '../../shared/utils/response';
import { createKYCProvider } from './kyc-provider-factory';
import type { KYCVerificationResult } from '../../shared/types/kyc-provider';
import axios from 'axios';
import {
  validateImage as _validateImage,
  bufferToBase64 as _bufferToBase64,
  downloadWhatsAppImage as _downloadWhatsAppImage,
  validateZimbabweIDNumber
} from './image-processor';

const kycProvider = createKYCProvider();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * KYC Service Lambda Handler
 * Handles KYC verification via configurable provider (Smile Identity or Didit)
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
      return await handleKYCCallback(event);
    } else if (path.match(/\/kyc\/[^/]+$/) && method === 'GET') {
      const customerId = event.pathParameters?.customerId;
      return await getKYCStatus(customerId!, event);
    } else if (path === '/kyc/retry' && method === 'POST') {
      return await retryKYC(event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' }),
      headers: getSecurityHeaders(event)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
};

/**
 * POST /kyc/initiate
 * Initiate KYC verification via the configured provider
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

    console.log(`Initiating KYC for customer ${customer_id} via ${kycProvider.providerName}`);

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
    const insertData: Record<string, unknown> = {
      customer_id: customer_id,
      id_document_type: 'NATIONAL_ID',
      id_number: idValidation.normalized,
      id_document_url: `stored_in_${kycProvider.providerName}`,
      selfie_url: `stored_in_${kycProvider.providerName}`,
      kyc_provider: kycProvider.providerName,
      provider_job_id: providerResult.provider_job_id,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: submission, error: submissionError } = await db
      .from('kyc_submissions')
      .insert(insertData)
      .select()
      .single()
      .execute();

    if (submissionError) {
      console.error('Error saving KYC submission:', submissionError);
      throw new Error('Failed to save KYC submission');
    }

    console.log(`KYC submission created: ${submission.id}`);

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
    console.error('Error initiating KYC:', error);

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
}

/**
 * POST /kyc/callback
 * Handle KYC provider webhook callback (provider-agnostic)
 */
async function handleKYCCallback(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Verify webhook signature (mandatory — reject unsigned requests)
    const receivedSignature =
      event.headers['x-signature'] || event.headers['X-Signature'] ||
      event.headers['x-webhook-signature'] || event.headers['X-Webhook-Signature'] || '';
    const timestamp = event.headers['x-webhook-timestamp'] || event.headers['X-Webhook-Timestamp'];

    if (!receivedSignature) {
      console.warn('KYC webhook rejected: missing signature header');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const isValid = kycProvider.verifyWebhookSignature(receivedSignature, event.body || '', timestamp);
    if (!isValid) {
      console.warn('KYC webhook rejected: invalid signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Parse the webhook payload into a normalized result
    const verificationResult = kycProvider.parseWebhookPayload(event.body || '{}');

    console.log(`Processing ${kycProvider.providerName} callback for job ${verificationResult.provider_job_id}`);

    // Fetch KYC submission by provider job ID
    const { data: submission, error: fetchError } = await db
      .from('kyc_submissions')
      .select('*')
      .eq('provider_job_id', verificationResult.provider_job_id)
      .single()
      .execute();

    if (fetchError || !submission) {
      console.error(`KYC submission not found for provider job ${verificationResult.provider_job_id}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Submission not found' }),
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
    console.error('Error processing KYC webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

/**
 * Process a KYC verification result (used by both synchronous and callback flows).
 */
async function processKYCResult(
  submissionId: string,
  customerId: string,
  result: KYCVerificationResult
): Promise<void> {
  // Determine verification decision
  const { decision, reason } = kycProvider.determineDecision(result);

  console.log(`KYC decision for ${customerId}: ${decision} - ${reason}`);

  // Update KYC submission with provider-agnostic columns
  const updateData: Record<string, unknown> = {
    verification_decision: decision,
    verification_reason: reason,
    verification_confidence: result.confidence_score,
    liveness_score: result.liveness_score,
    face_match_score: result.face_match_score,
    provider_response: result.raw_response,
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

  await db
    .from('kyc_submissions')
    .update(updateData)
    .eq('id', submissionId)
    .execute();

  // Update customer KYC status
  if (decision === 'APPROVED') {
    await db
      .from('customers')
      .update({
        kyc_status: 'verified',
        kyc_verified_at: new Date().toISOString(),
        full_name: result.id_info.full_name,
        date_of_birth: result.id_info.date_of_birth,
        gender: result.id_info.gender === 'M' ? 'male' : 'female'
      })
      .eq('id', customerId)
      .execute();

    console.log(`Customer ${customerId} KYC approved via ${result.provider}`);
  } else if (decision === 'MANUAL_REVIEW') {
    // Create manual review task
    await db
      .from('kyc_manual_reviews')
      .insert({
        kyc_submission_id: submissionId,
        customer_id: customerId,
        review_status: 'pending',
        sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'normal',
        created_at: new Date().toISOString()
      })
      .execute();

    console.log(`Manual review created for customer ${customerId}`);
  }

  // Send KYC result notification to customer via WhatsApp
  await sendKYCResultNotification(customerId, decision, reason);
}

/**
 * Send KYC result notification to customer via WhatsApp Cloud API.
 * Updates the onboarding session state based on the KYC decision.
 */
async function sendKYCResultNotification(
  customerId: string,
  decision: string,
  reason: string
): Promise<void> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('WhatsApp credentials not configured, skipping KYC notification');
    return;
  }

  try {
    // Look up customer phone number
    const { data: customer } = await db
      .from('customers')
      .select('phone_number, whatsapp_number')
      .eq('id', customerId)
      .single()
      .execute();

    if (!customer) {
      console.warn(`Customer ${customerId} not found, skipping notification`);
      return;
    }

    const phoneNumber = customer.whatsapp_number || customer.phone_number;
    if (!phoneNumber) {
      console.warn(`No phone number for customer ${customerId}`);
      return;
    }

    // Build notification message based on decision
    let message: string;
    if (decision === 'APPROVED') {
      message = `✅ *Identity Verified!*

Great news! Your identity has been confirmed.

⏳ *Assessing your eligibility...*

We're calculating your loan amount based on:
✓ Identity verification
✓ Income information
✓ First-time borrower status

Reply with any message to continue.`;
    } else if (decision === 'REJECTED') {
      message = `❌ *Verification Unsuccessful*

${reason || 'We could not verify your identity.'}

You may have remaining attempts. Reply with any message to check your options.`;
    } else {
      // MANUAL_REVIEW
      message = `⏸️ *Manual Review Required*

Your verification needs additional review by our team. This typically takes 2-12 hours.

You'll receive a WhatsApp message when complete.`;
    }

    // Update onboarding session state
    const kycStatus = decision === 'APPROVED' ? 'verified'
      : decision === 'REJECTED' ? 'rejected'
      : 'manual_review';

    // Update session: move to credit_scoring if approved, back to kyc_id_upload if rejected
    const { data: session } = await db
      .from('whatsapp_sessions')
      .select('current_state, state_data')
      .eq('phone_number', phoneNumber)
      .single()
      .execute();

    if (session && session.current_state === 'kyc_processing') {
      const stateData = session.state_data || {};

      if (decision === 'APPROVED') {
        await db
          .from('whatsapp_sessions')
          .update({
            current_state: 'credit_scoring',
            state_data: { ...stateData, kyc_status: 'verified' },
            last_activity_at: new Date()
          })
          .eq('phone_number', phoneNumber)
          .execute();
      } else if (decision === 'REJECTED') {
        const retryCount = (stateData.retry_count || 0) + 1;
        const nextState = retryCount >= 3 ? 'rejected' : 'kyc_id_upload';

        await db
          .from('whatsapp_sessions')
          .update({
            current_state: nextState,
            state_data: {
              ...stateData,
              kyc_status: kycStatus,
              id_photo_url: undefined,
              selfie_photo_url: undefined,
              id_number: undefined,
              retry_count: retryCount
            },
            last_activity_at: new Date()
          })
          .eq('phone_number', phoneNumber)
          .execute();
      }
    }

    // Send WhatsApp message via Cloud API
    const sanitizedPhone = phoneNumber.replace(/[\s\-+()]/g, '');
    await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: sanitizedPhone,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`KYC notification sent to customer ${customerId} (${decision})`);

  } catch (error) {
    // Non-fatal: log but don't fail the KYC processing
    console.error('Failed to send KYC notification:', error instanceof Error ? error.message : error);
  }
}

/**
 * GET /kyc/{customerId}
 * Get KYC status for a customer
 */
async function getKYCStatus(customerId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
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
      .order('created_at', { ascending: false })
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
    console.error('Error fetching KYC status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch KYC status',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
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
    console.error('Error checking retry eligibility:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to check retry eligibility',
        message: 'An unexpected error occurred. Please try again later.'
      }),
      headers: getSecurityHeaders(event)
    };
  }
}
