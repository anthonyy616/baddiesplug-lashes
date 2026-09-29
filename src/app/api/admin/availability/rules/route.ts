import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { availabilityRules } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/admin-auth';
import { invalidateAvailabilityCache } from '@/lib/availability';

/**
 * Advanced availability rules (Stage 9) — admin CRUD.
 *
 * GET    /api/admin/availability/rules   (all rules, active + inactive)
 * POST   /api/admin/availability/rules   (create)
 * PATCH  /api/admin/availability/rules   (update / activate / deactivate)
 * DELETE /api/admin/availability/rules?id=X
 *
 * All writes invalidate the availability request cache so customer and admin
 * surfaces immediately see the same authoritative server projection.
 */

const createSchema = z.discriminatedUnion('ruleType', [
  z.object({
    ruleType: z.literal('date_range_block'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    label: z.string().max(120).optional(),
  }),
  z.object({
    ruleType: z.literal('weekday_open'),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    label: z.string().max(120).optional(),
  }),
  z.object({
    ruleType: z.literal('weekday_hours'),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    label: z.string().max(120).optional(),
  }),
  z.object({
    ruleType: z.literal('recurring_break'),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    label: z.string().max(120).optional(),
  }),
]);

export async function GET() {
  try {
    await requireAdminSession();
    const rules = await db
      .select()
      .from(availabilityRules)
      .orderBy(desc(availabilityRules.createdAt));
    return NextResponse.json({ rules });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Availability rules GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid rule data' }, { status: 400 });
    }
    const data = parsed.data;
    if (data.ruleType === 'date_range_block' && data.startDate > data.endDate) {
      return NextResponse.json({ error: 'startDate must be on or before endDate' }, { status: 400 });
    }
    if (
      data.ruleType !== 'date_range_block' &&
      data.startTime >= data.endTime
    ) {
      return NextResponse.json({ error: 'startTime must be before endTime' }, { status: 400 });
    }

    const [row] = await db
      .insert(availabilityRules)
      .values({
        ruleType: data.ruleType,
        dayOfWeek: 'dayOfWeek' in data ? data.dayOfWeek : null,
        startDate: 'startDate' in data ? data.startDate : null,
        endDate: 'endDate' in data ? data.endDate : null,
        startTime: 'startTime' in data ? data.startTime : null,
        endTime: 'endTime' in data ? data.endTime : null,
        label: data.label ?? null,
        createdByAdminId: null, // admin panel sessions are standalone (not users rows)
        updatedAt: new Date(),
      })
      .returning();

    invalidateAvailabilityCache();
    return NextResponse.json({ success: true, rule: row }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Availability rules POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession();
    const body = (await request.json()) as {
      id?: string;
      isActive?: boolean;
      label?: string;
      startTime?: string;
      endTime?: string;
    };

    if (!body.id || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
    if (body.label !== undefined) updates.label = body.label?.trim().slice(0, 120) || null;
    if (body.startTime !== undefined && /^\d{2}:\d{2}$/.test(body.startTime)) updates.startTime = body.startTime;
    if (body.endTime !== undefined && /^\d{2}:\d{2}$/.test(body.endTime)) updates.endTime = body.endTime;

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const [row] = await db
      .update(availabilityRules)
      .set(updates)
      .where(eq(availabilityRules.id, body.id))
      .returning();

    if (!row) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    invalidateAvailabilityCache();
    return NextResponse.json({ success: true, rule: row });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Availability rules PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();
    const id = request.nextUrl.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
    }
    const deleted = await db
      .delete(availabilityRules)
      .where(eq(availabilityRules.id, id))
      .returning({ id: availabilityRules.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    invalidateAvailabilityCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Availability rules DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
