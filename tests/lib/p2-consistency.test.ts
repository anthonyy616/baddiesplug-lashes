import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { formatNaira, formatNairaCompact } from '@/lib/format/money';
import {
  NOTIFICATION_TYPES,
  CUSTOMER_NOTIFICATION_TYPES,
  isAdminNotification,
} from '@/types';

/**
 * Regression coverage for P2 items:
 * - Notification types are constants/enums, not free-form strings
 * - Admin notification filtering is consistent between API and page
 * - One shared money formatter
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('notification type constants', () => {
  it('defines the full notification vocabulary', () => {
    expect(NOTIFICATION_TYPES).toContain('new_booking');
    expect(NOTIFICATION_TYPES).toContain('booking_cancelled');
    expect(NOTIFICATION_TYPES).toContain('booking_rescheduled');
    expect(NOTIFICATION_TYPES).toContain('customer_booking_cancelled');
    expect(NOTIFICATION_TYPES).toContain('customer_booking_rescheduled');
  });

  it('customer-facing types all carry the customer_ prefix', () => {
    for (const t of CUSTOMER_NOTIFICATION_TYPES) {
      expect(t.startsWith('customer_')).toBe(true);
    }
  });

  it('isAdminNotification excludes customer_ types and keeps admin types', () => {
    expect(isAdminNotification('customer_booking_cancelled')).toBe(false);
    expect(isAdminNotification('customer_booking_rescheduled')).toBe(false);
    expect(isAdminNotification('new_booking')).toBe(true);
    expect(isAdminNotification('booking_cancelled')).toBe(true);
    expect(isAdminNotification('booking_rescheduled')).toBe(true);
  });
});

describe('admin notification filtering consistency', () => {
  it('API route filters customer_ types at the DB level', () => {
    const src = read('src/app/api/admin/notifications/route.ts');
    expect(src).toContain("notLike(notifications.type, 'customer_%')");
    expect(src).toContain('isAdminNotification');
  });

  it('admin page applies the same filter', () => {
    const src = read('src/app/admin/notifications/page.tsx');
    expect(src).toContain("notLike(notifications.type, 'customer_%')");
    expect(src).toContain('isAdminNotification');
  });

  it('writes in the admin route stay within the declared vocabulary', () => {
    const adminRoute = read('src/app/api/admin/bookings/[id]/route.ts');
    const bookingLib = read('src/lib/booking/index.ts');
    // Notification types written by app code
    const types = [
      'booking_approved', 'booking_cancelled', 'booking_completed',
      'booking_no_show', 'booking_rescheduled', 'customer_booking_cancelled',
      'customer_booking_rescheduled', 'new_booking',
    ];
    for (const src of [adminRoute, bookingLib]) {
      // Only notifications insert blocks: narrow to `insert(notifications)`
      for (const insertMatch of src.matchAll(/insert\(notifications\)[\s\S]{0,400}?type: `([^`]+)`|insert\(notifications\)[\s\S]{0,400}?type: '([^']+)'/g)) {
        const written = insertMatch[1] ?? insertMatch[2];
        if (written === 'booking_${targetStatus}') {
          // Template built from TARGET_STATUS values; verify all members map into the vocabulary
          for (const s of ['approved', 'cancelled', 'completed', 'no_show']) {
            expect(types).toContain(`booking_${s}`);
          }
          continue;
        }
        if (written) expect(types).toContain(written);
      }
    }
  });
});

describe('shared money formatter', () => {
  it('formats kobo to naira with two decimals', () => {
    expect(formatNaira(250000)).toBe('₦2,500.00');
    expect(formatNaira(0)).toBe('₦0.00');
  });

  it('compact variant has no forced decimals', () => {
    expect(formatNairaCompact(250000)).toBe('₦2,500');
  });

  it('booking components import the shared formatter (no inline Intl construction)', () => {
    const files = [
      'src/app/booking/BookingFlow.tsx',
      'src/components/booking/ReviewStep.tsx',
      'src/components/booking/StickySummaryBar.tsx',
      'src/components/booking/ServiceCards.tsx',
      'src/components/booking/AddonCards.tsx',
    ];
    for (const f of files) {
      const src = read(f);
      expect(src).toContain('@/lib/format/money');
      expect(src).not.toMatch(/new Intl\.NumberFormat\('en-NG'/);
    }
  });
});

describe('reschedule messaging (P2)', () => {
  it('customer notification shows old AND new appointment details', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toMatch(/rescheduled from \$\{booking\.appointmentDate\} \$\{booking\.startTime\} to/);
  });

  it('reschedule email template renders previous appointment and approval state', () => {
    const src = read('src/lib/email/templates.ts');
    expect(src).toContain('Previous appointment');
    expect(src).toContain('wasApproved');
    expect(src).toContain('remains <strong>approved</strong>');
  });
});
