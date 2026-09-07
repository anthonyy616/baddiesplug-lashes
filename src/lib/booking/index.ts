import { db } from '@/lib/db';
import { bookings, bookingServices, bookingAddons, notifications, referenceImages, payments } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireAdmin } from '@/lib/auth/types';
import {
  getAvailableSlots,
  validateBookingSlot,
} from '@/lib/availability';
import {
  calculateBookingTotal,
  createServiceSnapshots,
  createAddonSnapshots,
  generateBookingReference,
} from '@/lib/pricing';
import { isWithinBookingWindow, validateSameDayBooking, parseSlotToDateTime } from '@/lib/timezone';

export interface CreateBookingResult {
  success: boolean;
  bookingId?: string;
  reference?: string;
  whatsappUrl?: string;
  error?: string;
}

/**
 * Create a new booking
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

    // Validate slot availability
    const slotValidation = await validateBookingSlot(date, startTime, endTime);
    if (!slotValidation.valid) {
      return {
        success: false,
        error: slotValidation.error || 'Slot not available',
      };
    }

    // Calculate pricing
    const priceSnapshot = await calculateBookingTotal(serviceIds, addonIds);

    // Generate booking reference
    const reference = generateBookingReference();

    // Create the booking in a transaction
    const bookingId = uuidv4();

    await db.insert(bookings).values({
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create service snapshots
    await createServiceSnapshots(bookingId, serviceIds);

    // Create addon snapshots
    await createAddonSnapshots(bookingId, addonIds);

    // Create notification for admin
    await db.insert(notifications).values({
      id: uuidv4(),
      type: 'new_booking',
      bookingId,
      title: 'New Booking Request',
      message: `Booking reference ${reference} requires attention`,
      isRead: false,
      createdAt: new Date(),
    });

    // Generate WhatsApp URL
    const whatsappUrl = generateWhatsAppUrl(reference, user.name, date, startTime, endTime, priceSnapshot.total, priceSnapshot.depositRequired, notes);

    return {
      success: true,
      bookingId,
      reference,
      whatsappUrl,
    };
  } catch (error) {
    console.error('Error creating booking:', error);
    return {
      success: false,
      error: 'Failed to create booking',
    };
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(bookingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Get the booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Check ownership (only customer can cancel their own booking)
    if (booking.customerId !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check status (only pending or confirmed can be cancelled)
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return { success: false, error: 'Booking cannot be cancelled' };
    }

    // Check cancellation cutoff (1 hour before appointment for customers)
    if (user.role === 'customer') {
      const appointmentEnd = parseSlotToDateTime({
        date: booking.appointmentDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
      }).end;

      const now = new Date();
      const oneHourBefore = new Date(appointmentEnd.getTime() - 60 * 60 * 1000);

      if (now > oneHourBefore) {
        return { success: false, error: 'Cancellation cutoff passed' };
      }
    }

    // Update booking status to cancelled
    await db.update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // Create notification
    await db.insert(notifications).values({
      id: uuidv4(),
      type: 'booking_cancelled',
      bookingId,
      customerId: booking.customerId,
      title: 'Booking Cancelled',
      message: `Booking ${booking.reference} has been cancelled`,
      isRead: false,
      createdAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

/**
 * Get booking by ID
 */
export async function getBookingById(bookingId: string) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });

  if (!booking) return null;

  // Get service snapshots
  const bookingServicesResults = await db.query.bookingServices.findMany({
    where: eq(bookingServices.bookingId, bookingId),
  });

  // Get addon snapshots
  const bookingAddonsResults = await db.query.bookingAddons.findMany({
    where: eq(bookingAddons.bookingId, bookingId),
  });

  // Get payments
  const paymentsResults = await db.query.payments.findMany({
    where: eq(payments.bookingId, bookingId),
  });

  // Get reference images
  const referenceImagesResults = await db.query.referenceImages.findMany({
    where: eq(referenceImages.bookingId, bookingId),
  });

  return {
    ...booking,
    services: bookingServicesResults,
    addons: bookingAddonsResults,
    payments: paymentsResults,
    referenceImages: referenceImagesResults,
  };
}

/**
 * Get customer's bookings
 */
export async function getCustomerBookings(customerId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.customerId, customerId),
    orderBy: (b) => [b.createdAt],
  });
}

/**
 * Get booking for admin or customer (with authorization)
 */
export async function getBookingForUser(bookingId: string, userId: string, role: string) {
  const booking = await getBookingById(bookingId);

  if (!booking) return null;

  // Admin can see all bookings
  if (role === 'admin') {
    return booking;
  }

  // Customer can only see their own bookings
  if (booking.customerId === userId) {
    return booking;
  }

  return null;
}

/**
 * Generate WhatsApp URL with booking details
 */
function generateWhatsAppUrl(
  reference: string,
  customerName: string,
  date: string,
  startTime: string,
  endTime: string,
  total: number,
  depositRequired: number,
  notes?: string
): string {
  const phoneNumber = process.env.WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || '';
  const totalInNaira = (total / 100).toFixed(2);
  const depositInNaira = (depositRequired / 100).toFixed(2);

  const message = [
    `📋 *New Booking Request*`,
    `\u200B`,
    `*Reference:* ${reference}`,
    `*Customer:* ${customerName}`,
    `*Date:* ${date}`,
    `*Time:* ${startTime} - ${endTime}`,
    `\u200B`,
    `*Total:* ₦${totalInNaira}`,
    `*Deposit Required:* ₦${depositInNaira}`,
    `\u200B`,
    notes ? `📝 *Notes:* ${notes}` : '',
  ].filter(Boolean).join('\n');

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
}

/**
 * Reschedule a booking
 */
export async function rescheduleBooking(
  bookingId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<{ success: boolean; error?: string; newBookingId?: string }> {
  try {
    const user = await requireAuth();

    // Get the original booking
    const originalBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!originalBooking) {
      return { success: false, error: 'Booking not found' };
    }

    // Check ownership
    if (originalBooking.customerId !== user.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if original booking can be cancelled
    if (originalBooking.status !== 'pending' && originalBooking.status !== 'confirmed') {
      return { success: false, error: 'Booking cannot be rescheduled' };
    }

    // Validate new slot
    const slotValidation = await validateBookingSlot(newDate, newStartTime, newEndTime);
    if (!slotValidation.valid) {
      return { success: false, error: slotValidation.error };
    }

    // Get original booking details for the new booking
    const priceSnapshot = await calculateBookingTotal([], []); // Will be recalculated

    // Create new booking
    const newBookingId = uuidv4();
    const newReference = generateBookingReference();

    await db.insert(bookings).values({
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Cancel original booking
    await db.update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    return {
      success: true,
      newBookingId,
    };
  } catch (error) {
    console.error('Error rescheduling booking:', error);
    return { success: false, error: 'Failed to reschedule booking' };
  }
}
