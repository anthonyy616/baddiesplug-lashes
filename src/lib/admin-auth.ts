import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { adminAuth } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Standalone admin authentication for the hidden /admin panel.
 *
 * - First login with any username+password registers that pair (scrypt-hashed)
 *   as the admin credentials.
 * - Subsequent logins must match the registered pair.
 * - A successful login issues an HMAC-signed session cookie keyed with
 *   SESSION_SECRET (e.g. `openssl rand -base64 32`).
 *
 * The admin route is additionally kept out of all public navigation; the
 * checks here are the actual security boundary, not the hiding.
 */

const COOKIE_NAME = 'baddies_admin';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const MIN_PASSWORD_LENGTH = 8;

interface SessionPayload {
  username: string;
  expiresAt: number;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set');
  }
  return secret;
}

function hmac(value: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return timingSafeEqual(candidate, hash);
}

/**
 * Attempt admin login.
 * First ever login registers the chosen username/password; later logins must
 * match. Returns a signed cookie value on success.
 */
export async function loginAdmin(
  username: string,
  password: string
): Promise<{ ok: true; cookieValue: string } | { ok: false; error: string }> {
  const trimmed = username.trim().toLowerCase();

  if (!trimmed || trimmed.length > 255) {
    return { ok: false, error: 'Please enter a username.' };
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const existing = await db.query.adminAuth.findFirst({
    where: eq(adminAuth.username, trimmed),
  });

  if (!existing) {
    // First login: register this pair as the admin credentials
    await db.insert(adminAuth).values({
      username: trimmed,
      passwordHash: hashPassword(password),
    });
  } else if (!verifyPassword(password, existing.passwordHash)) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload: SessionPayload = { username: trimmed, expiresAt };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const cookieValue = `${encoded}.${hmac(encoded)}`;

  return { ok: true, cookieValue };
}

/** Validate the signed admin session cookie; returns the username or null. */
export function getAdminSession(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;

  const dot = cookieValue.lastIndexOf('.');
  if (dot <= 0) return null;

  const encoded = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);

  let expected: string;
  try {
    expected = hmac(encoded);
  } catch {
    // SESSION_SECRET missing — treat as unauthenticated
    return null;
  }
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload.username;
  } catch {
    return null;
  }
}

/** Read the admin session from request cookies (server components/routes). */
export async function requireAdminSession(): Promise<string> {
  const cookieStore = await cookies();
  const username = getAdminSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!username) {
    throw new Error('AdminUnauthorized');
  }
  return username;
}

export function clearAdminCookieValue(): string {
  return '';
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
