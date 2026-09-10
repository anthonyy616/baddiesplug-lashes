import { Redis } from '@upstash/redis';

/**
 * Rate limiting using Upstash Redis.
 *
 * Sliding-window rate limiter for protecting endpoints from abuse.
 * Uses Upstash Redis (serverless, works in Vercel/edge environments).
 *
 * Environment variables required:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
});

const isEnabled = () => {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
};

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Key prefix for Redis */
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds until retry is allowed
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * Uses a sliding window counter approach:
 * - Increment counter for current window
 * - If over limit, reject
 * - Set TTL on key to window size
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!isEnabled()) {
    // Rate limiting disabled — allow all requests
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: new Date(),
    };
  }

  const key = `rate_limit:${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  try {
    // Use a sliding window: count requests in current window
    const [count, ttl] = await redis
      .pipeline()
      .incr(key)
      .expire(key, config.windowSeconds)
      .exec();

    const currentCount = (count as number) ?? 0;
    const remaining = Math.max(0, config.limit - currentCount);

    if (currentCount > config.limit) {
      // Calculate when the oldest request in the window expires
      const resetAt = new Date(now + config.windowSeconds * 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: config.windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt: new Date(now + config.windowSeconds * 1000),
    };
  } catch (error) {
    // On Redis errors, allow the request (fail open)
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: new Date(),
    };
  }
}

/**
 * Common rate limit configurations.
 */
export const RateLimits = {
  // Login attempts: 5 per minute per IP/email
  login: {
    limit: 5,
    windowSeconds: 60,
    keyPrefix: 'login',
  } as RateLimitConfig,

  // Booking creation: 10 per minute per user
  booking: {
    limit: 10,
    windowSeconds: 60,
    keyPrefix: 'booking',
  } as RateLimitConfig,

  // Reference photo uploads: 20 per minute per user
  upload: {
    limit: 20,
    windowSeconds: 60,
    keyPrefix: 'upload',
  } as RateLimitConfig,

  // Password reset: 3 per hour per email
  passwordReset: {
    limit: 3,
    windowSeconds: 3600,
    keyPrefix: 'password_reset',
  } as RateLimitConfig,

  // Admin mutations: 100 per minute (lighter limit for runaway scripts)
  admin: {
    limit: 100,
    windowSeconds: 60,
    keyPrefix: 'admin',
  } as RateLimitConfig,
} as const;

/**
 * Create a rate limit key from request data.
 * Uses IP address as the identifier, with optional user/email suffix.
 */
export function createRateLimitKey(request: Request, suffix?: string): string {
  // Get IP from headers (Vercel sets this)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // Add fingerprint if available (e.g., user ID for authenticated requests)
  const fingerprint = suffix ? `:${suffix}` : '';

  return `${ip}${fingerprint}`;
}
