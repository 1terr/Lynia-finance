const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface FormResult {
  success: boolean;
  error?: string;
}

export async function submitForm(formData: Record<string, unknown>): Promise<FormResult> {
  const response = await fetch(`${API_URL}/forms/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  const json = await response.json();
  if (!response.ok) {
    return { success: false, error: json.error || 'Something went wrong' };
  }
  return { success: true };
}
