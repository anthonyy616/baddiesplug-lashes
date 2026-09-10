import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { availabilityOverrides } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAdminSession } from '@/lib/admin-auth';
import { isValidDateString, isValidTimeString } from '@/lib/timezone';

const createSchema = z.object({
  date: z.string().refine(isValidDateString, 'Invalid date'),
  startTime: z.string().refine(isValidTimeString, 'Invalid start time'),
  endTime: z.string().refine(isValidTimeString, 'Invalid end time'),
  mode: z.enum(['available', 'blocked']),
  reason: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();

    const date = request.nextUrl.searchParams.get('date');
    const overrides = date
      ? await db.query.availabilityOverrides.findMany({
          where: eq(availabilityOverrides.date, date),
        })
      : await db.query.availabilityOverrides.findMany({ limit: 200 });

    return NextResponse.json({ overrides });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin availability GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid override data' }, { status: 400 });
    }

    // Prevent duplicate overrides for the same slot
    const existing = await db.query.availabilityOverrides.findFirst({
      where: and(
        eq(availabilityOverrides.date, parsed.data.date),
        eq(availabilityOverrides.startTime, parsed.data.startTime),
        eq(availabilityOverrides.endTime, parsed.data.endTime)
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(availabilityOverrides)
        .set({
          mode: parsed.data.mode,
          reason: parsed.data.reason,
          updatedAt: new Date(),
        })
        .where(eq(availabilityOverrides.id, existing.id))
        .returning();
      return NextResponse.json({ success: true, override: updated });
    }

    const [created] = await db
      .insert(availabilityOverrides)
      .values({
        id: uuidv4(),
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        mode: parsed.data.mode,
        reason: parsed.data.reason ?? null,
        createdByAdminId: null,
      })
      .returning();

    void admin;

    return NextResponse.json({ success: true, override: created });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin availability POST error:', error);
    return NextResponse.json({ error: 'Failed to save override' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing override id' }, { status: 400 });
    }

    await db.delete(availabilityOverrides).where(eq(availabilityOverrides.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin availability DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete override' }, { status: 500 });
  }
}
