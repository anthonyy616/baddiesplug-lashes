import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

export function generateBookingConfirmationEmail(
  customerName: string,
  reference: string,
  date: string,
  startTime: string,
  endTime: string,
  services: string[],
  addons: string[],
  total: number,
  depositRequired: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Booking Confirmed</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #940025;">Booking Confirmed</h1>
      <p>Dear ${customerName},</p>
      <p>Your booking has been confirmed!</p>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Reference:</strong> ${reference}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
      </div>
      <h3>Services</h3>
      <ul>
        ${services.map(s => `<li>${s}</li>`).join('')}
      </ul>
      ${addons.length > 0 ? `
      <h3>Add-ons</h3>
      <ul>
        ${addons.map(a => `<li>${a}</li>`).join('')}
      </ul>
      ` : ''}
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Total:</strong> ₦${(total / 100).toFixed(2)}</p>
        <p><strong>Deposit Paid:</strong> ₦${(depositRequired / 100).toFixed(2)}</p>
      </div>
      <p>We look forward to seeing you!</p>
      <p>Best regards,<br>The Baddies Plug Team</p>
    </body>
    </html>
  `;
}

export function generateBookingRequestEmail(
  customerName: string,
  reference: string,
  date: string,
  startTime: string,
  endTime: string,
  services: string[],
  addons: string[],
  total: number,
  depositRequired: number,
  phone: string,
  notes?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Booking Request</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #940025;">New Booking Request</h1>
      <p>A new booking requires your attention:</p>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Reference:</strong> ${reference}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
      </div>
      <h3>Services</h3>
      <ul>
        ${services.map(s => `<li>${s}</li>`).join('')}
      </ul>
      ${addons.length > 0 ? `
      <h3>Add-ons</h3>
      <ul>
        ${addons.map(a => `<li>${a}</li>`).join('')}
      </ul>
      ` : ''}
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Total:</strong> ₦${(total / 100).toFixed(2)}</p>
        <p><strong>Deposit Required:</strong> ₦${(depositRequired / 100).toFixed(2)}</p>
      </div>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p>Please review and approve/reject this booking.</p>
    </body>
    </html>
  `;
}

export function generateCancellationEmail(
  customerName: string,
  reference: string,
  date: string,
  startTime: string,
  endTime: string,
  cancelledBy: 'customer' | 'admin'
): string {
  const header = cancelledBy === 'customer' 
    ? 'Booking Cancelled by Customer'
    : 'Booking Cancelled by Admin';

  const message = cancelledBy === 'customer'
    ? 'Please contact us via WhatsApp to discuss refund options.'
    : 'If you have any questions, please contact us.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Booking Cancelled</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #940025;">${header}</h1>
      <p>Dear ${customerName},</p>
      <p>Your booking has been cancelled:</p>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Reference:</strong> ${reference}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
      </div>
      <p>${message}</p>
      <p>Best regards,<br>The Baddies Plug Team</p>
    </body>
    </html>
  `;
}

export function generateAppointmentReminderEmail(
  customerName: string,
  reference: string,
  date: string,
  startTime: string,
  endTime: string,
  services: string[]
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Appointment Reminder</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #940025;">Appointment Reminder</h1>
      <p>Dear ${customerName},</p>
      <p>This is a reminder about your upcoming appointment:</p>
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Reference:</strong> ${reference}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
      </div>
      <h3>Services</h3>
      <ul>
        ${services.map(s => `<li>${s}</li>`).join('')}
      </ul>
      <p>We look forward to seeing you!</p>
      <p>Best regards,<br>The Baddies Plug Team</p>
    </body>
    </html>
  `;
}
