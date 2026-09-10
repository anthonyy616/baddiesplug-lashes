import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { passwordResetTokens, users, credentials } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    const reset = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expires, new Date())
      ),
    });

    if (!reset) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired.' },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, reset.identifier),
    });
    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.transaction(async (tx) => {
      const existing = await tx.query.credentials.findFirst({
        where: eq(credentials.authUserId, user.authUserId),
      });

      if (existing) {
        await tx
          .update(credentials)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(credentials.id, existing.id));
      } else {
        await tx.insert(credentials).values({
          authUserId: user.authUserId,
          passwordHash,
        });
      }

      // Single-use: consume the token
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, reset.id));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
