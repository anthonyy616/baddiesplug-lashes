import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { services } from '@/lib/db/schema';
import { eq, asc, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAdminSession } from '@/lib/admin-auth';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['lash', 'eyebrow']),
  description: z.string().min(1),
  notes: z.string().default(''),
  price: z.number().int().min(0), // NGN kobo
  durationMinutes: z.number().int().min(5).max(120),
  displayOrder: z.number().int().default(0),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  notes: z.string().optional(),
  price: z.number().int().min(0).optional(),
  durationMinutes: z.number().int().min(5).max(120).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    await requireAdminSession();

    const all = await db.query.services.findMany({
      where: isNull(services.deletedAt),
      orderBy: [asc(services.category), asc(services.displayOrder)],
    });

    return NextResponse.json({ services: all });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin services GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession();
    void admin;

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid service data. Duration must be 5–120 minutes.' },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const slugBase = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const [created] = await db
      .insert(services)
      .values({
        id: uuidv4(),
        name: parsed.data.name,
        slug,
        category: parsed.data.category,
        description: parsed.data.description,
        notes: parsed.data.notes,
        price: parsed.data.price,
        durationMinutes: parsed.data.durationMinutes,
        displayOrder: parsed.data.displayOrder,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, service: created });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin services POST error:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
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
      .update(services)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, service: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin services PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

// Soft delete only — services are business history
export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing service id' }, { status: 400 });
    }

    const [deleted] = await db
      .update(services)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'AdminUnauthorized') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin services DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
