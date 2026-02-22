/**
 * Mask phone numbers for display. Shows first 4 and last 3 digits.
 *
 * @example
 * maskPhone('+263771234567') // '+263****567'
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length <= 7) return cleaned;
  return cleaned.slice(0, 4) + '****' + cleaned.slice(-3);
}

/**
 * Mask national IDs for display. Shows first 2 and last 2 characters.
 *
 * @example
 * maskId('12345678A90') // '12******90'
 */
export function maskId(id: string): string {
  if (!id || id.length < 5) return id;
  return id.slice(0, 2) + '******' + id.slice(-2);
}
