import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalisePhone, isValidPhone, jsonError } from '@/lib/validation';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const phone = typeof body.phone === 'string' ? normalisePhone(body.phone) : '';

  if (!isValidPhone(phone)) {
    return jsonError('A valid Zimbabwe phone number is required', 400);
  }

  let db;
  try {
    db = getSupabaseAdmin();
  } catch {
    return jsonError('Form service is not configured', 503);
  }

  const { error } = await db.from('waitlist').upsert(
    { phone },
    { onConflict: 'phone' }
  );

  if (error) {
    console.error('waitlist upsert failed', { code: error.code });
    return jsonError('Failed to save. Please try again.', 500);
  }

  return Response.json({ success: true });
}
