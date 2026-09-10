import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { addons } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAdminSession } from '@/lib/admin-auth';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  price: z.number().int().min(0), // NGN kobo
  displayOrder: z.number().int().default(0),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  price: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    await requireAdminSession();

    const all = await db.query.addons.findMany({
      orderBy: [asc(addons.displayOrder)],
    });

    return NextResponse.json({ addons: all });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin addons GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid add-on data' }, { status: 400 });
    }

    const [created] = await db
      .insert(addons)
      .values({
        id: uuidv4(),
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        displayOrder: parsed.data.displayOrder,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, addon: created });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin addons POST error:', error);
    return NextResponse.json({ error: 'Failed to create add-on' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid update data' }, { status: 400 });
    }

    const { id, ...updates } = parsed.data;

    const [updated] = await db
      .update(addons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(addons.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Add-on not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, addon: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin addons PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update add-on' }, { status: 500 });
  }
}
