import { db } from '@/lib/db';
import { bookings, bookingServices, bookingAddons, notifications, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '@/lib/auth/types';
import { validateAdminSlot, invalidateAvailabilityCache } from '@/lib/availability';
import { calculateBookingTotal, generateBookingReference } from '@/lib/pricing';
import { recordBookingEvent } from '@/lib/booking/audit';
import { queueEmailEvent, getDispatchableEventIds, dispatchEmailEvent } from '@/lib/email/events';
import { generateBookingPaymentLink } from '@/lib/whatsapp';
import { isUniqueViolation } from './slot-errors';

/**
 * ADMIN CUSTOM BOOKING CREATION (Stage 2).
 *
 * Lets the administrator create legitimate bookings for customers who contact
 * the business outside the website flow (WhatsApp, walk-ins, manually arranged
 * appointments).
 *
 * Server-authoritative rules are IDENTICAL to the customer flow — this is a
 * shared domain service, not a bypass:
 * - pricing is recalculated from the current catalogue (never trusted from UI)
 * - service/add-on snapshots are recorded
 * - the slot must pass admin slot validation (business hours, overlaps,
 *   blocked overrides) and the database partial unique index remains the
 *   final double-booking race guard
 * - Lagos timezone handling comes from the shared slot validators
 * - booking events + notifications + durable email events are recorded
 */
export interface AdminCreateBookingResult {
  success: boolean;
  bookingId?: string;
  reference?: string;
  whatsappUrl?: string;
  error?: string;
  errorDetail?: Record<string, unknown>;
}

export interface AdminCreateBookingInput {
  customerId: string;
  serviceIds: string[];
  addonIds?: string[];
  date: string;
  startTime: string;
  endTime: string;
  phone: string;
  customerNotes?: string;
  adminNotes?: string;
}

/**
 * Create a booking administratively for an existing customer.
 */
export async function adminCreateBooking(
  input: AdminCreateBookingInput
): Promise<AdminCreateBookingResult> {
  try {
    const admin = await requireAdmin();

    const customerId = input.customerId;
    if (!customerId) {
      return { success: false, error: 'A customer is required' };
    }

    if (!Array.isArray(input.serviceIds) || input.serviceIds.length === 0) {
      return { success: false, error: 'At least one service is required' };
    }

    // The customer must exist and be an actual customer row — admin-created
    // bookings are always attached to a real account so ownership, history,
    // and emails work unchanged.
    const customer = await db.query.users.findFirst({
      where: eq(users.id, customerId),
    });
    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    // Server-side pricing from the CURRENT catalogue — never the UI's numbers.
    const priceSnapshot = await calculateBookingTotal(input.serviceIds, input.addonIds ?? []);

    // Verify every requested service/addon actually exists (avoids silent
    // pricing drift when a UI sends stale ids).
    if (priceSnapshot.services.length !== new Set(input.serviceIds).size) {
      return { success: false, error: 'One or more selected services are unavailable' };
    }
    if (priceSnapshot.addons.length !== new Set(input.addonIds ?? []).size) {
      return { success: false, error: 'One or more selected add-ons are unavailable' };
    }

    // Availability: admin bookings may use custom times, but must still pass
    // business-hours/overlap/override validation. The unique index is the
    // final race guard.
    const slotValidation = await validateAdminSlot(input.date, input.startTime, input.endTime);
    if (!slotValidation.valid) {
      return {
        success: false,
        error: 'slot_not_available',
        errorDetail: { reason: slotValidation.error },
      };
    }

    const bookingId = uuidv4();
    const reference = generateBookingReference();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(bookings).values({
        id: bookingId,
        reference,
        customerId,
        appointmentDate: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        status: 'confirmed',
        phone: input.phone,
        customerNotes: input.customerNotes || '',
        subtotal: priceSnapshot.subtotal,
        depositRequired: priceSnapshot.depositRequired,
        total: priceSnapshot.total,
        createdByAdminId: null, // admin panel sessions are not users rows
        bookingSource: 'admin',
        adminBookingNotes: input.adminNotes || null,
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

      // Audit: record that this booking was created administratively.
      await recordBookingEvent(
        {
          bookingId,
          eventType: 'created',
          actorType: 'admin',
          actorId: admin.id,
          metadata: {
            reference,
            bookingSource: 'admin',
            adminActor: admin.name,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            total: priceSnapshot.total,
            depositRequired: priceSnapshot.depositRequired,
          },
        },
        tx,
      );

      // Admin notification (so the admin sees the new booking via the badge)
      await tx.insert(notifications).values({
        id: uuidv4(),
        type: 'new_booking',
        bookingId,
        title: 'New Admin Booking',
        message: `Booking ${reference} was created by admin for ${customer.name}`,
        isRead: false,
        createdAt: now,
      });

      // Durable customer email event — same confirmation email as the
      // website flow, queued inside the transaction.
      await queueEmailEvent(
        {
          eventType: 'booking.confirmed',
          recipient: customer.email,
          bookingId,
          payload: {
            customerName: customer.name,
            reference,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            services: priceSnapshot.services.map((s) => s.name),
            addons: priceSnapshot.addons.map((a) => a.name),
            total: priceSnapshot.total,
            depositRequired: priceSnapshot.depositRequired,
          },
        },
        tx,
      );
    });

    // Best-effort async dispatch of queued emails — after commit.
    for (const eventId of await getDispatchableEventIds(bookingId)) {
      dispatchEmailEvent(eventId);
    }

    // Slot is now occupied — the next availability read must hit the DB.
    invalidateAvailabilityCache(input.date);

    const whatsappUrl = generateBookingPaymentLink(
      reference,
      customer.name,
      input.date,
      input.startTime,
      input.endTime,
      priceSnapshot.total,
      priceSnapshot.depositRequired,
      input.customerNotes
    );

    return { success: true, bookingId, reference, whatsappUrl };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        success: false,
        error: 'slot_not_available',
        errorDetail: { reason: 'overlaps_existing_booking' },
      };
    }
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return { success: false, error: 'Forbidden' };
    }
    console.error('Error creating admin booking:', error);
    return { success: false, error: 'Failed to create booking' };
  }
}
