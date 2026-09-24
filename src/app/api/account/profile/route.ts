import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/types';

const profileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const parsed = profileSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Please provide a valid name and phone number.' }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set({
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone });

    if (!updated) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}