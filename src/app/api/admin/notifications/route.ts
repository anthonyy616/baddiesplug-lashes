import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/admin-auth';

const markSchema = z.object({
  id: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdminSession();

    const all = await db.query.notifications.findMany({
      orderBy: [desc(notifications.createdAt)],
      limit: 200,
    });

    return NextResponse.json({ notifications: all });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin notifications GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = await request.json();
    const parsed = markSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const now = new Date();

    if (parsed.data.markAll) {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(eq(notifications.isRead, false));
    } else if (parsed.data.id) {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(eq(notifications.id, parsed.data.id));
    } else {
      return NextResponse.json({ error: 'Provide id or markAll' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin notifications PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
