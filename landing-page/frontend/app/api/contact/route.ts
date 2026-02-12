import { NextRequest } from 'next/server';
import { submitForm } from '@/lib/supabase';
import {
  sanitise,
  normalisePhone,
  isValidPhone,
  isValidEmail,
  jsonError,
} from '@/lib/validation';

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
  const message = typeof body.message === 'string' ? sanitise(body.message) : '';

  if (!name) return jsonError('Name is required', 400);
  if (!isValidPhone(phone)) {
    return jsonError('A valid Zimbabwe phone number is required', 400);
  }
  if (email && !isValidEmail(email)) {
    return jsonError('Invalid email address', 400);
  }

  try {
    const result = await submitForm({
      type: 'contact',
      name,
      phone,
      email: email || null,
      message: message || null,
    });

    if (result.error) {
      console.error('contact submit failed', { error: result.error });
      return jsonError('Failed to save your message. Please try again.', 500);
    }
  } catch {
    return jsonError('Failed to save your message. Please try again.', 500);
  }

  return Response.json({ success: true });
}
