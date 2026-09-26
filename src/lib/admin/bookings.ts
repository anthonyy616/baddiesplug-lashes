import { db } from '@/lib/db';
import { bookings, users } from '@/lib/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { getCurrentLagosDate } from '@/lib/timezone';

export async function pendingBookings() {
  const pending = await db.query.bookings.findMany({
    where: eq(bookings.status, 'pending'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(pending);
}

export async function confirmedBookings() {
  const confirmed = await db.query.bookings.findMany({
    where: eq(bookings.status, 'confirmed'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(confirmed);
}

export async function approvedBookings() {
  const approved = await db.query.bookings.findMany({
    where: eq(bookings.status, 'approved'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(approved);
}

export async function ignoredBookings() {
  const ignored = await db.query.bookings.findMany({
    where: eq(bookings.status, 'ignored'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(ignored);
}

export async function cancelledBookings() {
  const cancelled = await db.query.bookings.findMany({
    where: eq(bookings.status, 'cancelled'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(cancelled);
}

export async function rejectedBookings() {
  const rejected = await db.query.bookings.findMany({
    where: eq(bookings.status, 'rejected'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(rejected);
}

export async function completedBookings() {
  const completed = await db.query.bookings.findMany({
    where: eq(bookings.status, 'completed'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(completed);
}

export async function noShowBookings() {
  const noShow = await db.query.bookings.findMany({
    where: eq(bookings.status, 'no_show'),
    orderBy: [desc(bookings.createdAt)],
  });

  return enrichBookings(noShow);
}

export async function todayBookings() {
  const today = getCurrentLagosDate();
  const todayBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.appointmentDate, today),
      or(
        eq(bookings.status, 'confirmed'),
        eq(bookings.status, 'approved'),
        eq(bookings.status, 'completed'),
        eq(bookings.status, 'no_show')
      )
    ),
    orderBy: [bookings.startTime],
  });

  return enrichBookings(todayBookings);
}

function enrichBookings(bookingsList: any[]) {
  return Promise.all(bookingsList.map(async (booking: any) => {
    const customer = await db.query.users.findFirst({
      where: eq(users.id, booking.customerId),
    });
    return {
      ...booking,
      customerName: customer?.name || 'Unknown',
      customerEmail: customer?.email || '',
    };
  }));
}
