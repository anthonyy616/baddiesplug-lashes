import { NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitKey, RateLimits } from '../rate-limit';
import type { RateLimitConfig } from '../rate-limit';

/**
 * Rate limiting middleware factory.
 *
 * Returns a function that can be used in Next.js middleware or route handlers
 * to enforce rate limits.
 */

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async function rateLimit(request: Request, suffix?: string): Promise<NextResponse | null> {
    const identifier = createRateLimitKey(request, suffix);

    const result = await checkRateLimit(identifier, config);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: result.retryAfter,
          detail: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toISOString(),
          },
        }
      );
    }

    // Add rate limit headers to response (for transparency)
    return null; // Continue processing
  };
}

/**
 * Apply rate limiting headers to a successful response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  resetAt: Date
): NextResponse {
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', resetAt.toISOString());
  return response;
}
