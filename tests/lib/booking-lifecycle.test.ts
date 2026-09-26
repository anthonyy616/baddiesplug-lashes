import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  BOOKING_STATUSES,
  SLOT_OCCUPYING_STATUSES,
  TERMINAL_STATUSES,
  ENGAGEMENT_STATUSES,
  canTransition,
  occupiesSlot,
  isTerminal,
  isCustomerVisible,
  isRevenueStatus,
  statusLabel,
} from '@/lib/booking/lifecycle';

/**
 * Tests for the booking status lifecycle (see agent/implementation/
 * booking-status-and-analytics-plan.md):
 *
 * - 'approved' and 'ignored' are persisted statuses.
 * - Admin approves: confirmed -> approved.
 * - Admin marks no-show manually: confirmed|approved -> no_show.
 * - The scheduled job NEVER creates no_show; it creates 'ignored' only.
 * - Legacy production statuses remain valid.
 */

describe('status vocabulary', () => {
  it('includes the new persisted statuses approved and ignored', () => {
    expect(BOOKING_STATUSES).toContain('approved');
    expect(BOOKING_STATUSES).toContain('ignored');
  });

  it('keeps all legacy production statuses valid', () => {
    for (const legacy of ['pending', 'confirmed', 'cancelled', 'rejected', 'completed', 'no_show']) {
      expect(BOOKING_STATUSES).toContain(legacy);
    }
  });

  it('has a transition entry for every known status', () => {
    for (const status of BOOKING_STATUSES) {
      expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true);
    }
  });
});

describe('transition matrix', () => {
  it('allows admin approval: confirmed -> approved', () => {
    expect(canTransition('confirmed', 'approved')).toBe(true);
  });

  it('allows manual no-show from confirmed and approved', () => {
    expect(canTransition('confirmed', 'no_show')).toBe(true);
    expect(canTransition('approved', 'no_show')).toBe(true);
  });

  it('never allows the job path confirmed -> ignored (job does its own guarded update)', () => {
    // Ignored is terminal and only produced by the scheduled job's own
    // status-guarded update — not part of the admin transition matrix.
    expect(canTransition('confirmed', 'ignored')).toBe(false);
  });

  it('allows legacy pending -> confirmed/rejected/cancelled', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('pending', 'rejected')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
  });

  it('allows completion and cancellation from confirmed and approved', () => {
    expect(canTransition('confirmed', 'completed')).toBe(true);
    expect(canTransition('approved', 'completed')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
    expect(canTransition('approved', 'cancelled')).toBe(true);
  });

  it('forbids transitions out of terminal statuses', () => {
    for (const terminal of TERMINAL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[terminal]).toEqual([]);
      for (const target of BOOKING_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('forbids no_show and ignored from being created via admin outcome actions on terminal states', () => {
    expect(canTransition('ignored', 'no_show')).toBe(false);
    expect(canTransition('cancelled', 'no_show')).toBe(false);
    expect(canTransition('completed', 'no_show')).toBe(false);
    expect(canTransition('rejected', 'no_show')).toBe(false);
  });

  it('forbids rejecting a non-pending booking', () => {
    expect(canTransition('confirmed', 'rejected')).toBe(false);
    expect(canTransition('approved', 'rejected')).toBe(false);
  });

  it('forbids pending -> approved directly (must go through confirmed)', () => {
    expect(canTransition('pending', 'approved')).toBe(false);
  });

  it('forbids re-approving or un-approving an approved booking', () => {
    expect(canTransition('approved', 'approved')).toBe(false);
    expect(canTransition('approved', 'confirmed')).toBe(false);
  });
});

describe('slot occupancy', () => {
  it('pending, confirmed, and approved occupy slots', () => {
    expect(SLOT_OCCUPYING_STATUSES).toEqual(['pending', 'confirmed', 'approved']);
    expect(occupiesSlot('pending')).toBe(true);
    expect(occupiesSlot('confirmed')).toBe(true);
    expect(occupiesSlot('approved')).toBe(true);
  });

  it('every terminal/legacy outcome releases the slot', () => {
    expect(occupiesSlot('ignored')).toBe(false);
    expect(occupiesSlot('cancelled')).toBe(false);
    expect(occupiesSlot('rejected')).toBe(false);
    expect(occupiesSlot('completed')).toBe(false);
    expect(occupiesSlot('no_show')).toBe(false);
  });

  it('unknown statuses do not occupy slots', () => {
    expect(occupiesSlot('unknown_future_status')).toBe(false);
  });
});

describe('terminal states', () => {
  it('marks ignored as terminal (admin history only, no further transitions)', () => {
    expect(isTerminal('ignored')).toBe(true);
  });

  it('keeps confirmed and approved non-terminal', () => {
    expect(isTerminal('confirmed')).toBe(false);
    expect(isTerminal('approved')).toBe(false);
  });

  it('includes the legacy terminal outcomes', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
  });
});

describe('customer visibility', () => {
  it('shows upcoming pending/confirmed/approved bookings to customers', () => {
    expect(isCustomerVisible('pending')).toBe(true);
    expect(isCustomerVisible('confirmed')).toBe(true);
    expect(isCustomerVisible('approved')).toBe(true);
  });

  it('keeps cancelled visible (refund information)', () => {
    expect(isCustomerVisible('cancelled')).toBe(true);
  });

  it('hides ignored bookings from customers', () => {
    expect(isCustomerVisible('ignored')).toBe(false);
  });

  it('hides completed, no-show, and rejected history from customers', () => {
    expect(isCustomerVisible('completed')).toBe(false);
    expect(isCustomerVisible('no_show')).toBe(false);
    expect(isCustomerVisible('rejected')).toBe(false);
  });
});

describe('revenue inclusion', () => {
  it('counts only approved and completed bookings as revenue', () => {
    expect(isRevenueStatus('approved')).toBe(true);
    expect(isRevenueStatus('completed')).toBe(true);
  });

  it('does not count confirmed as revenue (awaiting manual approval)', () => {
    expect(isRevenueStatus('confirmed')).toBe(false);
  });

  it('does not count ignored, no-show, cancelled, or rejected as revenue', () => {
    expect(isRevenueStatus('ignored')).toBe(false);
    expect(isRevenueStatus('no_show')).toBe(false);
    expect(isRevenueStatus('cancelled')).toBe(false);
    expect(isRevenueStatus('rejected')).toBe(false);
    expect(isRevenueStatus('pending')).toBe(false);
  });
});

describe('engagement statuses', () => {
  it('includes confirmed for backward compatibility alongside approved/completed', () => {
    expect(ENGAGEMENT_STATUSES).toContain('pending');
    expect(ENGAGEMENT_STATUSES).toContain('confirmed');
    expect(ENGAGEMENT_STATUSES).toContain('approved');
    expect(ENGAGEMENT_STATUSES).toContain('completed');
  });

  it('excludes ignored, no-show, cancelled, and rejected from engagement metrics', () => {
    expect(ENGAGEMENT_STATUSES).not.toContain('ignored');
    expect(ENGAGEMENT_STATUSES).not.toContain('no_show');
    expect(ENGAGEMENT_STATUSES).not.toContain('cancelled');
    expect(ENGAGEMENT_STATUSES).not.toContain('rejected');
  });
});

describe('status labels', () => {
  it('renders no_show as no-show', () => {
    expect(statusLabel('no_show')).toBe('no-show');
  });

  it('leaves other statuses readable', () => {
    expect(statusLabel('approved')).toBe('approved');
    expect(statusLabel('ignored')).toBe('ignored');
    expect(statusLabel('confirmed')).toBe('confirmed');
  });
});
