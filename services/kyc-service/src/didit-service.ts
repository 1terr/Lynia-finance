import { createHmac, timingSafeEqual } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { requireEnv } from '../../shared/utils/require-env';
import { CircuitBreaker } from '../../shared/utils/circuit-breaker';
import type {
  KYCProvider,
  KYCProviderName,
  KYCSubmitParams,
  KYCSubmissionResponse,
  KYCVerificationResult,
  KYCDecision,
  KYCErrorResponse,
  KYCWarning,
} from '../../shared/types/kyc-provider';

const diditCircuitBreaker = new CircuitBreaker({
  name: 'didit-api',
  failureThreshold: 5,
  resetTimeout: 60000,
});

const DIDIT_BASE_URL = 'https://verification.didit.me';

// =====================================================
// DIDIT Response Types
// =====================================================

interface DiditIdVerificationResponse {
  request_id: string;
  id_verification: {
    status: string;
    issuing_state: string;
    issuing_state_name: string;
    document_type: string;
    document_number: string;
    first_name: string;
    last_name: string;
    full_name: string;
    date_of_birth: string;
    age: number;
    gender: string;
    nationality: string;
    expiration_date: string;
    date_of_issue: string;
    place_of_birth: string;
    portrait_image: string;
    front_document_image: string;
    back_document_image: string;
    warnings: DiditWarning[];
  };
  created_at: string;
}

interface DiditLivenessResponse {
  request_id: string;
  liveness: {
    status: string;
    method: string;
    score: number;
    user_image: {
      entities: Array<{
        age: number;
        bbox: number[];
        confidence: number;
        gender: string;
      }>;
      best_angle: number;
    };
    face_quality: number | null;
    face_luminance: number | null;
    warnings: DiditWarning[];
  };
  created_at: string;
}

interface DiditFaceMatchResponse {
  request_id: string;
  face_match: {
    status: string;
    score: number;
    user_image: {
      entities: Array<{
        age: number;
        bbox: number[];
        confidence: number;
        gender: string;
      }>;
      best_angle: number;
    };
    ref_image: {
      entities: Array<{
        age: number;
        bbox: number[];
        confidence: number;
        gender: string;
      }>;
      best_angle: number;
    };
    warnings: DiditWarning[];
  };
  created_at: string;
}

interface DiditWarning {
  risk: string;
  additional_data: unknown;
  log_type: 'information' | 'warning' | 'error';
  short_description: string;
  long_description: string;
}

/** Combined result of all three standalone API calls */
export interface DiditCombinedResult {
  id_verification: DiditIdVerificationResponse;
  liveness: DiditLivenessResponse;
  face_match: DiditFaceMatchResponse;
}

// =====================================================
// DIDIT Webhook Types
// =====================================================

interface DiditWebhookPayload {
  session_id: string;
  status: string;
  webhook_type: string;
  created_at: number;
  timestamp: number;
  workflow_id: string;
  vendor_data: string;
  metadata: Record<string, unknown>;
  decision?: {
    session_id: string;
    status: string;
    features: string[];
    id_verifications: Array<{
      node_id: string;
      status: string;
      document_type: string;
      document_number: string;
      first_name: string;
      last_name: string;
      full_name: string;
      date_of_birth: string;
      gender: string;
      nationality: string;
      expiration_date: string;
      warnings: DiditWarning[];
    }>;
    liveness_checks: Array<{
      node_id: string;
      status: string;
      score: number;
      method: string;
      warnings: DiditWarning[];
    }>;
    face_matches: Array<{
      node_id: string;
      status: string;
      score: number;
      warnings: DiditWarning[];
    }>;
    aml_screenings: Array<{
      node_id: string;
      status: string;
      total_hits: number;
      warnings: DiditWarning[];
    }>;
    created_at: string;
  };
}

// =====================================================
// DIDIT Service Implementation
// =====================================================

/**
 * DIDIT KYC Service
 * Uses three standalone APIs: ID Verification, Passive Liveness, Face Match.
 * All calls are server-to-server with multipart/form-data.
 */
export class DiditService implements KYCProvider {
  readonly providerName: KYCProviderName = 'didit';
  private apiKey: string;
  private webhookSecret: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = requireEnv('DIDIT_API_KEY');
    this.webhookSecret = requireEnv('DIDIT_WEBHOOK_SECRET');

    this.client = axios.create({
      baseURL: DIDIT_BASE_URL,
      timeout: 60000,
    });

    console.log('DiditService initialized');
  }

  /**
   * Submit KYC verification using three sequential standalone API calls:
   * 1. ID Verification (document OCR + authenticity)
   * 2. Passive Liveness (spoof detection from selfie)
   * 3. Face Match (selfie vs ID front image)
   */
  async submitVerification(params: KYCSubmitParams): Promise<KYCSubmissionResponse> {
    const { customer_id, id_image_base64, selfie_image_base64 } = params;

    const internal_job_id = `didit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    console.log(`Submitting DIDIT verification for customer ${customer_id}, job ${internal_job_id}`);

    try {
      const idImageBuffer = this.base64ToBuffer(id_image_base64);
      const selfieBuffer = this.base64ToBuffer(selfie_image_base64);

      // Step 1: ID Verification
      const idResult = await this.callIdVerification(idImageBuffer, customer_id);

      // Step 2: Passive Liveness
      const livenessResult = await this.callPassiveLiveness(selfieBuffer, customer_id);

      // Step 3: Face Match (selfie vs ID front)
      const faceMatchResult = await this.callFaceMatch(selfieBuffer, idImageBuffer, customer_id);

      const combinedResult: DiditCombinedResult = {
        id_verification: idResult,
        liveness: livenessResult,
        face_match: faceMatchResult,
      };

      const provider_job_id = idResult.request_id;

      console.log(`DIDIT verification completed: ${provider_job_id}`);

      // Attach combined result so the handler can store it in the database.
      // The _combinedResult property is stripped by the handler after extraction.
      const response: KYCSubmissionResponse & { _combinedResult?: DiditCombinedResult } = {
        success: true,
        provider_job_id,
        internal_job_id,
        message: 'KYC verification completed. Processing results.',
        _combinedResult: combinedResult,
      };

      return response;
    } catch (error) {
      console.error('DIDIT API error:', error);
      throw error;
    }
  }

  /**
   * Call the DIDIT ID Verification standalone API.
   */
  private async callIdVerification(
    frontImageBuffer: Buffer,
    vendorData: string
  ): Promise<DiditIdVerificationResponse> {
    const form = new FormData();
    form.append('front_image', frontImageBuffer, {
      filename: 'id_front.jpg',
      contentType: 'image/jpeg',
    });
    form.append('vendor_data', vendorData);
    form.append('perform_document_liveness', 'true');

    const response = await diditCircuitBreaker.execute(() =>
      this.client.post<DiditIdVerificationResponse>('/v3/id-verification/', form, {
        headers: {
          'x-api-key': this.apiKey,
          ...form.getHeaders(),
        },
      })
    );

    return response.data;
  }

  /**
   * Call the DIDIT Passive Liveness standalone API.
   */
  private async callPassiveLiveness(
    selfieBuffer: Buffer,
    vendorData: string
  ): Promise<DiditLivenessResponse> {
    const form = new FormData();
    form.append('user_image', selfieBuffer, {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg',
    });
    form.append('vendor_data', vendorData);

    const response = await diditCircuitBreaker.execute(() =>
      this.client.post<DiditLivenessResponse>('/v3/passive-liveness/', form, {
        headers: {
          'x-api-key': this.apiKey,
          ...form.getHeaders(),
        },
      })
    );

    return response.data;
  }

  /**
   * Call the DIDIT Face Match standalone API.
   */
  private async callFaceMatch(
    userImageBuffer: Buffer,
    refImageBuffer: Buffer,
    vendorData: string
  ): Promise<DiditFaceMatchResponse> {
    const form = new FormData();
    form.append('user_image', userImageBuffer, {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg',
    });
    form.append('ref_image', refImageBuffer, {
      filename: 'id_front.jpg',
      contentType: 'image/jpeg',
    });
    form.append('vendor_data', vendorData);

    const response = await diditCircuitBreaker.execute(() =>
      this.client.post<DiditFaceMatchResponse>('/v3/face-match/', form, {
        headers: {
          'x-api-key': this.apiKey,
          ...form.getHeaders(),
        },
      })
    );

    return response.data;
  }

  /**
   * Verify DIDIT webhook signature (V2 — sorted-key JSON HMAC-SHA256).
   */
  verifyWebhookSignature(signature: string, payload: string, timestamp?: string): boolean {
    if (timestamp) {
      const ts = parseInt(timestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > 300) {
        console.warn('DIDIT webhook rejected: stale timestamp');
        return false;
      }
    }

    try {
      const parsed = JSON.parse(payload);
      const canonical = JSON.stringify(this.sortKeys(this.shortenFloats(parsed)));

      const expected = createHmac('sha256', this.webhookSecret)
        .update(canonical, 'utf8')
        .digest('hex');

      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Parse DIDIT webhook payload into a normalized KYCVerificationResult.
   */
  parseWebhookPayload(rawPayload: string): KYCVerificationResult {
    const payload: DiditWebhookPayload = JSON.parse(rawPayload);

    const decision = payload.decision;
    if (!decision) {
      throw new Error('DIDIT webhook has no decision object (session still in progress)');
    }

    const idVerification = decision.id_verifications?.[0];
    const livenessCheck = decision.liveness_checks?.[0];
    const faceMatch = decision.face_matches?.[0];

    const livenessScore = livenessCheck?.score ?? 0;
    const faceMatchScore = faceMatch?.score ?? 0;
    const confidenceScore = Math.round((faceMatchScore + livenessScore) / 2);

    const livenessPassed = livenessCheck?.status === 'Approved';
    const documentApproved = idVerification?.status === 'Approved';

    const allWarnings = [
      ...(idVerification?.warnings || []),
      ...(livenessCheck?.warnings || []),
      ...(faceMatch?.warnings || []),
    ];

    const documentExpired = allWarnings.some(w => w.risk === 'DOCUMENT_EXPIRED');
    const documentTampered = allWarnings.some(
      w => w.risk === 'DOCUMENT_TAMPERED' || w.risk === 'DOCUMENT_MANIPULATED'
    );

    let matchResult: 'verified' | 'not_verified' | 'manual_review';
    if (decision.status === 'Approved') {
      matchResult = 'verified';
    } else if (decision.status === 'Declined') {
      matchResult = 'not_verified';
    } else {
      matchResult = 'manual_review';
    }

    return {
      provider: 'didit',
      provider_job_id: payload.session_id,
      internal_job_id: payload.vendor_data || payload.session_id,
      confidence_score: confidenceScore,
      face_match_score: faceMatchScore,
      liveness_score: livenessScore,
      liveness_passed: livenessPassed,
      document_authentic: documentApproved,
      document_tampered: documentTampered,
      document_expired: documentExpired,
      match_result: matchResult,
      id_info: {
        full_name: idVerification?.full_name || '',
        id_number: idVerification?.document_number || '',
        date_of_birth: idVerification?.date_of_birth || '',
        gender: this.mapGender(idVerification?.gender),
        nationality: idVerification?.nationality || null,
        document_type: idVerification?.document_type || 'NATIONAL_ID',
      },
      raw_response: payload as unknown as Record<string, unknown>,
      warnings: allWarnings.map(w => this.mapWarning(w)),
    };
  }

  /**
   * Parse the combined result from standalone API calls (not webhook).
   * Used when processing synchronous standalone results directly.
   */
  parseCombinedResult(
    combined: DiditCombinedResult,
    customerId: string,
    internalJobId: string
  ): KYCVerificationResult {
    const idV = combined.id_verification.id_verification;
    const liveness = combined.liveness.liveness;
    const faceMatch = combined.face_match.face_match;

    const livenessScore = liveness.score;
    const faceMatchScore = faceMatch.score;
    const confidenceScore = Math.round((faceMatchScore + livenessScore) / 2);

    const livenessPassed = liveness.status === 'Approved';
    const documentApproved = idV.status === 'Approved';

    const allWarnings = [
      ...(idV.warnings || []),
      ...(liveness.warnings || []),
      ...(faceMatch.warnings || []),
    ];

    const documentExpired = allWarnings.some(w => w.risk === 'DOCUMENT_EXPIRED');
    const documentTampered = allWarnings.some(
      w => w.risk === 'DOCUMENT_TAMPERED' || w.risk === 'DOCUMENT_MANIPULATED'
    );

    let matchResult: 'verified' | 'not_verified' | 'manual_review';
    if (documentApproved && livenessPassed && faceMatch.status === 'Approved') {
      matchResult = 'verified';
    } else if (
      idV.status === 'Declined' ||
      liveness.status === 'Declined' ||
      faceMatch.status === 'Declined'
    ) {
      matchResult = 'not_verified';
    } else {
      matchResult = 'manual_review';
    }

    return {
      provider: 'didit',
      provider_job_id: combined.id_verification.request_id,
      internal_job_id: internalJobId,
      confidence_score: confidenceScore,
      face_match_score: faceMatchScore,
      liveness_score: livenessScore,
      liveness_passed: livenessPassed,
      document_authentic: documentApproved,
      document_tampered: documentTampered,
      document_expired: documentExpired,
      match_result: matchResult,
      id_info: {
        full_name: idV.full_name || '',
        id_number: idV.document_number || '',
        date_of_birth: idV.date_of_birth || '',
        gender: this.mapGender(idV.gender),
        nationality: idV.nationality || null,
        document_type: idV.document_type || 'NATIONAL_ID',
      },
      raw_response: combined as unknown as Record<string, unknown>,
      warnings: allWarnings.map(w => this.mapWarning(w)),
    };
  }

  /**
   * Determine verification decision based on normalized scores.
   */
  determineDecision(result: KYCVerificationResult): KYCDecision {
    const { confidence_score, liveness_passed, document_tampered, document_expired } = result;

    // Auto-approve: all checks pass, high confidence
    if (
      result.match_result === 'verified' &&
      confidence_score >= 85 &&
      liveness_passed &&
      result.document_authentic &&
      !document_tampered &&
      !document_expired
    ) {
      return { decision: 'APPROVED', reason: 'Automatic verification successful' };
    }

    // Auto-reject: critical failure or low confidence
    if (
      result.match_result === 'not_verified' ||
      confidence_score < 50 ||
      !liveness_passed ||
      document_tampered ||
      document_expired
    ) {
      let reason = 'Verification failed: ';
      if (!liveness_passed) reason += 'Liveness check failed';
      else if (document_tampered) reason += 'Document appears tampered';
      else if (document_expired) reason += 'Document has expired';
      else if (!result.document_authentic) reason += 'Document not authentic';
      else reason += 'Low confidence score';

      return { decision: 'REJECTED', reason };
    }

    // Manual review: confidence 50-84%
    return {
      decision: 'MANUAL_REVIEW',
      reason: `Confidence score ${confidence_score}% requires manual review`,
    };
  }

  /**
   * Map DIDIT errors to user-friendly error responses.
   */
  handleError(error: unknown): KYCErrorResponse {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;

      switch (status) {
        case 400:
          return {
            retriable: true,
            user_message: 'Could not read your document. Please retake the photo with better lighting.',
            admin_action_required: false,
          };
        case 401:
          return {
            retriable: false,
            user_message: 'Verification service error. Please try again later.',
            admin_action_required: true,
          };
        case 403:
          if (message?.includes('credits')) {
            return {
              retriable: false,
              user_message: 'Verification service temporarily unavailable. Please try again later.',
              admin_action_required: true,
            };
          }
          return {
            retriable: false,
            user_message: 'Verification service error. Please try again later.',
            admin_action_required: true,
          };
        case 429:
          return {
            retriable: true,
            user_message: 'Service temporarily busy. Please try again in a few minutes.',
            admin_action_required: false,
            retry_after: new Date(Date.now() + 60 * 1000),
          };
        default:
          break;
      }
    }

    return {
      retriable: true,
      user_message: 'Verification failed. Please try again.',
      admin_action_required: false,
    };
  }

  // =====================================================
  // Private Helpers
  // =====================================================

  private base64ToBuffer(base64: string): Buffer {
    const data = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(data, 'base64');
  }

  /** Recursively sort object keys for HMAC V2 canonicalization. */
  private sortKeys(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortKeys(item));
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = this.sortKeys((obj as Record<string, unknown>)[key]);
          return sorted;
        }, {});
    }
    return obj;
  }

  /** Truncate floating-point numbers that are whole values (e.g., 5.0 -> 5). */
  private shortenFloats(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map(item => this.shortenFloats(item));
    }
    if (data !== null && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).map(([k, v]) => [
          k,
          this.shortenFloats(v),
        ])
      );
    }
    if (typeof data === 'number' && !Number.isInteger(data) && data % 1 === 0) {
      return Math.trunc(data);
    }
    return data;
  }

  private mapGender(gender: string | undefined): 'M' | 'F' | null {
    if (!gender) return null;
    const g = gender.toUpperCase();
    if (g === 'M' || g === 'MALE') return 'M';
    if (g === 'F' || g === 'FEMALE') return 'F';
    return null;
  }

  private mapWarning(w: DiditWarning): KYCWarning {
    return {
      code: w.risk,
      description: w.short_description || w.long_description,
      severity: w.log_type === 'error' ? 'error' : w.log_type === 'warning' ? 'warning' : 'info',
    };
  }
}
