import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db
      .select()
      .from(notifications)
      .where(sql`${notifications.customerId} = ${user.id}`)
      .orderBy(sql`${notifications.createdAt} DESC`)
      .limit(50);

    return NextResponse.json({ notifications: result });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const now = new Date();

    if (body.markAll === true) {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(
          sql`${notifications.customerId} = ${user.id} AND ${notifications.isRead} = false`
        );
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      const notification = await db.query.notifications.findFirst({
        where: sql`${notifications.id} = ${body.id} AND ${notifications.customerId} = ${user.id}`,
      });

      if (!notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      await db
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(sql`${notifications.id} = ${body.id}`);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
