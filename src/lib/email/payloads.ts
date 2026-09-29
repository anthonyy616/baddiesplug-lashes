import { z } from 'zod';
import type { EmailEventType } from '@/types';

/**
 * Payload schemas for every email-event type.
 *
 * Queue-time validation: queueEmailEvent() rejects payloads that do not match
 * (transaction rolls back — an invalid financial payload must never be
 * silently rendered as ₦0.00). Render-time validation: processEmailEvent()
 * fails the event instead of rendering garbage.
 */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const money = z.number().int().nonnegative();
const strList = z.array(z.string());

/** Shared appointment fields present in every payload. */
const appointmentBase = z.object({
  customerName: z.string().min(1),
  reference: z.string().min(1),
  date: dateStr,
  startTime: timeStr,
  endTime: timeStr,
});

/** Appointment fields plus pricing — money fields are REQUIRED (no defaults). */
const pricedBase = appointmentBase.extend({
  services: strList,
  addons: strList.default([]),
  total: money,
  depositRequired: money,
});

export const emailPayloadSchemas = {
  'booking.requested': pricedBase.extend({
    phone: z.string().min(1),
    notes: z.string().optional(),
  }),
  'booking.confirmed': pricedBase,
  'booking.admin_new': pricedBase.extend({
    customerEmail: z.string().email(),
    phone: z.string().min(1),
    notes: z.string().optional(),
  }),
  'booking.customer_cancelled': appointmentBase,
  'booking.admin_cancelled': appointmentBase.extend({
    // Stage 5: the admin-entered, customer-safe cancellation reason. The
    // audit record is the source of truth; the email echoes it verbatim.
    reason: z.string().max(1000).optional(),
  }),
  'booking.rescheduled': appointmentBase.extend({
    previousReference: z.string().min(1),
    services: strList.default([]),
    addons: strList.default([]),
    // Old appointment details (shown alongside the new slot)
    previousDate: dateStr.optional(),
    previousStartTime: timeStr.optional(),
    previousEndTime: timeStr.optional(),
    // Carried-over approval/payment state of the original booking
    wasApproved: z.boolean().optional(),
    // Customer-safe reschedule reason entered by the admin (Stage 4)
    reason: z.string().max(1000).optional(),
  }),
  'appointment.reminder': appointmentBase.extend({
    services: strList.default([]),
  }),
} as const satisfies Record<EmailEventType, z.ZodTypeAny>;

export type EmailPayloadMap = {
  [K in EmailEventType]: z.output<(typeof emailPayloadSchemas)[K]>;
};

/**
 * Validate a payload for an event type. Returns a discriminated result so
 * callers can either throw (queue time) or fail the event (render time).
 */
export function validateEmailPayload(
  eventType: EmailEventType,
  payload: unknown,
): { ok: true; data: unknown } | { ok: false; error: string } {
  const schema = (emailPayloadSchemas as Record<EmailEventType, z.ZodTypeAny>)[eventType];
  if (!schema) {
    return { ok: false, error: `No payload schema registered for ${eventType}` };
  }
  const result = schema.safeParse(payload);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  return { ok: false, error: `Invalid ${eventType} payload — ${issues}` };
}
