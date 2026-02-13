import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../shared/clients/database';
import {
  isValidEmail,
  isValidPhoneNumber,
  sanitizePhoneNumber,
} from '../../shared/utils/validation';

const VALID_PARTNER_TYPES = ['distributor', 'b2b', 'other'] as const;

/** Strip control characters and limit length. */
function sanitise(input: string, maxLength = 1000): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, maxLength);
}

function corsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = [
    'https://lyniafinance.com',
    'https://www.lyniafinance.com',
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://localhost:3001']
      : []),
  ];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'X-Content-Type-Options': 'nosniff',
  };
}

function ok(data: unknown, event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return { statusCode: 200, body: JSON.stringify({ success: true, data }), headers: corsHeaders(event) };
}

function err(message: string, status: number, event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return { statusCode: status, body: JSON.stringify({ success: false, error: message }), headers: corsHeaders(event) };
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
      return { statusCode: 204, body: '', headers: corsHeaders(event) };
    }

    if (event.httpMethod !== 'POST') {
      return err('Method not allowed', 405, event);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return err('Invalid JSON body', 400, event);
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
        return err('Invalid form type', 400, event);
    }
  } catch (error) {
    console.error('Form submission error', { error });
    return err('Internal server error', 500, event);
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

  if (!name) return err('Name is required', 400, event);
  if (!isValidPhoneNumber(phone)) {
    return err('A valid Zimbabwe phone number is required', 400, event);
  }
  if (email && !isValidEmail(email)) {
    return err('Invalid email address', 400, event);
  }

  const { error } = await db.from('contact_submissions').insert({
    name,
    phone,
    email: email || null,
    message: message || null,
  }).execute();

  if (error) {
    console.error('contact insert failed', { error: error.message });
    return err('Failed to save your message. Please try again.', 500, event);
  }

  return ok(null, event);
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

  if (!name) return err('Name is required', 400, event);
  if (!isValidPhoneNumber(phone)) {
    return err('A valid Zimbabwe phone number is required', 400, event);
  }
  if (!email || !isValidEmail(email)) {
    return err('A valid email address is required', 400, event);
  }
  if (!VALID_PARTNER_TYPES.includes(partnerType as typeof VALID_PARTNER_TYPES[number])) {
    return err('Select a valid partnership type', 400, event);
  }

  const { error } = await db.from('partnership_applications').insert({
    name,
    phone,
    email,
    partner_type: partnerType,
    message: message || null,
  }).execute();

  if (error) {
    console.error('partnership insert failed', { error: error.message });
    return err('Failed to save your application. Please try again.', 500, event);
  }

  return ok(null, event);
}

async function handleWaitlist(
  body: Record<string, unknown>,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const phone = typeof body.phone === 'string' ? sanitizePhoneNumber(body.phone) : '';

  if (!isValidPhoneNumber(phone)) {
    return err('A valid Zimbabwe phone number is required', 400, event);
  }

  const { error } = await db.from('waitlist').insert({ phone }).execute();

  if (error) {
    // Handle duplicate phone (UNIQUE constraint)
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return ok(null, event); // Silently succeed — already on the list
    }
    console.error('waitlist insert failed', { error: error.message });
    return err('Failed to save. Please try again.', 500, event);
  }

  return ok(null, event);
}
