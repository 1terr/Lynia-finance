import { NextRequest } from 'next/server';
import { submitForm } from '@/lib/supabase';
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

  try {
    const result = await submitForm({
      type: 'waitlist',
      phone,
    });

    if (result.error) {
      console.error('waitlist submit failed', { error: result.error });
      return jsonError('Failed to save. Please try again.', 500);
    }
  } catch {
    return jsonError('Failed to save. Please try again.', 500);
  }

  return Response.json({ success: true });
}
