import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Stage 1 — Customer rescheduling awareness.
 *
 * Policy: customers CAN request a reschedule by contacting the business, but
 * they cannot change their appointment themselves. Rescheduling is an
 * admin-controlled operation; the customer receives a confirmation email once
 * the appointment has been moved.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('rescheduling policy messaging (Stage 1)', () => {
  it('policies page contains a rescheduling policy section', () => {
    const page = read('src/app/policies/page.tsx');
    expect(page).toContain("id: 'rescheduling'");
    expect(page).toContain('Rescheduling Policy');
    // States customers cannot change the appointment themselves
    expect(page).toContain('You cannot change the date or time of your appointment yourself');
    // States the admin performs the change and confirmation is emailed
    expect(page).toContain('performed by our team on your behalf');
    expect(page).toContain('confirmation email');
  });

  it('provides a shared reschedule-policy component with the WhatsApp contact path', () => {
    const src = read('src/components/booking/ReschedulePolicy.tsx');
    expect(src).toContain('NEXT_PUBLIC_WHATSAPP_NUMBER');
    expect(src).toContain('You cannot change the date or time yourself');
    expect(src).toContain('confirmation email');
    // Must NOT contain reschedule controls of any kind
    expect(src.toLowerCase()).not.toContain('reschedulebutton');
    expect(src).not.toMatch(/onClick|onSubmit|fetch\(/);
  });

  it('booking detail page shows the rescheduling block for active bookings', () => {
    const page = read('src/app/account/bookings/[id]/page.tsx');
    expect(page).toContain('ReschedulePolicy');
  });

  it('account page shows the rescheduling block', () => {
    const page = read('src/app/account/page.tsx');
    expect(page).toContain('ReschedulePolicy');
  });
});

describe('no customer-side reschedule mutation (Stage 1)', () => {
  it('customer booking domain no longer exports a reschedule function', () => {
    const src = read('src/lib/booking/index.ts');
    expect(src).not.toContain('export async function rescheduleBooking');
  });

  it('no customer-facing API route exposes a reschedule mutation', () => {
    const fs = require('fs');
    const apiDir = join(process.cwd(), 'src', 'app', 'api');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'route.ts') files.push(full);
      }
    };
    walk(apiDir);
    for (const f of files) {
      const src = read(f.replace(/\\/g, '/').replace(join(process.cwd()).replace(/\\/g, '/') + '/', ''));
      // Any reschedule handling must live under /api/admin only
      if (/reschedule/i.test(src)) {
        expect(f.replace(/\\/g, '/')).toContain('/api/admin/');
      }
    }
  });
});

describe('admin reschedule confirmation email (Stage 1)', () => {
  it('queues a durable rescheduled email with booking reference, old AND new appointment info', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    expect(src).toContain("eventType: 'booking.rescheduled'");
    expect(src).toContain('previousDate: booking.appointmentDate');
    expect(src).toContain('previousStartTime: booking.startTime');
    expect(src).toContain('previousEndTime: booking.endTime');
    expect(src).toContain('previousReference');
  });

  it('email event is queued inside the transaction via the tx handle (failure cannot corrupt the booking)', () => {
    const src = read('src/app/api/admin/bookings/[id]/route.ts');
    const queueIdx = src.indexOf("eventType: 'booking.rescheduled'");
    const txIdx = src.indexOf('await db.transaction');
    const txEnd = src.indexOf('// Dispatch after commit');
    expect(queueIdx).toBeGreaterThan(txIdx);
    expect(queueIdx).toBeLessThan(txEnd);
  });

  it('email template renders previous appointment details and service info', () => {
    const src = read('src/lib/email/templates.ts');
    expect(src).toContain('Previous appointment');
    expect(src).toContain('previousReference');
    expect(src).toContain('serviceList');
  });

  it('rescheduled payload schema validates previous appointment fields', () => {
    const src = read('src/lib/email/payloads.ts');
    const idx = src.indexOf("'booking.rescheduled'");
    const body = src.slice(idx, src.indexOf('appointment.reminder'));
    expect(body).toContain('previousDate');
    expect(body).toContain('previousStartTime');
    expect(body).toContain('previousEndTime');
    expect(body).toContain('previousReference');
  });
});
