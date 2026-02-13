/**
 * Site-wide constants.
 *
 * Centralised so marketing links, social URLs, and contact info
 * only need to be updated in one place.
 */

// TODO(launch): Replace 263XXXXXXXXX with the real Lynia WhatsApp business number
export const WHATSAPP_URL = 'https://wa.me/263XXXXXXXXX';

export const SOCIAL_LINKS = {
  // TODO(launch): Verify these social media URLs are correct before go-live
  twitter: 'https://x.com/lyniafinance',
  linkedin: 'https://linkedin.com/company/lyniafinance',
  whatsapp: WHATSAPP_URL,
} as const;

export const CONTACT_EMAIL = 'hello@lyniafinance.com';
