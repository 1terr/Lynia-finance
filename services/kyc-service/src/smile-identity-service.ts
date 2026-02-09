import { createHmac } from 'crypto';
import axios, { AxiosInstance } from 'axios';

/**
 * Smile Identity Configuration
 */
interface SmileIdentityConfig {
  partner_id: string;
  api_key: string;
  sid_server: string;
  callback_url: string;
  environment: 'test' | 'prod';
}

/**
 * Enhanced KYC Request Structure
 */
interface SmileEnhancedKYCRequest {
  partner_id: string;
  partner_params: {
    user_id: string;
    job_id: string;
    job_type: number; // 5 for Enhanced KYC
  };
  source_sdk: string;
  source_sdk_version: string;
  timestamp: string;
  country: string; // 'ZW' for Zimbabwe
  id_type: string; // 'NATIONAL_ID'
  id_number: string;
  images: Array<{
    image_type_id: number; // 0: Selfie, 1: ID front, 3: ID back
    image: string; // Base64 encoded
  }>;
  callback_url: string;
  use_enrolled_image: boolean;
  first_name?: string;
  last_name?: string;
  dob?: string; // YYYY-MM-DD
  phone_number?: string;
}

/**
 * Smile Identity Immediate Response
 */
interface SmileImmediateResponse {
  success: boolean;
  smile_job_id: string;
  timestamp: string;
  code: string;
  message: string;
}

/**
 * Smile Identity Webhook Payload
 */
export interface SmileWebhookPayload {
  partner_id: string;
  smile_job_id: string;
  job_success: boolean;
  job_complete: boolean;
  result: {
    confidence_value: number; // 0-100
    match_result: 'Verified' | 'Not Verified' | 'Under Manual Review';
    document_check: {
      authentic: boolean;
      tampered: boolean;
      expired: boolean;
      quality_score: number; // 0-100
    };
    liveness_check: {
      passed: boolean;
      score: number; // 0-100
      spoof_type: null | 'photo_of_photo' | 'video_replay' | 'mask';
    };
    face_match: {
      score: number; // 0-100
      match: boolean;
    };
    id_info: {
      full_name: string;
      id_number: string;
      dob: string; // YYYY-MM-DD
      gender: 'M' | 'F';
      address: string;
      nationality: string;
    };
  };
  timestamp: string;
  created_at: string;
  updated_at: string;
  partner_params: {
    user_id: string;
    job_id: string;
    job_type: number;
  };
}

/**
 * KYC Verification Response
 */
export interface KYCVerificationResponse {
  success: boolean;
  smile_job_id: string;
  job_id: string;
  message: string;
}

/**
 * KYC Error Response
 */
export interface KYCErrorResponse {
  retriable: boolean;
  user_message: string;
  admin_action_required: boolean;
  retry_after?: Date;
}

/**
 * Smile Identity Service
 * Handles all KYC verification operations with Smile Identity API
 */
export class SmileIdentityService {
  private config: SmileIdentityConfig;
  private client: AxiosInstance;

  constructor() {
    // Initialize configuration from environment variables
    this.config = {
      partner_id: process.env.SMILE_PARTNER_ID || 'test_partner',
      api_key: process.env.SMILE_API_KEY || 'test_api_key',
      sid_server: process.env.SMILE_SERVER_URL || 'https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/test',
      callback_url: `${process.env.API_BASE_URL || 'http://localhost:3000'}/kyc/callback`,
      environment: (process.env.NODE_ENV === 'production' ? 'prod' : 'test') as 'test' | 'prod'
    };

    // Initialize Axios client
    this.client = axios.create({
      baseURL: this.config.sid_server,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.api_key}`
      }
    });

    console.log(`SmileIdentityService initialized in ${this.config.environment} mode`);
  }

  /**
   * Submit Enhanced KYC verification request
   */
  async submitEnhancedKYC(params: {
    customer_id: string;
    id_number: string;
    id_image_base64: string;
    selfie_image_base64: string;
    first_name?: string;
    last_name?: string;
    dob?: string; // YYYY-MM-DD
    phone_number?: string;
  }): Promise<KYCVerificationResponse> {
    const {
      customer_id,
      id_number,
      id_image_base64,
      selfie_image_base64,
      first_name,
      last_name,
      dob,
      phone_number
    } = params;

    // Generate unique job ID
    const job_id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    console.log(`Submitting Enhanced KYC for customer ${customer_id}, job ${job_id}`);

    // Construct request payload
    const payload: SmileEnhancedKYCRequest = {
      partner_id: this.config.partner_id,
      partner_params: {
        user_id: customer_id,
        job_id: job_id,
        job_type: 5 // Enhanced KYC
      },
      source_sdk: 'rest_api',
      source_sdk_version: '1.0.0',
      timestamp: new Date().toISOString(),
      country: 'ZW', // Zimbabwe
      id_type: 'NATIONAL_ID',
      id_number: id_number,
      images: [
        {
          image_type_id: 0, // Selfie
          image: selfie_image_base64.startsWith('data:')
            ? selfie_image_base64
            : `data:image/jpeg;base64,${selfie_image_base64}`
        },
        {
          image_type_id: 1, // ID front
          image: id_image_base64.startsWith('data:')
            ? id_image_base64
            : `data:image/jpeg;base64,${id_image_base64}`
        }
      ],
      callback_url: this.config.callback_url,
      use_enrolled_image: false
    };

    // Add optional fields
    if (first_name) payload.first_name = first_name;
    if (last_name) payload.last_name = last_name;
    if (dob) payload.dob = dob;
    if (phone_number) payload.phone_number = phone_number;

    // Generate signature for authentication
    const signature = this.generateSignature(payload);

    try {
      // Make API request
      const response = await this.client.post<SmileImmediateResponse>(
        '/v1/id_verification',
        payload,
        {
          headers: {
            'X-Signature': signature
          }
        }
      );

      console.log(`Smile Identity job submitted successfully: ${response.data.smile_job_id}`);

      return {
        success: true,
        smile_job_id: response.data.smile_job_id,
        job_id: job_id,
        message: 'KYC verification submitted. You will be notified when complete.'
      };

    } catch (error) {
      console.error('Smile Identity API error:', error);

      if (axios.isAxiosError(error)) {
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.message;

        console.error(`Smile API Error: ${errorCode} - ${errorMessage}`);

        throw new Error(`KYC verification failed: ${errorMessage || error.message}`);
      }

      throw new Error(`KYC verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HMAC signature for request authentication
   */
  private generateSignature(payload: SmileEnhancedKYCRequest): string {
    const signatureData = {
      partner_id: payload.partner_id,
      timestamp: payload.timestamp,
      job_id: payload.partner_params.job_id
    };

    const signatureString = JSON.stringify(signatureData);

    const signature = createHmac('sha256', this.config.api_key)
      .update(signatureString)
      .digest('hex');

    return signature;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(receivedSignature: string, payload: string): boolean {
    const expectedSignature = createHmac('sha256', this.config.api_key)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(receivedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Handle Smile Identity error codes
   */
  handleSmileError(error: { response?: { data?: { code?: string; message?: string } } }): KYCErrorResponse {
    const errorCode = error.response?.data?.code;
    const errorMessage = error.response?.data?.message;

    switch (errorCode) {
      case '2201':
      case '2202':
        // Authentication errors
        console.error('Smile Identity authentication error', error);
        return {
          retriable: false,
          user_message: 'Verification service error. Please try again later.',
          admin_action_required: true
        };

      case '2203':
        // Invalid country/ID type
        return {
          retriable: false,
          user_message: 'Invalid ID type or country. Please check your details.',
          admin_action_required: false
        };

      case '2204':
        // Poor image quality
        return {
          retriable: true,
          user_message: 'Photo quality too low. Please retake with better lighting.',
          admin_action_required: false
        };

      case '2205':
        // Missing required fields
        return {
          retriable: false,
          user_message: 'Missing required information. Please complete all fields.',
          admin_action_required: false
        };

      case '2206':
        // Rate limit exceeded
        return {
          retriable: true,
          user_message: 'Service temporarily busy. Please try again in 5 minutes.',
          admin_action_required: false,
          retry_after: new Date(Date.now() + 5 * 60 * 1000)
        };

      case '2207':
        // ID not found in database
        return {
          retriable: false,
          user_message: 'National ID not found in registry. Please verify your ID number.',
          admin_action_required: false
        };

      case '2208':
        // Service unavailable
        return {
          retriable: true,
          user_message: 'Verification service temporarily unavailable. Please try again shortly.',
          admin_action_required: false,
          retry_after: new Date(Date.now() + 10 * 60 * 1000)
        };

      default:
        // Unknown error
        console.error('Unknown Smile Identity error', { code: errorCode, message: errorMessage });
        return {
          retriable: true,
          user_message: 'Verification failed. Please try again.',
          admin_action_required: false
        };
    }
  }

  /**
   * Determine verification decision based on Smile Identity result
   */
  determineVerificationDecision(result: SmileWebhookPayload['result']): {
    decision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
    reason: string;
  } {
    const confidence = result.confidence_value;
    const match_result = result.match_result;
    const liveness_passed = result.liveness_check.passed;
    const document_authentic = result.document_check.authentic;
    const document_tampered = result.document_check.tampered;
    const document_expired = result.document_check.expired;

    // Auto-approve criteria
    if (
      match_result === 'Verified' &&
      confidence >= 85 &&
      liveness_passed &&
      document_authentic &&
      !document_tampered &&
      !document_expired
    ) {
      return {
        decision: 'APPROVED',
        reason: 'Automatic verification successful'
      };
    }

    // Auto-reject criteria
    if (
      match_result === 'Not Verified' ||
      confidence < 50 ||
      !liveness_passed ||
      document_tampered ||
      document_expired
    ) {
      let reason = 'Verification failed: ';
      if (!liveness_passed) reason += 'Liveness check failed';
      else if (document_tampered) reason += 'Document appears tampered';
      else if (document_expired) reason += 'Document has expired';
      else if (!document_authentic) reason += 'Document not authentic';
      else reason += 'Low confidence score';

      return {
        decision: 'REJECTED',
        reason
      };
    }

    // Manual review (50-84% confidence)
    return {
      decision: 'MANUAL_REVIEW',
      reason: `Confidence score ${confidence}% requires manual review`
    };
  }
}
