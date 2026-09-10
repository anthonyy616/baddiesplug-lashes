import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { users, credentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { checkRateLimit, RateLimits, createRateLimitKey } from '@/lib/rate-limit';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit registration attempts
    const identifier = createRateLimitKey(request);
    const rateLimitResult = await checkRateLimit(identifier, RateLimits.login);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please provide a valid name, email, and a password of at least 8 characters.' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();

    // Enforce unique email among non-deleted users
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing && !existing.deletedAt) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Try signing in instead.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const authUserId = uuidv4();

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: uuidv4(),
        authUserId,
        name: parsed.data.name,
        email,
        role: 'customer',
      });
      await tx.insert(credentials).values({ authUserId, passwordHash });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
