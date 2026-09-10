import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { passwordResetTokens, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email/send';
import { checkRateLimit, RateLimits, createRateLimitKey } from '@/lib/rate-limit';

const schema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    // Rate limit password reset requests (per email, not just per IP)
    const body = await request.json();
    const email = (body.email ?? '').toLowerCase();
    
    const identifier = createRateLimitKey(request, email);
    const rateLimitResult = await checkRateLimit(identifier, RateLimits.passwordReset);
    if (!rateLimitResult.allowed) {
      // Always return success to avoid account enumeration, even when rate limited
      return NextResponse.json({ success: true });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });

    // Always return success to avoid account enumeration
    if (user && !user.deletedAt) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        id: uuidv4(),
        identifier: email,
        token,
        expires,
      });

      const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || '';
      const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

      await sendEmail({
        to: email,
        subject: 'Reset your password — The Baddies Plug',
        html: `
          <p>Hi ${user.name},</p>
          <p>We received a request to reset your password. This link is valid for 1 hour:</p>
          <p><a href="${resetUrl}">Reset your password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      }).catch(() => {
        // Never leak whether the email failed
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ success: true });
  }
}
