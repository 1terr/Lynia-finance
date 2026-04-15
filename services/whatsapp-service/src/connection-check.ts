/**
 * WhatsApp Connection Check Module
 *
 * Proves at runtime that the Lambda is bound to the correct WhatsApp
 * Business phone number by querying the Graph API's phone_number
 * metadata endpoint. The Phone Number ID env var (WHATSAPP_PHONE_NUMBER_ID)
 * is an opaque Meta identifier, so the only way to confirm the Lambda
 * is actually wired to +263 71 925 2094 (and not the old test number)
 * is to ask Meta what number that ID resolves to.
 *
 * Used by:
 *  - GET /whatsapp/health?deep=true        -- operational smoke test
 *  - scripts/verify-whatsapp-connection.sh -- pre-deploy cutover check
 */

import axios from 'axios';
import { logger } from '../../shared/utils/logger';

/** Meta Graph API base URL (keep aligned with message-sender.ts) */
const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

/** Shape of the subset of Graph API fields we care about */
interface GraphPhoneNumberMetadata {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  code_verification_status: 'VERIFIED' | 'NOT_VERIFIED' | 'EXPIRED';
}

/** Result returned by `verifyConnection()` */
export interface ConnectionCheckResult {
  /** True when we successfully reached Graph API and all assertions passed. */
  connected: boolean;
  /** Phone Number ID configured on this Lambda (from env). */
  phoneNumberId: string | null;
  /** Number Meta reports for that ID, e.g. "+263 71 925 2094". */
  displayPhoneNumber: string | null;
  /** Verified business name Meta shows to customers in the chat. */
  verifiedName: string | null;
  /** Current quality rating (GREEN / YELLOW / RED / UNKNOWN). */
  qualityRating: string | null;
  /** Whether the SIM behind the number has completed OTP verification. */
  codeVerificationStatus: string | null;
  /** Value of WHATSAPP_EXPECTED_DISPLAY_NUMBER, if configured. */
  expectedDisplayNumber: string | null;
  /**
   * True when `displayPhoneNumber` matches `expectedDisplayNumber`
   * (after normalisation). Null when no expected value is configured.
   */
  matchesExpected: boolean | null;
  /** Free-form error message when `connected` is false. */
  error: string | null;
}

/**
 * Strip all non-digit characters so we can compare numbers written
 * in any format. "+263 71 925 2094" and "263719252094" both collapse
 * to "263719252094".
 */
export function normalizePhoneNumber(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Query Graph API for metadata about the configured Phone Number ID
 * and, if WHATSAPP_EXPECTED_DISPLAY_NUMBER is set, assert that Meta's
 * reported `display_phone_number` matches it.
 *
 * This function NEVER throws. Any error (missing env, network fault,
 * auth failure, mismatch) is captured in the returned object so the
 * health endpoint can always respond with JSON.
 */
export async function verifyConnection(): Promise<ConnectionCheckResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? null;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? null;
  const expectedDisplayNumber = process.env.WHATSAPP_EXPECTED_DISPLAY_NUMBER || null;

  const base: ConnectionCheckResult = {
    connected: false,
    phoneNumberId,
    displayPhoneNumber: null,
    verifiedName: null,
    qualityRating: null,
    codeVerificationStatus: null,
    expectedDisplayNumber,
    matchesExpected: null,
    error: null,
  };

  if (!phoneNumberId) {
    base.error = 'WHATSAPP_PHONE_NUMBER_ID is not set';
    logger.error('Connection check failed: missing phone number ID', {
      action: 'whatsapp.connection.check',
      status: 'failed',
    });
    return base;
  }

  if (!accessToken) {
    base.error = 'WHATSAPP_ACCESS_TOKEN is not set';
    logger.error('Connection check failed: missing access token', {
      action: 'whatsapp.connection.check',
      status: 'failed',
    });
    return base;
  }

  try {
    const response = await axios.get<GraphPhoneNumberMetadata>(
      `${GRAPH_API_URL}/${phoneNumberId}`,
      {
        params: {
          fields: 'display_phone_number,verified_name,quality_rating,code_verification_status',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 5000,
      }
    );

    const data = response.data;
    base.displayPhoneNumber = data.display_phone_number;
    base.verifiedName = data.verified_name;
    base.qualityRating = data.quality_rating;
    base.codeVerificationStatus = data.code_verification_status;

    if (expectedDisplayNumber) {
      const actual = normalizePhoneNumber(data.display_phone_number);
      const expected = normalizePhoneNumber(expectedDisplayNumber);
      base.matchesExpected = actual === expected;

      if (!base.matchesExpected) {
        base.error = `Phone number mismatch: expected ${expectedDisplayNumber}, got ${data.display_phone_number}`;
        logger.error('Connection check failed: phone number mismatch', {
          action: 'whatsapp.connection.check',
          status: 'failed',
          meta: {
            expected: expectedDisplayNumber,
            actual: data.display_phone_number,
          },
        });
        return base;
      }
    }

    base.connected = true;
    logger.info('WhatsApp connection verified', {
      action: 'whatsapp.connection.check',
      status: 'completed',
      meta: {
        phoneNumberId,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
      },
    });
    return base;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const metaError = err.response?.data?.error?.message;
      base.error = `Graph API error${status ? ` (${status})` : ''}${metaError ? `: ${metaError}` : ''}`;
    } else {
      base.error = err instanceof Error ? err.message : 'Unknown error';
    }
    logger.error('Connection check failed: Graph API request error', {
      action: 'whatsapp.connection.check',
      status: 'failed',
      meta: { error: base.error },
    });
    return base;
  }
}
