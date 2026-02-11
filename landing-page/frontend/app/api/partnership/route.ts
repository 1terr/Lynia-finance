import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  sanitise,
  normalisePhone,
  isValidPhone,
  isValidEmail,
  jsonError,
} from '@/lib/validation';

const VALID_TYPES = ['distributor', 'b2b', 'other'] as const;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const name = typeof body.name === 'string' ? sanitise(body.name, 200) : '';
  const phone = typeof body.phone === 'string' ? normalisePhone(body.phone) : '';
  const email = typeof body.email === 'string' ? sanitise(body.email, 320) : '';
  const partnerType = typeof body.partnerType === 'string' ? body.partnerType : '';
  const message = typeof body.message === 'string' ? sanitise(body.message) : '';

  if (!name) return jsonError('Name is required', 400);
  if (!isValidPhone(phone)) {
    return jsonError('A valid Zimbabwe phone number is required', 400);
  }
  if (!email || !isValidEmail(email)) {
    return jsonError('A valid email address is required', 400);
  }
  if (!VALID_TYPES.includes(partnerType as typeof VALID_TYPES[number])) {
    return jsonError('Select a valid partnership type', 400);
  }

  let db;
  try {
    db = getSupabaseAdmin();
  } catch {
    return jsonError('Form service is not configured', 503);
  }

  const { error } = await db.from('partnership_applications').insert({
    name,
    phone,
    email,
    partner_type: partnerType,
    message: message || null,
  });

  if (error) {
    console.error('partnership insert failed', { code: error.code });
    return jsonError('Failed to save your application. Please try again.', 500);
  }

  return Response.json({ success: true });
}
