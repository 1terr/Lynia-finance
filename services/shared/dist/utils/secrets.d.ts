/**
 * AWS Secrets Manager Utility
 * Retrieves and caches secrets for Lambda functions.
 * Secrets are cached in-memory for the Lambda execution lifetime
 * to minimize API calls and reduce latency.
 */
/**
 * Retrieve a secret from AWS Secrets Manager with in-memory caching.
 * On cold start, the first call fetches from Secrets Manager.
 * Subsequent calls within the TTL return the cached value.
 */
export declare function getSecret(secretName: string): Promise<Record<string, string>>;
/**
 * Build the secret name for a given service based on the current environment.
 * Format: {environment}/lynia/{service}
 */
export declare function buildSecretName(service: string): string;
/**
 * Retrieve Supabase credentials from Secrets Manager.
 */
export declare function getSupabaseSecrets(): Promise<{
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
}>;
/**
 * Retrieve WhatsApp Cloud API credentials.
 */
export declare function getWhatsAppSecrets(): Promise<{
    WHATSAPP_PHONE_NUMBER_ID: string;
    WHATSAPP_ACCESS_TOKEN: string;
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
}>;
/**
 * Retrieve Smile Identity (KYC) credentials.
 */
export declare function getSmileIdentitySecrets(): Promise<{
    SMILE_PARTNER_ID: string;
    SMILE_API_KEY: string;
}>;
/**
 * Retrieve EcoCash payment credentials.
 */
export declare function getEcocashSecrets(): Promise<{
    ECOCASH_MERCHANT_ID: string;
    ECOCASH_API_KEY: string;
}>;
/**
 * Retrieve OneMoney payment credentials.
 */
export declare function getOnemoneySecrets(): Promise<{
    ONEMONEY_MERCHANT_ID: string;
    ONEMONEY_API_KEY: string;
}>;
/**
 * Retrieve Trustonic device lock credentials.
 */
export declare function getTrustonicSecrets(): Promise<{
    TRUSTONIC_API_KEY: string;
    TRUSTONIC_API_SECRET: string;
}>;
/**
 * Retrieve SMS provider credentials.
 */
export declare function getSmsSecrets(): Promise<{
    SMS_API_KEY: string;
}>;
/**
 * Clear the in-memory cache. Useful for testing or forced refresh.
 */
export declare function clearSecretCache(): void;
//# sourceMappingURL=secrets.d.ts.map