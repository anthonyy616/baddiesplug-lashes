interface BookingEmailBase {
  customerName: string;
  customerEmail?: string;
  reference: string;
  date: string;
  startTime: string;
  endTime: string;
}

export function generateBookingConfirmationEmail(input: BookingEmailBase & {
  services: string[];
  addons: string[];
  total: number;
  depositRequired: number;
}): string {
  return baseEmail('Booking Confirmed', input, `
    <p>Your booking has been confirmed!</p>
    ${serviceList(input.services, input.addons)}
    ${priceBox(input.total, input.depositRequired, 'Deposit Required')}
    ${paymentInstructions(input)}
    <p>We look forward to seeing you!</p>
  `);
}

export function generateAdminBookingEmail(input: BookingEmailBase & {
  services: string[];
  addons: string[];
  total: number;
  depositRequired: number;
  phone: string;
  notes?: string;
}): string {
  return baseEmail('New Booking Received', input, `
    <p>A new booking has been auto-approved and added to the calendar.</p>
    <p>Login with your credentials to the admin panel to view and manage this booking.</p>
    <p>Link to admin panel: <a href="https://thebaddiesplug.online/admin" target="_blank" rel="noopener noreferrer">https://thebaddiesplug.online/admin</a></p>
    <div style="background:#f9f9f9;padding:15px;border-radius:5px;margin:20px 0;">
      <p><strong>Customer email:</strong> ${escapeHtml(input.customerEmail || '')}</p>
      <p><strong>Customer phone:</strong> ${escapeHtml(input.phone)}</p>
    </div>
    ${serviceList(input.services, input.addons)}
    ${priceBox(input.total, input.depositRequired, 'Deposit Required')}
    ${paymentInstructions(input)}
    ${input.notes ? `<p><strong>Notes:</strong> ${escapeHtml(input.notes)}</p>` : ''}
  `);
}

export function generateBookingRequestEmail(input: BookingEmailBase & {
  services: string[];
  addons: string[];
  total: number;
  depositRequired: number;
  phone: string;
  notes?: string;
}): string {
  return baseEmail('New Booking Request', input, `
    <p>A new booking requires your attention:</p>
    <div style="background:#f9f9f9;padding:15px;border-radius:5px;margin:20px 0;">
      <p><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>
    </div>
    ${serviceList(input.services, input.addons)}
    ${priceBox(input.total, input.depositRequired, 'Deposit Required')}
    ${input.notes ? `<p><strong>Notes:</strong> ${escapeHtml(input.notes)}</p>` : ''}
    <p>Please review and approve/reject this booking.</p>
  `);
}

export function generateCancellationEmail(input: BookingEmailBase & {
  cancelledBy: 'customer' | 'admin';
}): string {
  const header = input.cancelledBy === 'customer'
    ? 'Booking Cancelled'
    : 'Booking Cancelled by Admin';

  const message = input.cancelledBy === 'customer'
    ? 'Please contact us via WhatsApp to discuss refund options.'
    : 'If you have any questions, please contact us on WhatsApp.';

  return baseEmail(header, input, `<p>${message}</p>`);
}

export function generateAppointmentReminderEmail(input: BookingEmailBase & {
  services: string[];
}): string {
  return baseEmail('Appointment Reminder', input, `
    <p>This is a reminder about your upcoming appointment:</p>
    ${serviceList(input.services, [])}
    <p>We look forward to seeing you!</p>
  `);
}

export function generateBookingRescheduledEmail(input: BookingEmailBase & {
  previousReference: string;
  services: string[];
}): string {
  return baseEmail('Booking Rescheduled', input, `
    <p>Your booking has been rescheduled by the admin.</p>
    <p><strong>Previous reference:</strong> ${escapeHtml(input.previousReference)}</p>
    ${serviceList(input.services, [])}
    <p>Your new appointment details are above.</p>
    <p>If you have any questions, please contact us.</p>
  `);
}

// ---------- shared helpers ----------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseEmail(title: string, input: BookingEmailBase, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #940025;">${escapeHtml(title)}</h1>
      <p>Dear ${escapeHtml(input.customerName)},</p>
      ${body}
      <div style="background:#f9f9f9;padding:15px;border-radius:5px;margin:20px 0;">
        <p><strong>Reference:</strong> ${escapeHtml(input.reference)}</p>
        <p><strong>Date:</strong> ${escapeHtml(input.date)}</p>
        <p><strong>Time:</strong> ${escapeHtml(input.startTime)} - ${escapeHtml(input.endTime)}</p>
      </div>
      <p>Best regards,<br>The Baddies Plug Team</p>
    </body>
    </html>
  `;
}

function serviceList(services: string[], addons: string[]): string {
  const serviceItems = services.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const addonItems = addons.map((a) => `<li>${escapeHtml(a)}</li>`).join('');

  return `
    ${services.length > 0 ? `<h3>Services</h3><ul>${serviceItems}</ul>` : ''}
    ${addons.length > 0 ? `<h3>Add-ons</h3><ul>${addonItems}</ul>` : ''}
  `;
}

function priceBox(total: number, deposit: number, depositLabel: string): string {
  return `
    <div style="background:#f9f9f9;padding:15px;border-radius:5px;margin:20px 0;">
      <p><strong>Total:</strong> &#8358;${(total / 100).toFixed(2)}</p>
      <p><strong>${escapeHtml(depositLabel)}:</strong> &#8358;${(deposit / 100).toFixed(2)}</p>
    </div>
  `;
}

function paymentInstructions(input: BookingEmailBase & { depositRequired: number }): string {
  const phoneNumber = process.env.WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || '';
  if (!phoneNumber) {
    return '<p><strong>If you have not paid the deposit, please make payment and contact us to send your receipt and lock in your appointment.</strong></p>';
  }

  const message = [
    'Deposit receipt for booking',
    `Reference: ${input.reference}`,
    `Deposit: ₦${(input.depositRequired / 100).toFixed(2)}`,
  ].join('\\n');
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return `
    <div style="background:#fff7f8;border:1px solid #f2c9d1;padding:15px;border-radius:5px;margin:20px 0;">
      <p><strong>If you haven&apos;t paid the deposit, please make payment and send your receipt to our WhatsApp channel to lock in your spot.</strong></p>
      <p><a href="${whatsappUrl}" style="color:#940025;font-weight:bold;">Send deposit receipt on WhatsApp</a></p>
    </div>
  `;
}
