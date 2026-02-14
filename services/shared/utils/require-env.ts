/**
 * Environment Variable Validation Utility
 * Ensures required environment variables are present at startup.
 * Prevents silent fallback to test credentials in production.
 */

/**
 * Retrieve a required environment variable or throw a descriptive error.
 * Use this for secrets and credentials that must never have fallback values.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Ensure it is set in the Lambda configuration or Secrets Manager.`
    );
  }
  return value;
}
