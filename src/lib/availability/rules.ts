import { db } from '@/lib/db';
import { availabilityRules } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getStandardSlots, isBusinessDay, type Slot } from '@/lib/timezone';

/**
 * Advanced availability rules (Stage 9) — THE single authority for how the
 * base schedule, recurring rules, admin overrides, and booking occupancy
 * combine. Customer and admin booking surfaces MUST call into this module
 * (via getAvailableSlots / getCalendarRange) rather than re-implementing
 * precedence ad hoc.
 *
 * PRECEDENCE (highest wins, evaluated in order):
 *   1. Base operating schedule — isBusinessDay + getStandardSlots
 *      (Tue–Fri, four 2-hour slots).
 *   2. Advanced rules (this module, availability_rules):
 *        - date_range_block: closes every day in [startDate, endDate]
 *          (holidays, vacation, temporary closures). Overrides rule 1's
 *          "open" state for those dates.
 *        - weekday_open: opens a normally-closed weekday (custom working
 *          day) with custom working hours — adds slots for that weekday.
 *        - weekday_hours: replaces the standard slots for a weekday with a
 *          custom working window (keeps the same slot length).
 *        - recurring_break: removes a weekly time window from a weekday's
 *          slots (lunch break etc.).
 *   3. Admin overrides (availability_overrides) — date-specific open/block;
 *      an override WIN over rules: opening a slot re-opens a rule-blocked
 *      date (explicit admin intent), blocking always closes.
 *   4. Existing booking occupancy — slot-occupying statuses always mark a
 *      slot unavailable. Occupancy is evaluated LAST and is never weakened
 *      by rule changes: existing bookings never silently disappear.
 */

export type AvailabilityRuleType =
  | 'date_range_block'
  | 'weekday_open'
  | 'weekday_hours'
  | 'recurring_break';

export interface AvailabilityRule {
  id: string;
  ruleType: AvailabilityRuleType;
  dayOfWeek: number | null; // 0=Sunday .. 6=Saturday
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  startTime: string | null; // HH:MM
  endTime: string | null;
  label: string | null;
  isActive: boolean;
}

export async function getActiveRules(): Promise<AvailabilityRule[]> {
  const rows = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.isActive, true));

  return rows.map((row) => ({
    id: row.id,
    ruleType: row.ruleType as AvailabilityRuleType,
    dayOfWeek: row.dayOfWeek ?? null,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    startTime: row.startTime ?? null,
    endTime: row.endTime ?? null,
    label: row.label ?? null,
    isActive: row.isActive,
  }));
}

function dayOfWeekFor(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function inDateRange(dateStr: string, rule: AvailabilityRule): boolean {
  if (!rule.startDate || !rule.endDate) return false;
  return dateStr >= rule.startDate && dateStr <= rule.endDate;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function toMinutes(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

export interface RuleResolvedDay {
  /** true when ANY rule opens this otherwise-closed date. */
  openedByRule: boolean;
  /** true when a date-range block closes this date. */
  closedByRule: boolean;
  /** Custom working hours (weekday_hours/weekday_open) for this date. */
  customHours: { startTime: string; endTime: string } | null;
  /** Recurring break windows (minutes) to subtract from slots. */
  breaks: { start: number; end: number }[];
  labels: string[];
}

/**
 * Resolve all active rules for ONE date. Pure function over the rule list —
 * the caller combines the result with overrides and occupancy.
 */
export function resolveRulesForDate(dateStr: string, rules: AvailabilityRule[]): RuleResolvedDay {
  const dow = dayOfWeekFor(dateStr);
  const result: RuleResolvedDay = {
    openedByRule: false,
    closedByRule: false,
    customHours: null,
    breaks: [],
    labels: [],
  };

  for (const rule of rules) {
    switch (rule.ruleType) {
      case 'date_range_block':
        if (inDateRange(dateStr, rule)) {
          result.closedByRule = true;
          if (rule.label) result.labels.push(rule.label);
        }
        break;
      case 'weekday_open':
        if (rule.dayOfWeek === dow && rule.startTime && rule.endTime) {
          result.openedByRule = true;
          result.customHours = { startTime: rule.startTime, endTime: rule.endTime };
          if (rule.label) result.labels.push(rule.label);
        }
        break;
      case 'weekday_hours':
        if (rule.dayOfWeek === dow && rule.startTime && rule.endTime) {
          // weekday_hours replaces standard hours; it does NOT open closed days.
          result.customHours = { startTime: rule.startTime, endTime: rule.endTime };
          if (rule.label) result.labels.push(rule.label);
        }
        break;
      case 'recurring_break':
        if (rule.dayOfWeek === dow && rule.startTime && rule.endTime) {
          result.breaks.push({ start: toMinutes(rule.startTime), end: toMinutes(rule.endTime) });
          if (rule.label) result.labels.push(rule.label);
        }
        break;
    }
  }

  return result;
}

/**
 * Effective standard slots for a date AFTER rules (layer 2), BEFORE admin
 * overrides (layer 3) and occupancy (layer 4). Non-business days yield slots
 * only when a weekday_open rule applies; date-range blocks yield none.
 */
export function getSlotsWithRules(
  dateStr: string,
  rules: AvailabilityRule[]
): Slot[] {
  const resolved = resolveRulesForDate(dateStr, rules);

  if (resolved.closedByRule) return [];

  const businessDay = isBusinessDay(dateStr);

  let baseSlots: Slot[];
  if (businessDay) {
    baseSlots = getStandardSlots(dateStr);
    if (resolved.customHours) {
      // Replace standard hours with the custom working window, keeping the
      // 2-hour slot length of the standard template.
      const start = toMinutes(resolved.customHours.startTime);
      const end = toMinutes(resolved.customHours.endTime);
      baseSlots = [];
      for (let t = start; t + 120 <= end; t += 120) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0');
        const mm = String(t % 60).padStart(2, '0');
        const eh = String(Math.floor((t + 120) / 60)).padStart(2, '0');
        const em = String((t + 120) % 60).padStart(2, '0');
        baseSlots.push({ date: dateStr, startTime: `${hh}:${mm}`, endTime: `${eh}:${em}` });
      }
    }
  } else if (resolved.openedByRule && resolved.customHours) {
    // Custom working day on a normally-closed weekday.
    const start = toMinutes(resolved.customHours.startTime);
    const end = toMinutes(resolved.customHours.endTime);
    baseSlots = [];
    for (let t = start; t + 120 <= end; t += 120) {
      const hh = String(Math.floor(t / 60)).padStart(2, '0');
      const mm = String(t % 60).padStart(2, '0');
      const eh = String(Math.floor((t + 120) / 60)).padStart(2, '0');
      const em = String((t + 120) % 60).padStart(2, '0');
      baseSlots.push({ date: dateStr, startTime: `${hh}:${mm}`, endTime: `${eh}:${em}` });
    }
  } else {
    return [];
  }

  // Subtract recurring breaks (layer 2): a slot overlapping a break window
  // becomes unavailable in this projection.
  const filtered = baseSlots.filter((slot) => {
    const s = toMinutes(slot.startTime);
    const e = toMinutes(slot.endTime);
    return !resolved.breaks.some((b) => overlap(s, e, b.start, b.end));
  });

  return filtered;
}

/**
 * Whether a date is bookable at all after rules (ignores overrides and
 * occupancy, which are layers 3 and 4).
 */
export function isDateOpenWithRules(dateStr: string, rules: AvailabilityRule[]): boolean {
  if (resolveRulesForDate(dateStr, rules).closedByRule) return false;
  return isBusinessDay(dateStr) || resolveRulesForDate(dateStr, rules).openedByRule;
}
