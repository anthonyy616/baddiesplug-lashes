export { sendEmail } from './send';
export type { EmailOptions } from './send';
export {
  queueEmailEvent,
  processEmailEvent,
  dispatchEmailEvent,
  retryPendingEmails,
} from './events';
export {
  generateBookingConfirmationEmail,
  generateBookingRequestEmail,
  generateCancellationEmail,
  generateAppointmentReminderEmail,
} from './templates';
