import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/clients/database';
import {
  isValidEmail,
  isValidPhoneNumber,
  sanitizePhoneNumber,
} from '../../shared/utils/validation';
import {
  successResponse,
  errorResponse,
} from '../../shared/utils/response';
import logger from '../../shared/utils/logger';

const VALID_PARTNER_TYPES = ['distributor', 'b2b', 'other'] as const;

/** Strip control characters and limit length. */
function sanitise(input: string, maxLength = 1000): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, maxLength);
}

/**
 * Form Submission Service Lambda Handler
 *
 * Public endpoint — no Cognito authorizer.
 * Handles POST /forms/submit with a `type` discriminator.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return successResponse(null, 204, event);
    }

    if (event.httpMethod !== 'POST') {
      return errorResponse('Method not allowed', 405, undefined, event);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return errorResponse('Invalid JSON body', 400, undefined, event);
    }

    const type = typeof body.type === 'string' ? body.type : '';

    switch (type) {
      case 'contact':
        return await handleContact(body, event);
      case 'partnership':
        return await handlePartnership(body, event);
      case 'waitlist':
        return await handleWaitlist(body, event);
      default:
        return errorResponse('Invalid form type', 400, undefined, event);
    }
  } catch (error) {
    logger.error('Form submission error', {
      action: 'form.submit',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Internal server error', 500, undefined, event);
  }
};

async function handleContact(
  body: Record<string, unknown>,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const name = typeof body.name === 'string' ? sanitise(body.name, 200) : '';
  const phone = typeof body.phone === 'string' ? sanitizePhoneNumber(body.phone) : '';
  const email = typeof body.email === 'string' ? sanitise(body.email, 320) : '';
  const message = typeof body.message === 'string' ? sanitise(body.message) : '';

  if (!name) return errorResponse('Name is required', 400, undefined, event);
  if (!isValidPhoneNumber(phone)) {
    return errorResponse('A valid Zimbabwe phone number is required', 400, undefined, event);
  }
  if (email && !isValidEmail(email)) {
    return errorResponse('Invalid email address', 400, undefined, event);
  }

  const { error } = await db.from('contact_submissions').insert({
    name,
    phone,
    email: email || null,
    message: message || null,
  }).execute();

  if (error) {
    logger.error('Contact insert failed', {
      action: 'form.contact',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to save your message. Please try again.', 500, undefined, event);
  }

  return successResponse(null, 200, event);
}

async function handlePartnership(
  body: Record<string, unknown>,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const name = typeof body.name === 'string' ? sanitise(body.name, 200) : '';
  const phone = typeof body.phone === 'string' ? sanitizePhoneNumber(body.phone) : '';
  const email = typeof body.email === 'string' ? sanitise(body.email, 320) : '';
  const partnerType = typeof body.partner_type === 'string' ? body.partner_type : '';
  const message = typeof body.message === 'string' ? sanitise(body.message) : '';

  if (!name) return errorResponse('Name is required', 400, undefined, event);
  if (!isValidPhoneNumber(phone)) {
    return errorResponse('A valid Zimbabwe phone number is required', 400, undefined, event);
  }
  if (!email || !isValidEmail(email)) {
    return errorResponse('A valid email address is required', 400, undefined, event);
  }
  if (!VALID_PARTNER_TYPES.includes(partnerType as typeof VALID_PARTNER_TYPES[number])) {
    return errorResponse('Select a valid partnership type', 400, undefined, event);
  }

  const { error } = await db.from('partnership_applications').insert({
    name,
    phone,
    email,
    partner_type: partnerType,
    message: message || null,
  }).execute();

  if (error) {
    logger.error('Partnership insert failed', {
      action: 'form.partnership',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to save your application. Please try again.', 500, undefined, event);
  }

  return successResponse(null, 200, event);
}

async function handleWaitlist(
  body: Record<string, unknown>,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const phone = typeof body.phone === 'string' ? sanitizePhoneNumber(body.phone) : '';

  if (!isValidPhoneNumber(phone)) {
    return errorResponse('A valid Zimbabwe phone number is required', 400, undefined, event);
  }

  const { error } = await db.from('waitlist').insert({ phone }).execute();

  if (error) {
    // Handle duplicate phone (UNIQUE constraint)
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return successResponse(null, 200, event); // Silently succeed — already on the list
    }
    logger.error('Waitlist insert failed', {
      action: 'form.waitlist',
      status: 'failed',
      errorMessage: error.message,
    });
    return errorResponse('Failed to save. Please try again.', 500, undefined, event);
  }

  return successResponse(null, 200, event);
}
