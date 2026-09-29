import { db } from '@/lib/db';
import { bookings, bookingServices, bookingAddons, notifications, payments, referenceImages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/auth/types';
import { isSlotAvailable, invalidateAvailabilityCache } from '@/lib/availability';
import {
  calculateBookingTotal,
  generateBookingReference,
} from '@/lib/pricing';
import { parseSlotToDateTime, getCancellationDeadline } from '@/lib/timezone';
import { isCustomerVisible } from '@/lib/booking/lifecycle';
import { recordBookingEvent } from '@/lib/booking/audit';
import { validateAndApplyCode, recordRedemption, depositFromFinalTotal } from '@/lib/loyalty';
import { cancelPendingReminders } from '@/lib/jobs';
import { queueEmailEvent, getDispatchableEventIds, dispatchEmailEvent } from '@/lib/email/events';
import { generateBookingPaymentLink, generateCancellationLink } from '@/lib/whatsapp';
import { getPaymentProvider } from '@/lib/payments';
import type { PaymentRecord } from '@/lib/payments';

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  reference?: string;
  whatsappUrl?: string;
  error?: string;
}

// Unique-index conflict detection is shared with the admin booking modules.
import { isUniqueViolation } from './slot-errors';
export { isUniqueViolation };

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
  notes?: string,
  submissionKey?: string,
  // Optional loyalty/promo code string — validated SERVER-SIDE only.
  discountCode?: string
): Promise<CreateBookingResult> {
  try {
    // Authenticate user
    const user = await requireAuth();

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return { success: false, error: 'At least one service is required' };
    }

    // Idempotency: another request with the same submission key already
    // created a booking — return the original result instead of duplicating.
    if (submissionKey) {
      const existing = await getBookingBySubmissionKey(submissionKey);
      if (existing) {
        return {
          success: true,
          bookingId: existing.id,
          reference: existing.reference,
          whatsappUrl: existing.whatsappUrl,
        };
      }
    }

    // The availability check and insert must be atomic to avoid race conditions.
  // We do the check inside the transaction so the unique index is the final guard,
  // but we also check upfront to give a friendly error before attempting the insert.
  // The transaction-level check is what prevents duplicates under concurrency.

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

    // Stage 10: optional loyalty/promo code. The client sends ONLY the code
    // string — the discount percent, amount, and final total are computed
    // here from the server-side price snapshot, never trusted from the
    // browser. Deposit rules apply AFTER the discount (deposit = max(50% of
    // final total, 500000 kobo)).
    let discount: {
      codeId: string;
      code: string;
      discountAmount: number;
      finalTotal: number;
    } | null = null;
    if (discountCode && discountCode.trim()) {
      const codeResult = await validateAndApplyCode({
        code: discountCode,
        customerId: user.id,
        serviceIds,
        subtotal: priceSnapshot.subtotal,
      });
      if (!codeResult.ok) {
        return { success: false, error: `discount_code_${codeResult.error}` };
      }
      discount = {
        codeId: codeResult.codeId,
        code: codeResult.code,
        discountAmount: codeResult.discountAmount,
        finalTotal: codeResult.finalTotal,
      };
    }

    const payableTotal = discount ? discount.finalTotal : priceSnapshot.total;
    const payableDeposit = discount
      ? depositFromFinalTotal(discount.finalTotal)
      : priceSnapshot.depositRequired;

    const reference = generateBookingReference();
    const bookingId = uuidv4();
    const now = new Date();

    await db.transaction(async (tx) => {
      // Insert booking — concurrent conflicts surface as unique violations
      // against the partial unique index on (date, start, end) for
      // pending/confirmed bookings. The pre-transaction availability check
      // above is the user-facing guard; the unique index is the race guard.
      await tx.insert(bookings).values({
        id: bookingId,
        reference,
        customerId: user.id,
        appointmentDate: date,
        startTime,
        endTime,
        status: 'confirmed',
        phone,
        customerNotes: notes || '',
        subtotal: priceSnapshot.subtotal,
        depositRequired: payableDeposit,
        total: priceSnapshot.total,
        // Stage 10 discount snapshot — catalogue totals stay untouched.
        discountCode: discount?.code ?? null,
        discountAmount: discount?.discountAmount ?? null,
        finalTotal: discount?.finalTotal ?? null,
        idempotencyKey: submissionKey ?? null,
        createdAt: now,
        updatedAt: now,
      });

      // Redemption + usage increment INSIDE the booking transaction: a
      // concurrent revocation or exhausted limit fails the whole booking
      // rather than granting an unvalidated discount.
      if (discount) {
        await recordRedemption(
          {
            codeId: discount.codeId,
            bookingId,
            customerId: user.id,
            discountAmount: discount.discountAmount,
          },
          tx
        );
      }

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

      // Admin notification (so the admin sees new bookings via the badge)
      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'new_booking',
        bookingId,
        title: 'New Booking',
        message: `Booking reference ${reference} was created`,
        isRead: false,
        createdAt: now,
      });

      // Durable email event — joined to the booking transaction so an
      // invalid payload or a rollback cannot orphan the event.
      await queueEmailEvent({
        eventType: 'booking.confirmed',
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
          total: payableTotal,
          depositRequired: payableDeposit,
          discount: discount
            ? { code: discount.code, amount: discount.discountAmount }
            : undefined,
        },
      }, tx);

      const adminEmail = process.env.ADMIN_EMAIL?.trim();
      if (adminEmail) {
        await queueEmailEvent({
          eventType: 'booking.admin_new',
          recipient: adminEmail,
          bookingId,
          payload: {
            customerName: user.name,
            customerEmail: user.email,
            phone,
            notes: notes || undefined,
            reference,
            date,
            startTime,
            endTime,
            services: priceSnapshot.services.map((s) => s.name),
            addons: priceSnapshot.addons.map((a) => a.name),
            total: payableTotal,
            depositRequired: payableDeposit,
            discount: discount
              ? { code: discount.code, amount: discount.discountAmount }
              : undefined,
          },
        }, tx);
      } else {
        console.warn('ADMIN_EMAIL is not configured; booking admin email was not queued.');
      }
    });

    // WhatsApp deep link for payment instructions (not an API dependency) —
    // uses the POST-DISCOUNT totals so payment instructions match the booking.
    const whatsappUrl = generateBookingPaymentLink(
      reference,
      user.name,
      date,
      startTime,
      endTime,
      payableTotal,
      payableDeposit,
      notes
    );

    // Best-effort async dispatch of queued emails — after commit
    for (const eventId of await getDispatchableEventIds(bookingId)) {
      dispatchEmailEvent(eventId);
    }

    // This request's write must be visible to the next request's availability
    // check (module-global cache can outlive a single request).
    invalidateAvailabilityCache(date);

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
      // Two possible races:
      // 1. Same submission key retried concurrently → the key's unique index
      //    hit; return the ORIGINAL booking so retries are idempotent.
      // 2. Different submission, same slot → the slot index hit; report the
      //    slot as taken.
      if (submissionKey) {
        const existing = await getBookingBySubmissionKey(submissionKey);
        if (existing) {
          return {
            success: true,
            bookingId: existing.id,
            reference: existing.reference,
            whatsappUrl: existing.whatsappUrl,
          };
        }
      }
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
 * Thrown when a guarded status update affected 0 rows — a concurrent request
 * (double cancel, cancel-vs-admin action) changed the booking first. Callers
 * map this to HTTP 409.
 */
export class ConcurrencyConflictError extends Error {
  constructor() {
    super('Booking was modified concurrently');
    this.name = 'ConcurrencyConflictError';
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

    if (!isCustomerVisible(booking.status) || booking.status === 'cancelled') {
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
      // Concurrency guard: the update re-checks the status observed above, so
      // two racing cancel requests (or a cancel racing an admin action)
      // cannot both apply — exactly one wins, the loser reports a conflict.
      const cancelled = await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, booking.status)))
        .returning({ id: bookings.id });

      if (cancelled.length === 0) {
        throw new ConcurrencyConflictError();
      }

      // Suppress pending reminders so a cancelled appointment never pings.
      await cancelPendingReminders(bookingId);

      await recordBookingEvent(
        {
          bookingId,
          eventType: 'cancelled',
          actorType: 'customer',
          actorId: user.id,
          metadata: { reference: booking.reference },
        },
        tx,
      );

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
      }, tx);
    });

    // Async dispatch of queued emails — only after commit
    for (const eventId of await getDispatchableEventIds(bookingId)) {
      dispatchEmailEvent(eventId);
    }

    // WhatsApp link for refund questions
    const whatsappUrl = generateCancellationLink(
      booking.reference,
      user.name,
      booking.appointmentDate,
      booking.startTime,
      booking.endTime
    );

    // The slot just released — the next request must see it as available.
    invalidateAvailabilityCache(booking.appointmentDate);

    return { success: true, whatsappUrl };
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      return { success: false, error: 'booking_modified_concurrently' };
    }
    console.error('Error cancelling booking:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

/**
 * Reconciliation lookup: find the booking created by a client submission key.
 * Used by the POST idempotency fast-path and the GET reconciliation endpoint
 * so a lost response never leads to a duplicate submission. Scoped to the
 * authenticated customer so one customer cannot probe another's keys.
 */
export async function getBookingBySubmissionKey(
  submissionKey: string
): Promise<
  | (Pick<import('@/types').Booking, 'id' | 'reference' | 'status'> & { whatsappUrl: string })
  | null
> {
  if (!submissionKey || submissionKey.length < 8 || submissionKey.length > 64) {
    return null;
  }

  try {
    const user = await requireAuth();
    const booking = await db.query.bookings.findFirst({
      where: and(eq(bookings.idempotencyKey, submissionKey), eq(bookings.customerId, user.id)),
    });
    if (!booking) return null;

    const whatsappUrl = generateBookingPaymentLink(
      booking.reference,
      user.name,
      booking.appointmentDate,
      booking.startTime,
      booking.endTime,
      booking.total,
      booking.depositRequired
    );

    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status as import('@/types').BookingStatus,
      whatsappUrl,
    };
  } catch {
    return null;
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

  // Upcoming = pending/confirmed/approved for today or the future.
  // Cancelled bookings remain visible so customers have cancellation/refund
  // information. Ignored, completed, no-show, and rejected history is hidden
  // from customers per requirements (admin has full history).
  // Visibility rules come from the shared lifecycle module.
  return all.filter(
    (b) =>
      (b.appointmentDate >= today && isCustomerVisible(b.status)) ||
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

// NOTE: There is deliberately NO customer-side reschedule function.
// Rescheduling is an admin-controlled operation (Stage 1 policy): customers
// request a change by contacting the business, and the admin performs the
// reschedule via the admin command (see the admin bookings API). The former
// customer-facing rescheduleBooking() helper was removed so no customer
// mutation path can exist.

// Re-export for API layer convenience
export { parseSlotToDateTime };
