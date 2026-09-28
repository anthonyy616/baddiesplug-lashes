import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, desc, notLike } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/admin-auth';
import { isAdminNotification } from '@/types';

const markSchema = z.object({
  id: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdminSession();

    // Filter consistently with the admin page: exclude customer-facing
    // notifications (customer_ prefix) here, not just in the UI. Generic
    // booking_* types (e.g. booking_cancelled with a customerId) remain
    // admin-visible — only the customer_ prefix marks customer-facing types.
    const all = await db.query.notifications.findMany({
      where: notLike(notifications.type, 'customer_%'),
      orderBy: [desc(notifications.createdAt)],
      limit: 200,
    });

    return NextResponse.json({
      notifications: all.filter((n) => isAdminNotification(n.type)),
    });
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
