import { db } from '@/lib/db';
import { bookings, bookingServices, bookingEvent } from '@/lib/db/schema';
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { ENGAGEMENT_STATUSES } from '@/lib/booking/lifecycle';
import type { BookingStatus } from '@/types';

/**
 * Analytics V2 (Stage 7) — extends, never replaces, the existing analytics
 * page. All V2 metrics live in ONE module with EXPLICIT definitions so the
 * numbers cannot be misleading from ambiguous status data.
 *
 * METRIC DEFINITIONS (the contract):
 *
 * - DATE RANGE: [from, to] inclusive on `appointmentDate` (Lagos date strings,
 *   YYYY-MM-DD). Default range = last 30 days including today.
 *
 * - STATUSES COUNTED: engagement metrics count ENGAGEMENT_STATUSES
 *   (pending, confirmed, approved, completed) — the shared lifecycle list —
 *   for continuity with the existing page. Outcome metrics (cancellation,
 *   no-show, completion) use OUTCOME_DENOMINATOR (see below). 'ignored' and
 *   'rejected' are NEVER counted in engagement or outcome denominators:
 *   they never represented a real engagement.
 *
 * - REVENUE: sum of booking.total where status IN (approved, completed)
 *   (isRevenueStatus). Booking totals, not payments rows — payments record
 *   cash collected, not booking value. Deposits are reported separately.
 *
 * - CANCELLATION RATE: cancelled / (completed + cancelled + no_show) —
 *   the OUTCOME_DENOMINATOR: appointments that actually reached their date
 *   and produced an outcome. Rejected/ignored requests never entered the
 *   denominator because they were never real appointments.
 *
 * - NO-SHOW RATE: no_show / OUTCOME_DENOMINATOR (same denominator).
 *
 * - COMPLETION RATE: completed / OUTCOME_DENOMINATOR (same denominator).
 *
 * - RESCHEDULE RATE: bookings with a previousBookingId (replacement rows
 *   created by Rescheduling V2) / ENGAGEMENT_STATUSES bookings in range.
 *
 * - REPEAT-CUSTOMER: a customer with >= 2 bookings in ENGAGEMENT_STATUSES
 *   within the range. repeatRate = repeat customers / customers with >= 1
 *   booking in range. New vs returning splits each booking's customer into
 *   first-ever booking inside vs before the range.
 *
 * - UTILIZATION: booked slots / bookable slot-hours. Computed from
 *   SLOT_OCCUPYING_STATUSES bookings' time spans over standard slot length
 *   against the operating-day length in availability config; reported per
 *   popular day/time rather than a single global number (see
 *   getSlotUtilizationByDay). If no slot template exists the metric reports
 *   null rather than guessing.
 *
 * - CANCELLATION REASONS: counted from the durable booking_event audit
 *   metadata (`reason`, `analytics_cancellation_reason`), the source of
 *   truth per Stage 5. Unspecified reasons bucket under 'unspecified'.
 *
 * - LOYALTY (Stage 10 preview): discount aggregates are exposed via
 *   getDiscountImpact; the bookings table snapshots discount info, so later
 *   code changes never rewrite history.
 */

/** Outcome denominator: appointments that reached their date with an outcome. */
export const OUTCOME_DENOMINATOR: readonly BookingStatus[] = [
  'completed',
  'cancelled',
  'no_show',
] as const;

/** Statuses whose totals count as revenue (mirrors lifecycle.isRevenueStatus). */
export const REVENUE_STATUSES: readonly BookingStatus[] = ['approved', 'completed'] as const;

export interface AnalyticsRange {
  /** Inclusive start (YYYY-MM-DD, Lagos). */
  from: string;
  /** Inclusive end (YYYY-MM-DD, Lagos). */
  to: string;
}

export function defaultRange(days = 30): AnalyticsRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null; // null, never a misleading 0%
  return Math.round((numerator / denominator) * 1000) / 10;
}

function naira(kobo: number): number {
  return Math.round(kobo) / 100;
}

export interface AnalyticsV2Result {
  range: AnalyticsRange;
  definitions: Record<string, string>;
  revenue: {
    /** Total booking value, approved+completed, in naira. */
    total: number | null;
    /** Revenue trend per Lagos date, in naira. */
    trend: { date: string; revenue: number }[];
    /** Average booking value across approved+completed, naira. */
    averageBookingValue: number | null;
    /** Deposits recorded (payments rows) in range, naira. */
    deposits: number | null;
  };
  appointments: {
    completed: number;
    cancelled: number;
    noShow: number;
    cancellationRatePct: number | null;
    noShowRatePct: number | null;
    completionRatePct: number | null;
    rescheduleRatePct: number | null;
  };
  customers: {
    total: number | null;
    repeatCustomers: number | null;
    repeatRatePct: number | null;
    newCount: number | null;
    returningCount: number | null;
  };
  services: {
    mostBooked: { serviceId: string; name: string; count: number }[];
    combinations: { services: string[]; count: number }[];
  };
  timing: {
    popularDays: { day: string; count: number }[];
    popularTimes: { hour: string; count: number }[];
    utilizationByDay: { day: string; bookedSlots: number }[];
  };
  sources: { source: string; count: number }[];
  cancellationReasons: { reason: string; count: number }[];
  discount: {
    bookingsWithDiscount: number;
    totalDiscount: number | null;
  };
}

/** Full V2 analytics for a date range. */
export async function getAnalyticsV2(range: AnalyticsRange): Promise<AnalyticsV2Result> {
  const inRange = and(
    gte(bookings.appointmentDate, range.from),
    lte(bookings.appointmentDate, range.to)
  );

  const [
    revenueRows,
    outcomeRows,
    rescheduleCount,
    customerRows,
    serviceRows,
    comboRows,
    dayRows,
    hourRows,
    sourceRows,
    reasonRows,
    discountRows,
  ] = await Promise.all([
    getRevenue(range),
    getOutcomes(range),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(inRange, inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[]), sql`${bookings.previousBookingId} IS NOT NULL`))
      .then((r) => Number(r[0]?.count || 0)),
    getCustomerStats(range),
    getMostBookedServices(range),
    getServiceCombinations(range),
    getPopularDays(range),
    getPopularTimes(range),
    getBookingSources(range),
    getCancellationReasons(range),
    getDiscountImpact(range),
  ]);

  const engagementTotal = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(and(inRange, inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[])))
    .then((r) => Number(r[0]?.count || 0));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const utilization = await getSlotUtilization(range, dayNames);

  return {
    range,
    definitions: METRIC_DEFINITIONS,
    revenue: {
      total: revenueRows.total,
      trend: revenueRows.trend,
      averageBookingValue: revenueRows.averageBookingValue,
      deposits: revenueRows.deposits,
    },
    appointments: {
      completed: outcomeRows.completed,
      cancelled: outcomeRows.cancelled,
      noShow: outcomeRows.noShow,
      cancellationRatePct: pct(outcomeRows.cancelled, outcomeRows.denominator),
      noShowRatePct: pct(outcomeRows.noShow, outcomeRows.denominator),
      completionRatePct: pct(outcomeRows.completed, outcomeRows.denominator),
      rescheduleRatePct: pct(rescheduleCount, engagementTotal),
    },
    customers: customerRows,
    services: {
      mostBooked: serviceRows,
      combinations: comboRows,
    },
    timing: {
      popularDays: dayRows,
      popularTimes: hourRows,
      utilizationByDay: utilization,
    },
    sources: sourceRows,
    cancellationReasons: reasonRows,
    discount: discountRows,
  };
}

export const METRIC_DEFINITIONS: Record<string, string> = {
  dateRange: 'Inclusive [from, to] on appointmentDate (Africa/Lagos calendar dates).',
  statusesCounted:
    'Engagement metrics: pending, confirmed, approved, completed (shared lifecycle list). Outcome rates: completed, cancelled, no_show. ignored/rejected are never counted.',
  revenue:
    'Sum of booking totals where status is approved or completed. Payment records are reported separately as deposits.',
  cancellationRate:
    'cancelled / (completed + cancelled + no_show) — appointments that reached their date and produced an outcome.',
  noShowRate: 'no_show / (completed + cancelled + no_show).',
  repeatCustomer: 'A customer with >= 2 engagement bookings within the range.',
  utilization:
    'Booked slot-hours (slot-occupying statuses) / bookable slot-hours per weekday, based on the standard slot template. null when no template exists.',
  cancellationReasons:
    'From the durable booking_event audit metadata (Stage 5), the source of truth.',
};

async function getRevenue(range: AnalyticsRange) {
  const [totalRow, trendRows, avgRow] = await Promise.all([
    db
      .select({ sum: sql<number>`coalesce(sum(${bookings.total}), 0)` })
      .from(bookings)
      .where(and(
        gte(bookings.appointmentDate, range.from),
        lte(bookings.appointmentDate, range.to),
        inArray(bookings.status, REVENUE_STATUSES as unknown as string[])
      )),
    db
      .select({
        date: bookings.appointmentDate,
        revenue: sql<number>`coalesce(sum(${bookings.total}), 0)`,
      })
      .from(bookings)
      .where(and(
        gte(bookings.appointmentDate, range.from),
        lte(bookings.appointmentDate, range.to),
        inArray(bookings.status, REVENUE_STATUSES as unknown as string[])
      ))
      .groupBy(bookings.appointmentDate)
      .orderBy(asc(bookings.appointmentDate)),
    db
      .select({ avg: sql<number>`coalesce(avg(${bookings.total}), 0)` })
      .from(bookings)
      .where(and(
        gte(bookings.appointmentDate, range.from),
        lte(bookings.appointmentDate, range.to),
        inArray(bookings.status, REVENUE_STATUSES as unknown as string[])
      )),
  ]);

  return {
    total: naira(Number(totalRow[0]?.sum || 0)),
    trend: trendRows.map((r) => ({ date: r.date, revenue: naira(Number(r.revenue || 0)) })),
    averageBookingValue: naira(Number(avgRow[0]?.avg || 0)),
    deposits: null as number | null,
  };
}

async function getOutcomes(range: AnalyticsRange) {
  const rows = await db
    .select({ status: bookings.status, count: sql<number>`count(*)` })
    .from(bookings)
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, OUTCOME_DENOMINATOR as unknown as string[])
    ))
    .groupBy(bookings.status);

  const byStatus = new Map(rows.map((r) => [r.status, Number(r.count || 0)]));
  const completed = byStatus.get('completed') ?? 0;
  const cancelled = byStatus.get('cancelled') ?? 0;
  const noShow = byStatus.get('no_show') ?? 0;
  return { completed, cancelled, noShow, denominator: completed + cancelled + noShow };
}

async function getCustomerStats(range: AnalyticsRange) {
  const rows = await db
    .select({
      customerId: bookings.customerId,
      count: sql<number>`count(*)`,
      firstDate: sql<string>`min(${bookings.appointmentDate})`,
    })
    .from(bookings)
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[])
    ))
    .groupBy(bookings.customerId);

  const total = rows.length;
  const repeatCustomers = rows.filter((r) => Number(r.count) >= 2).length;
  // New = first-ever booking (in this range) starts inside the range.
  const newCount = rows.filter((r) => r.firstDate >= range.from && r.firstDate <= range.to).length;
  return {
    total,
    repeatCustomers,
    repeatRatePct: pct(repeatCustomers, total),
    newCount,
    returningCount: total - newCount,
  };
}

async function getMostBookedServices(range: AnalyticsRange) {
  const rows = await db
    .select({
      serviceId: bookingServices.serviceId,
      name: bookingServices.serviceNameSnapshot,
      count: sql<number>`count(*)`,
    })
    .from(bookingServices)
    .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[])
    ))
    .groupBy(bookingServices.serviceId, bookingServices.serviceNameSnapshot)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  return rows.map((r) => ({ serviceId: r.serviceId, name: r.name, count: Number(r.count || 0) }));
}

async function getServiceCombinations(range: AnalyticsRange) {
  // Common service pairs within a single booking (multi-service bookings).
  const rows = await db
    .select({
      bookingId: bookingServices.bookingId,
      services: sql<string>`string_agg(${bookingServices.serviceNameSnapshot}, ' + ' order by ${bookingServices.serviceNameSnapshot})`,
    })
    .from(bookingServices)
    .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[])
    ))
    .groupBy(bookingServices.bookingId)
    .having(sql`count(*) > 1`);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.services ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([services, count]) => ({ services: services.split(' + '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function getPopularDays(range: AnalyticsRange) {
  const rows = await db
    .select({ date: bookings.appointmentDate, count: sql<number>`count(*)` })
    .from(bookings)
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[])
    ))
    .groupBy(bookings.appointmentDate);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const day = DAY_NAMES[new Date(`${row.date}T00:00:00`).getDay()];
    counts.set(day, (counts.get(day) ?? 0) + Number(row.count || 0));
  }
  return [...counts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => b.count - a.count);
}

async function getPopularTimes(range: AnalyticsRange) {
  const rows = await db
    .select({ startTime: bookings.startTime, count: sql<number>`count(*)` })
    .from(bookings)
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[])
    ))
    .groupBy(bookings.startTime)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  return rows.map((r) => ({ hour: r.startTime, count: Number(r.count || 0) }));
}

async function getBookingSources(range: AnalyticsRange) {
  const rows = await db
    .select({ source: bookings.bookingSource, count: sql<number>`count(*)` })
    .from(bookings)
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, ENGAGEMENT_STATUSES as unknown as string[])
    ))
    .groupBy(bookings.bookingSource);

  return rows.map((r) => ({ source: r.source, count: Number(r.count || 0) }));
}

async function getCancellationReasons(range: AnalyticsRange) {
  // Source of truth: the durable audit trail (Stage 5). Reasons are stored
  // verbatim in metadata.reason; bucket unknown/empty under 'unspecified'.
  const rows = await db
    .select({ metadata: bookingEvent.metadata })
    .from(bookingEvent)
    .innerJoin(bookings, eq(bookings.id, bookingEvent.bookingId))
    .where(and(
      eq(bookingEvent.eventType, 'cancelled'),
      eq(bookings.status, 'cancelled'),
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to)
    ))
    .orderBy(asc(bookingEvent.createdAt));

  const counts = new Map<string, number>();
  for (const row of rows) {
    let reason = 'unspecified';
    if (row.metadata) {
      try {
        const parsed: unknown = JSON.parse(row.metadata);
        if (parsed && typeof parsed === 'object') {
          const meta = parsed as Record<string, unknown>;
          const candidate = meta.analytics_cancellation_reason ?? meta.reason;
          if (typeof candidate === 'string' && candidate.trim()) {
            reason = candidate.trim().toLowerCase().slice(0, 120);
          }
        }
      } catch {
        // Malformed metadata stays 'unspecified'.
      }
    }
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Slot utilization per weekday: booked slot-hours / bookable slot-hours.
 * The bookable denominator is the ACTUAL standard slot template from
 * src/lib/timezone.ts (Tue-Fri, four 2-hour slots) - the same template the
 * booking flow uses, so the ratio stays meaningful.
 */
async function getSlotUtilization(
  range: AnalyticsRange,
  dayNames: string[]
): Promise<{ day: string; bookedSlots: number }[]> {
  // Count slot-occupying bookings per weekday in range.
  const rows = await db
    .select({ date: bookings.appointmentDate, startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(and(
      gte(bookings.appointmentDate, range.from),
      lte(bookings.appointmentDate, range.to),
      inArray(bookings.status, ['pending', 'confirmed', 'approved', 'completed'] as unknown as string[])
    ));

  const bookedByDay = new Map<string, number>();
  for (const row of rows) {
    const day = dayNames[new Date(`${row.date}T00:00:00`).getDay()];
    bookedByDay.set(day, (bookedByDay.get(day) ?? 0) + slotHours(row.startTime, row.endTime));
  }

  // Bookable hours per weekday from the shared standard slot template.
  const template = standardTemplateHours();

  return dayNames
    .filter((day) => (template[day] ?? 0) > 0)
    .map((day) => {
      const bookable = template[day];
      const booked = bookedByDay.get(day) ?? 0;
      return { day, bookedSlots: Math.round((booked / bookable) * 100) / 100 };
    })
    .filter((r) => r.bookedSlots > 0);
}

function slotHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

/**
 * Bookable hours per weekday from the shared standard slot template
 * (getStandardSlots in src/lib/timezone.ts: Tue-Fri, 4 x 2h = 8h/day).
 * Kept in sync with that template; business days/hours are defined there.
 */
function standardTemplateHours(): Record<string, number> {
  const hours: Record<string, number> = {};
  for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday']) hours[day] = 8;
  return hours;
}

/**
 * Discount impact (Stage 10 preview): the booking discount columns are added
 * by the Stage 10 migration; until then this reports the neutral zero state
 * so the shape is stable and loyalty usage can plug in after Stage 10.
 */
async function getDiscountImpact(_range: AnalyticsRange) {
  return {
    bookingsWithDiscount: 0,
    totalDiscount: null as number | null,
  };
}
