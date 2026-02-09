/**
 * AWS Secrets Manager Utility
 * Retrieves and caches secrets for Lambda functions.
 * Secrets are cached in-memory for the Lambda execution lifetime
 * to minimize API calls and reduce latency.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// In-memory cache: persists across warm Lambda invocations
const secretCache = new Map<string, { value: Record<string, string>; expiry: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieve a secret from AWS Secrets Manager with in-memory caching.
 * On cold start, the first call fetches from Secrets Manager.
 * Subsequent calls within the TTL return the cached value.
 */
export async function getSecret(secretName: string): Promise<Record<string, string>> {
  const cached = secretCache.get(secretName);
  if (cached && Date.now() < cached.expiry) {
    return cached.value;
  }

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} has no string value`);
  }

  const parsed = JSON.parse(response.SecretString) as Record<string, string>;

  secretCache.set(secretName, {
    value: parsed,
    expiry: Date.now() + CACHE_TTL_MS,
  });

  return parsed;
}

/**
 * Build the secret name for a given service based on the current environment.
 * Format: {environment}/lynia/{service}
 */
export function buildSecretName(service: string): string {
  const env = process.env.NODE_ENV || 'development';
  return `${env}/lynia/${service}`;
}

/**
 * Retrieve Supabase credentials from Secrets Manager.
 */
export async function getSupabaseSecrets(): Promise<{
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}> {
  const secrets = await getSecret(buildSecretName('supabase'));
  return {
    SUPABASE_URL: secrets.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: secrets.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/**
 * Retrieve WhatsApp Cloud API credentials.
 */
export async function getWhatsAppSecrets(): Promise<{
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
}> {
  const secrets = await getSecret(buildSecretName('whatsapp'));
  return {
    WHATSAPP_PHONE_NUMBER_ID: secrets.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN: secrets.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: secrets.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  };
}

/**
 * Retrieve Smile Identity (KYC) credentials.
 */
export async function getSmileIdentitySecrets(): Promise<{
  SMILE_PARTNER_ID: string;
  SMILE_API_KEY: string;
}> {
  const secrets = await getSecret(buildSecretName('smile-identity'));
  return {
    SMILE_PARTNER_ID: secrets.SMILE_PARTNER_ID,
    SMILE_API_KEY: secrets.SMILE_API_KEY,
  };
}

/**
 * Retrieve EcoCash payment credentials.
 */
export async function getEcocashSecrets(): Promise<{
  ECOCASH_MERCHANT_ID: string;
  ECOCASH_API_KEY: string;
}> {
  const secrets = await getSecret(buildSecretName('ecocash'));
  return {
    ECOCASH_MERCHANT_ID: secrets.ECOCASH_MERCHANT_ID,
    ECOCASH_API_KEY: secrets.ECOCASH_API_KEY,
  };
}

/**
 * Retrieve OneMoney payment credentials.
 */
export async function getOnemoneySecrets(): Promise<{
  ONEMONEY_MERCHANT_ID: string;
  ONEMONEY_API_KEY: string;
}> {
  const secrets = await getSecret(buildSecretName('onemoney'));
  return {
    ONEMONEY_MERCHANT_ID: secrets.ONEMONEY_MERCHANT_ID,
    ONEMONEY_API_KEY: secrets.ONEMONEY_API_KEY,
  };
}

/**
 * Retrieve Trustonic device lock credentials.
 */
export async function getTrustonicSecrets(): Promise<{
  TRUSTONIC_API_KEY: string;
  TRUSTONIC_API_SECRET: string;
}> {
  const secrets = await getSecret(buildSecretName('trustonic'));
  return {
    TRUSTONIC_API_KEY: secrets.TRUSTONIC_API_KEY,
    TRUSTONIC_API_SECRET: secrets.TRUSTONIC_API_SECRET,
  };
}

/**
 * Retrieve SMS provider credentials.
 */
export async function getSmsSecrets(): Promise<{
  SMS_API_KEY: string;
}> {
  const secrets = await getSecret(buildSecretName('sms'));
  return {
    SMS_API_KEY: secrets.SMS_API_KEY,
  };
}

/**
 * Clear the in-memory cache. Useful for testing or forced refresh.
 */
export function clearSecretCache(): void {
  secretCache.clear();
}
