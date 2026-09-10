import 'server-only';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Generate an Apple client secret JWT.
 *
 * Apple requires the client secret to be a JWT signed with the private key
 * (.p8 file) from the Apple Developer portal. The JWT must:
 * - Be signed with ES256 algorithm
 * - Have an audience of https://appleid.apple.com
 * - Include the client_id (Services ID) in the claims
 * - Have a reasonable expiration (Apple recommends max 6 months, we use 6 hours)
 *
 * This function reads the private key from environment variables and generates
 * a fresh JWT on each call. For production, consider caching the JWT until
 * it's close to expiration.
 */

interface AppleJWTConfig {
  teamId: string;
  keyId: string;
  clientId: string; // Services ID
  privateKey: string; // PEM-formatted .p8 key content
}

/**
 * Generate a client secret JWT for Apple Sign in with Apple.
 */
export async function generateAppleClientSecret(config: AppleJWTConfig): Promise<string> {
  const { teamId, keyId, clientId, privateKey } = config;

  if (!teamId || !keyId || !clientId || !privateKey) {
    throw new Error('Missing required Apple JWT configuration: teamId, keyId, clientId, and privateKey are all required');
  }

  // Ensure the private key has proper PEM headers
  const normalizedKey = privateKey.startsWith('-----BEGIN') ? privateKey : `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;

  // Import the PKCS8 private key as a CryptoKey
  const privateKeyObject = await importPKCS8(normalizedKey, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const expiration = now + 6 * 60 * 60; // 6 hours

  // Build and sign the JWT
  const clientSecret = new SignJWT({
    iss: teamId,
    aud: 'https://appleid.apple.com',
    sub: clientId,
    iat: now,
    exp: expiration,
  })
    .setProtectedHeader({
      alg: 'ES256',
      kid: keyId,
    });

  return clientSecret.sign(privateKeyObject);
}

/**
 * Get the Apple JWT configuration from environment variables.
 * Supports both direct key content and file path.
 */
export function getAppleJWTConfig(): AppleJWTConfig | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!teamId || !keyId || !clientId) {
    return null;
  }

  // Use direct key content if available, otherwise warn about missing key
  if (!privateKey) {
    console.warn('Apple OAuth: APPLE_PRIVATE_KEY is not set. Apple Sign in with Apple will not work.');
    return null;
  }

  return {
    teamId,
    keyId,
    clientId,
    privateKey,
  };
}

/**
 * Generate Apple client secret synchronously (for use in provider config).
 * Returns a pre-generated secret or empty string if config is missing.
 *
 * Note: For production use, consider generating this dynamically and caching
 * until near expiration to avoid excessive JWT generation.
 */
export async function getAppleClientSecret(): Promise<string> {
  const config = getAppleJWTConfig();
  if (!config) {
    return '';
  }

  try {
    return await generateAppleClientSecret(config);
  } catch (error) {
    console.error('Failed to generate Apple client secret:', error);
    return '';
  }
}
