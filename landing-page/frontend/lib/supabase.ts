const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function submitForm(formData: Record<string, unknown>) {
  const response = await fetch(`${API_URL}/forms/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  return response.json();
}
