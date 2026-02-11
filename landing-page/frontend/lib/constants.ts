/**
 * Site-wide constants.
 *
 * Centralised so marketing links, social URLs, and contact info
 * only need to be updated in one place.
 */

/** WhatsApp deep-link.  Replace 263XXXXXXXXX with the real business number. */
export const WHATSAPP_URL = 'https://wa.me/263XXXXXXXXX';

export const SOCIAL_LINKS = {
  twitter: 'https://x.com/lyniafinance',
  linkedin: 'https://linkedin.com/company/lyniafinance',
  whatsapp: WHATSAPP_URL,
} as const;

export const CONTACT_EMAIL = 'hello@lyniafinance.com';
