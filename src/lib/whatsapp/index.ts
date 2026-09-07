/**
 * Generate WhatsApp deep link for booking payment
 */
export function generateBookingPaymentLink(
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
 * Generate WhatsApp link for cancellation
 */
export function generateCancellationLink(
  reference: string,
  customerName: string,
  date: string,
  startTime: string,
  endTime: string
): string {
  const phoneNumber = process.env.WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || '';

  const message = [
    `*Booking Cancellation*`,
    `\u200B`,
    `*Reference:* ${reference}`,
    `*Customer:* ${customerName}`,
    `*Date:* ${date}`,
    `*Time:* ${startTime} - ${endTime}`,
    `\u200B`,
    `Please contact us regarding refund options.`,
  ].join('\n');

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
}
