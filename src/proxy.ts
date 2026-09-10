import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Tier 10 rate limiting — network-edge throttling for sensitive endpoints.
 *
 * Uses the Next.js 16 `proxy` file convention (successor to middleware.ts):
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 *
 * In-memory fixed windows, keyed by client IP + route bucket. Per-serverless-
 * instance counters are approximate under horizontal scaling, but they stop
 * brute-force and abuse bursts, which is the goal here. For strict global
 * limits, back this with Upstash Redis later.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodically evict stale buckets so the map doesn't grow unbounded.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function evictStale(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 60_000 * 15) buckets.delete(key);
  }
}

interface Rule {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Route buckets, most specific first. Bucket key = matched prefix, so e.g.
 * /api/auth/forgot-password and /api/auth/reset-password share the
 * /api/auth/ password-bucket — deliberate: prevents rotating between the
 * two endpoints to bypass limits.
 */
const RULES: [prefix: string, rule: Rule][] = [
  // Auth: password grinding + token brute force + account enumeration
  ['/api/auth/register', { limit: 5, windowSeconds: 3600 }],
  ['/api/auth/forgot-password', { limit: 5, windowSeconds: 3600 }],
  ['/api/auth/reset-password', { limit: 5, windowSeconds: 3600 }],
  // Sign-in attempts (shared bucket with NextAuth's own route)
  ['/api/auth/', { limit: 20, windowSeconds: 300 }],
  // Admin login: brute force
  ['/api/admin/login', { limit: 5, windowSeconds: 900 }],
  // Reference uploads: expensive (sharp re-encode + R2 + booking creation)
  ['/api/uploads/', { limit: 10, windowSeconds: 3600 }],
  // Booking creation/cancellation: spam + slot-squatting
  ['/api/booking', { limit: 10, windowSeconds: 3600 }],
  // Admin mutations
  ['/api/admin/', { limit: 60, windowSeconds: 60 }],
  // Availability polling from the booking UI
  ['/api/availability', { limit: 60, windowSeconds: 60 }],
];

function matchRule(pathname: string): [string, Rule] | null {
  for (const [prefix, rule] of RULES) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      return [prefix, rule];
    }
  }
  return null;
}

function getClientIp(request: NextRequest): string {
  // Vercel sets these on all deployments
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matched = matchRule(pathname);
  if (!matched) return NextResponse.next();

  const [prefix, rule] = matched;
  const now = Date.now();
  evictStale(now);

  const key = `${getClientIp(request)}:${prefix}`;
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= rule.windowSeconds * 1000) {
    buckets.set(key, { count: 1, windowStart: now });
    return NextResponse.next();
  }

  bucket.count += 1;

  if (bucket.count > rule.limit) {
    const retryAfter = Math.ceil(
      (bucket.windowStart + rule.windowSeconds * 1000 - now) / 1000
    );
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(retryAfter, 1)) },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  // Only run on the rate-limited API routes — zero overhead elsewhere.
  matcher: [
    '/api/auth/:path*',
    '/api/admin/:path*',
    '/api/uploads/:path*',
    '/api/booking/:path*',
    '/api/availability',
  ],
};
