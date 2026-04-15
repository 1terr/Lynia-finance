/**
 * Site-wide constants.
 *
 * Centralised so marketing links, social URLs, and contact info
 * only need to be updated in one place.
 */

// Lynia Finance WhatsApp Business number: +263 71 925 2094
// Clicking this link opens a WhatsApp chat with our business number and
// routes incoming messages through the whatsapp-service webhook, where the
// 20-state onboarding machine replies automatically.
export const WHATSAPP_BUSINESS_NUMBER = '+263 71 925 2094';
export const WHATSAPP_URL = 'https://wa.me/263719252094?text=Hi%20Lynia%20Finance%2C%20I%27d%20like%20to%20enquire%20about%20a%20loan.';

export const SOCIAL_LINKS = {
  // TODO(launch): Verify these social media URLs are correct before go-live
  twitter: 'https://x.com/lyniafinance',
  linkedin: 'https://linkedin.com/company/lyniafinance',
  whatsapp: WHATSAPP_URL,
} as const;

export const CONTACT_EMAIL = 'hello@lyniafinance.com';
