import { db } from '@/lib/db';
import { bookings, bookingServices, bookingAddons, notifications, emailEvents, payments, referenceImages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/auth/types';
import { isSlotAvailable } from '@/lib/availability';
import {
  calculateBookingTotal,
  generateBookingReference,
} from '@/lib/pricing';
import { parseSlotToDateTime, getCancellationDeadline } from '@/lib/timezone';
import { queueEmailEvent, dispatchEmailEvent } from '@/lib/email/events';
import { generateBookingPaymentLink, generateCancellationLink } from '@/lib/whatsapp';

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  reference?: string;
  whatsappUrl?: string;
  error?: string;
}

// Error thrown on unique-index conflicts so we can map to a friendly message.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/**
 * Create a new booking.
 *
 * Everything that must be atomic happens inside a single transaction:
 * availability re-validation, pricing recalculation, booking insert,
 * snapshots, notification, and email event. The database's partial unique
 * index on (date, start, end) for pending/confirmed bookings is the final
 * race-condition guard; a conflict maps to a user-friendly error.
 */
export async function createBooking(
  serviceIds: string[],
  addonIds: string[],
  date: string,
  startTime: string,
  endTime: string,
  phone: string,
  notes?: string
): Promise<CreateBookingResult> {
  try {
    // Authenticate user
    const user = await requireAuth();

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return { success: false, error: 'At least one service is required' };
    }

    // Authoritative server-side availability validation
    const slotValidation = await isSlotAvailable(date, startTime, endTime);
    if (!slotValidation.available) {
      return {
        success: false,
        error: slotValidation.reason || 'Slot not available',
      };
    }

    // Recalculate pricing from the database — never trust the frontend
    const priceSnapshot = await calculateBookingTotal(serviceIds, addonIds);

    // Verify every requested service/addon actually exists (avoids silent pricing drift)
    const resolvedServiceCount = priceSnapshot.services.length;
    if (resolvedServiceCount !== new Set(serviceIds).size) {
      return { success: false, error: 'One or more selected services are unavailable' };
    }
    if (priceSnapshot.addons.length !== new Set(addonIds).size) {
      return { success: false, error: 'One or more selected add-ons are unavailable' };
    }

    const reference = generateBookingReference();
    const bookingId = uuidv4();
    const now = new Date();

    await db.transaction(async (tx) => {
      // Re-validate inside the transaction for the strongest consistency
      // available at this isolation level; the partial unique index below is
      // the final guard against concurrent bookings.
      const stillAvailable = await isSlotAvailable(date, startTime, endTime);
      if (!stillAvailable.available) {
        throw new SlotConflictError(stillAvailable.reason || 'Slot not available');
      }

      // Insert booking — conflicts surface as unique violations
      await tx.insert(bookings).values({
        id: bookingId,
        reference,
        customerId: user.id,
        appointmentDate: date,
        startTime,
        endTime,
        status: 'pending',
        phone,
        customerNotes: notes || '',
        subtotal: priceSnapshot.subtotal,
        depositRequired: priceSnapshot.depositRequired,
        total: priceSnapshot.total,
        createdAt: now,
        updatedAt: now,
      });

      // Service snapshots (historical prices)
      if (priceSnapshot.services.length > 0) {
        await tx.insert(bookingServices).values(
          priceSnapshot.services.map((s) => ({
            id: uuidv4(),
            bookingId,
            serviceId: s.id,
            serviceNameSnapshot: s.name,
            unitPriceSnapshot: s.price,
          }))
        );
      }

      // Addon snapshots (historical prices)
      if (priceSnapshot.addons.length > 0) {
        await tx.insert(bookingAddons).values(
          priceSnapshot.addons.map((a) => ({
            id: uuidv4(),
            bookingId,
            addonId: a.id,
            addonNameSnapshot: a.name,
            unitPriceSnapshot: a.price,
            quantity: a.quantity,
          }))
        );
      }

      // Admin notification
      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'new_booking',
        bookingId,
        title: 'New Booking Request',
        message: `Booking reference ${reference} requires attention`,
        isRead: false,
        createdAt: now,
      });

      // Durable email event — booking transaction is independent of delivery
      await queueEmailEvent({
        eventType: 'booking.requested',
        recipient: user.email,
        bookingId,
        payload: {
          customerName: user.name,
          reference,
          date,
          startTime,
          endTime,
          services: priceSnapshot.services.map((s) => s.name),
          addons: priceSnapshot.addons.map((a) => a.name),
          total: priceSnapshot.total,
          depositRequired: priceSnapshot.depositRequired,
          phone,
          notes,
        },
      });
    });

    // WhatsApp deep link for payment instructions (not an API dependency)
    const whatsappUrl = generateBookingPaymentLink(
      reference,
      user.name,
      date,
      startTime,
      endTime,
      priceSnapshot.total,
      priceSnapshot.depositRequired,
      notes
    );

    // Best-effort async dispatch of queued emails
    const queued = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(eq(emailEvents.bookingId, bookingId));
    for (const event of queued) {
      dispatchEmailEvent(event.id);
    }

    return {
      success: true,
      bookingId,
      reference,
      whatsappUrl,
    };
  } catch (error) {
    if (error instanceof SlotConflictError) {
      return { success: false, error: 'slot_no_longer_available' };
    }
    if (isUniqueViolation(error)) {
      return { success: false, error: 'slot_no_longer_available' };
    }
    console.error('Error creating booking:', error);
    return {
      success: false,
      error: 'Failed to create booking',
    };
  }
}

class SlotConflictError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SlotConflictError';
  }
}

/**
 * Cancel a booking (customer-side; admins use the admin service).
 */
export async function cancelBooking(bookingId: string): Promise<{ success: boolean; error?: string; whatsappUrl?: string }> {
  try {
    const user = await requireAuth();

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Only the owner may cancel their own booking
    if (booking.customerId !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return { success: false, error: 'Booking cannot be cancelled' };
    }

    // 1-hour cutoff (customers)
    const deadline = getCancellationDeadline({
      date: booking.appointmentDate,
      startTime: booking.startTime,
    });
    if (new Date() >= deadline) {
      return { success: false, error: 'Cancellation cutoff passed' };
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        })
        .where(eq(bookings.id, bookingId));

      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'booking_cancelled',
        bookingId,
        customerId: booking.customerId,
        title: 'Booking Cancelled',
        message: `Booking ${booking.reference} has been cancelled`,
        isRead: false,
        createdAt: now,
      });

      await queueEmailEvent({
        eventType: 'booking.customer_cancelled',
        recipient: user.email,
        bookingId,
        payload: {
          customerName: user.name,
          reference: booking.reference,
          date: booking.appointmentDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      });
    });

    // Async dispatch of queued emails
    const queued = await db
      .select({ id: emailEvents.id })
      .from(emailEvents)
      .where(eq(emailEvents.bookingId, bookingId));
    for (const event of queued) {
      dispatchEmailEvent(event.id);
    }

    // WhatsApp link for refund questions
    const whatsappUrl = generateCancellationLink(
      booking.reference,
      user.name,
      booking.appointmentDate,
      booking.startTime,
      booking.endTime
    );

    return { success: true, whatsappUrl };
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

/**
 * Get booking by ID with all related data.
 */
export async function getBookingById(bookingId: string) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) return null;

  const [bookingServicesResults, bookingAddonsResults, paymentsResults, referenceImagesResults] =
    await Promise.all([
      db.query.bookingServices.findMany({
        where: eq(bookingServices.bookingId, bookingId),
      }),
      db.query.bookingAddons.findMany({
        where: eq(bookingAddons.bookingId, bookingId),
      }),
      db.query.payments.findMany({
        where: eq(payments.bookingId, bookingId),
      }),
      db.query.referenceImages.findMany({
        where: eq(referenceImages.bookingId, bookingId),
      }),
    ]);

  return {
    ...booking,
    services: bookingServicesResults,
    addons: bookingAddonsResults,
    payments: paymentsResults,
    referenceImages: referenceImagesResults,
  };
}

/**
 * Get customer's upcoming bookings only.
 * Requirements: customers must NOT see appointment history.
 */
export async function getCustomerBookings(customerId: string) {
  const all = await db.query.bookings.findMany({
    where: eq(bookings.customerId, customerId),
    orderBy: (b) => [b.appointmentDate],
  });

  const today = new Date().toISOString().slice(0, 10);

  // Upcoming = pending/confirmed for today or the future.
  // Cancelled bookings remain visible so customers have cancellation/refund
  // information. Completed, no-show, and rejected history is hidden from
  // customers per requirements (admin has full history).
  return all.filter(
    (b) =>
      (b.appointmentDate >= today &&
        (b.status === 'pending' || b.status === 'confirmed')) ||
      b.status === 'cancelled'
  );
}

/**
 * Get booking for admin or customer (with authorization).
 */
export async function getBookingForUser(bookingId: string, userId: string, role: string) {
  const booking = await getBookingById(bookingId);

  if (!booking) return null;

  if (role === 'admin') {
    return booking;
  }

  if (booking.customerId === userId) {
    return booking;
  }

  return null;
}

/**
 * Reschedule a booking: cancel original + create a new booking that
 * references it. The new booking must pass all normal availability rules.
 */
export async function rescheduleBooking(
  bookingId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<{ success: boolean; error?: string; newBookingId?: string; whatsappUrl?: string }> {
  try {
    const user = await requireAuth();

    const originalBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!originalBooking) {
      return { success: false, error: 'Booking not found' };
    }

    if (originalBooking.customerId !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    if (originalBooking.status !== 'pending' && originalBooking.status !== 'confirmed') {
      return { success: false, error: 'Booking cannot be rescheduled' };
    }

    // Validate new slot (arbitrary times are rejected by the availability engine)
    const slotValidation = await isSlotAvailable(newDate, newStartTime, newEndTime);
    if (!slotValidation.available) {
      return { success: false, error: slotValidation.reason || 'Slot not available' };
    }

    // Preserve original price snapshot — rescheduling must not reprice
    const newBookingId = uuidv4();
    const newReference = generateBookingReference();
    const now = new Date();

    await db.transaction(async (tx) => {
      // Cancel original
      await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        })
        .where(eq(bookings.id, bookingId));

      // Create new booking with the original's price snapshot
      await tx.insert(bookings).values({
        id: newBookingId,
        reference: newReference,
        customerId: originalBooking.customerId,
        appointmentDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'pending',
        phone: originalBooking.phone,
        customerNotes: originalBooking.customerNotes,
        subtotal: originalBooking.subtotal,
        depositRequired: originalBooking.depositRequired,
        total: originalBooking.total,
        previousBookingId: bookingId,
        createdAt: now,
        updatedAt: now,
      });

      // Copy service snapshots
      const originalServices = await tx.query.bookingServices.findMany({
        where: eq(bookingServices.bookingId, bookingId),
      });
      if (originalServices.length > 0) {
        await tx.insert(bookingServices).values(
          originalServices.map((s) => ({
            id: uuidv4(),
            bookingId: newBookingId,
            serviceId: s.serviceId,
            serviceNameSnapshot: s.serviceNameSnapshot,
            unitPriceSnapshot: s.unitPriceSnapshot,
          }))
        );
      }

      // Copy addon snapshots
      const originalAddons = await tx.query.bookingAddons.findMany({
        where: eq(bookingAddons.bookingId, bookingId),
      });
      if (originalAddons.length > 0) {
        await tx.insert(bookingAddons).values(
          originalAddons.map((a) => ({
            id: uuidv4(),
            bookingId: newBookingId,
            addonId: a.addonId,
            addonNameSnapshot: a.addonNameSnapshot,
            unitPriceSnapshot: a.unitPriceSnapshot,
            quantity: a.quantity,
          }))
        );
      }

      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'new_booking',
        bookingId: newBookingId,
        title: 'Booking Rescheduled',
        message: `Booking ${originalBooking.reference} rescheduled to ${newDate} ${newStartTime} (ref ${newReference})`,
        isRead: false,
        createdAt: now,
      });
    });

    const whatsappUrl = generateBookingPaymentLink(
      newReference,
      user.name,
      newDate,
      newStartTime,
      newEndTime,
      originalBooking.total,
      originalBooking.depositRequired
    );

    return { success: true, newBookingId, whatsappUrl };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: 'slot_no_longer_available' };
    }
    console.error('Error rescheduling booking:', error);
    return { success: false, error: 'Failed to reschedule booking' };
  }
}

// Re-export for API layer convenience
export { parseSlotToDateTime };
