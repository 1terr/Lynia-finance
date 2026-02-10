"use strict";
/**
 * AWS Secrets Manager Utility
 * Retrieves and caches secrets for Lambda functions.
 * Secrets are cached in-memory for the Lambda execution lifetime
 * to minimize API calls and reduce latency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.buildSecretName = buildSecretName;
exports.getSupabaseSecrets = getSupabaseSecrets;
exports.getWhatsAppSecrets = getWhatsAppSecrets;
exports.getSmileIdentitySecrets = getSmileIdentitySecrets;
exports.getEcocashSecrets = getEcocashSecrets;
exports.getOnemoneySecrets = getOnemoneySecrets;
exports.getTrustonicSecrets = getTrustonicSecrets;
exports.getSmsSecrets = getSmsSecrets;
exports.clearSecretCache = clearSecretCache;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client = new client_secrets_manager_1.SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
});
// In-memory cache: persists across warm Lambda invocations
const secretCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/**
 * Retrieve a secret from AWS Secrets Manager with in-memory caching.
 * On cold start, the first call fetches from Secrets Manager.
 * Subsequent calls within the TTL return the cached value.
 */
async function getSecret(secretName) {
    const cached = secretCache.get(secretName);
    if (cached && Date.now() < cached.expiry) {
        return cached.value;
    }
    const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    if (!response.SecretString) {
        throw new Error(`Secret ${secretName} has no string value`);
    }
    const parsed = JSON.parse(response.SecretString);
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
function buildSecretName(service) {
    const env = process.env.NODE_ENV || 'development';
    return `${env}/lynia/${service}`;
}
/**
 * Retrieve Supabase credentials from Secrets Manager.
 */
async function getSupabaseSecrets() {
    const secrets = await getSecret(buildSecretName('supabase'));
    return {
        SUPABASE_URL: secrets.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: secrets.SUPABASE_SERVICE_ROLE_KEY,
    };
}
/**
 * Retrieve WhatsApp Cloud API credentials.
 */
async function getWhatsAppSecrets() {
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
async function getSmileIdentitySecrets() {
    const secrets = await getSecret(buildSecretName('smile-identity'));
    return {
        SMILE_PARTNER_ID: secrets.SMILE_PARTNER_ID,
        SMILE_API_KEY: secrets.SMILE_API_KEY,
    };
}
/**
 * Retrieve EcoCash payment credentials.
 */
async function getEcocashSecrets() {
    const secrets = await getSecret(buildSecretName('ecocash'));
    return {
        ECOCASH_MERCHANT_ID: secrets.ECOCASH_MERCHANT_ID,
        ECOCASH_API_KEY: secrets.ECOCASH_API_KEY,
    };
}
/**
 * Retrieve OneMoney payment credentials.
 */
async function getOnemoneySecrets() {
    const secrets = await getSecret(buildSecretName('onemoney'));
    return {
        ONEMONEY_MERCHANT_ID: secrets.ONEMONEY_MERCHANT_ID,
        ONEMONEY_API_KEY: secrets.ONEMONEY_API_KEY,
    };
}
/**
 * Retrieve Trustonic device lock credentials.
 */
async function getTrustonicSecrets() {
    const secrets = await getSecret(buildSecretName('trustonic'));
    return {
        TRUSTONIC_API_KEY: secrets.TRUSTONIC_API_KEY,
        TRUSTONIC_API_SECRET: secrets.TRUSTONIC_API_SECRET,
    };
}
/**
 * Retrieve SMS provider credentials.
 */
async function getSmsSecrets() {
    const secrets = await getSecret(buildSecretName('sms'));
    return {
        SMS_API_KEY: secrets.SMS_API_KEY,
    };
}
/**
 * Clear the in-memory cache. Useful for testing or forced refresh.
 */
function clearSecretCache() {
    secretCache.clear();
}
//# sourceMappingURL=secrets.js.map