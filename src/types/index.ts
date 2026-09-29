export type UserRole = 'customer' | 'admin';

export type ServiceCategory = 'lash' | 'eyebrow';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'approved'
  | 'ignored'
  | 'cancelled'
  | 'rejected'
  | 'completed'
  | 'no_show';

export type PaymentType = 'deposit' | 'balance' | 'other';

/** Where a booking came from: the website flow or an admin-created booking. */
export type BookingSource = 'customer' | 'admin';

export type AvailabilityMode = 'available' | 'blocked';

export type EmailEventType =
  | 'booking.requested'
  | 'booking.confirmed'
  | 'booking.admin_new'
  | 'booking.customer_cancelled'
  | 'booking.admin_cancelled'
  | 'booking.rescheduled'
  | 'appointment.reminder';

export type EmailEventStatus = 'pending' | 'processing' | 'sent' | 'failed';

/**
 * Notification types. The admin list filters OUT customer-facing types (the
 * `customer_` prefix); everything else is admin-facing. Keep these as the
 * single vocabulary — never write free-form strings to notifications.type.
 */
export const NOTIFICATION_TYPES = [
  'new_booking',
  'booking_approved',
  'booking_cancelled',
  'booking_completed',
  'booking_no_show',
  'booking_rescheduled',
  'customer_booking_cancelled',
  'customer_booking_rescheduled',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Notification types visible to the customer portal. */
export const CUSTOMER_NOTIFICATION_TYPES = [
  'customer_booking_cancelled',
  'customer_booking_rescheduled',
] as const;

/** Admin-list filter: exclude customer-facing notifications. */
export function isAdminNotification(type: string): boolean {
  return !type.startsWith('customer_');
}

/** Admin action names and their lifecycle outcomes. */
export type AdminBookingAction =
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'complete'
  | 'no_show'
  | 'reschedule';

/** Immutable booking audit-event vocabulary (booking_event.event_type). */
export type BookingEventType =
  | 'created'
  | 'rescheduled'
  | 'cancelled'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'no_show'
  | 'status_changed';

export type ReferenceImageFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

export interface User {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  category: ServiceCategory;
  subcategory?: string | null;
  description: string;
  notes: string;
  price: number; // in NGN kobo (minor currency unit)
  durationMinutes: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  images?: ServiceImage[];
}

export interface ServiceImage {
  id: string;
  serviceId: string;
  storageKey: string;
  publicUrl: string;
  altText: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Addon {
  id: string;
  name: string;
  description: string;
  price: number; // in NGN kobo
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  reference: string;
  customerId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  phone: string;
  customerNotes: string;
  subtotal: number; // in NGN kobo
  depositRequired: number; // in NGN kobo
  total: number; // in NGN kobo
  previousBookingId?: string | null;
  idempotencyKey?: string | null;
  createdByAdminId?: string | null;
  bookingSource: BookingSource;
  adminBookingNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date | null;
  completedAt?: Date | null;
  services?: BookingService[];
  addons?: BookingAddon[];
  payments?: Payment[];
  referenceImages?: ReferenceImage[];
  customer?: User;
}

export interface BookingService {
  id: string;
  bookingId: string;
  serviceId: string;
  serviceNameSnapshot: string;
  unitPriceSnapshot: number;
  createdAt: Date;
}

export interface BookingAddon {
  id: string;
  bookingId: string;
  addonId: string;
  addonNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  createdAt: Date;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number; // in NGN kobo
  paymentType: PaymentType;
  note?: string;
  recordedByAdminId?: string | null;
  createdAt: Date;
}

export interface AvailabilityOverride {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: AvailabilityMode;
  reason?: string;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenceImage {
  id: string;
  bookingId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: Date;
  createdAt: Date;
  url?: string;
}

export interface Notification {
  id: string;
  type: string;
  bookingId?: string;
  customerId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date | null;
}

export interface EmailEvent {
  id: string;
  eventType: EmailEventType;
  bookingId?: string;
  recipient: string;
  payload: Record<string, unknown>;
  status: EmailEventStatus;
  attempts: number;
  lastError?: string;
  scheduledFor: Date;
  sentAt?: Date | null;
  createdAt: Date;
}

export interface BookingRequest {
  serviceIds: string[];
  addonIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  phone?: string;
  notes?: string;
}

export interface PriceSnapshot {
  services: {
    id: string;
    name: string;
    price: number;
  }[];
  addons: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  subtotal: number;
  depositRequired: number;
  total: number;
}

export interface CreateBookingInput {
  serviceIds: string[];
  addonIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  phone: string;
  notes?: string;
  referenceImageIds?: string[];
}

export interface AdminBookingEditInput {
  customerId?: string;
  serviceIds?: string[];
  addonIds?: string[];
  date?: string;
  startTime?: string;
  endTime?: string;
  phone?: string;
  notes?: string;
}

export interface AnalyticsData {
  customers: {
    total: number;
    new: number;
    repeat: number;
  };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    approved: number;
    ignored: number;
    completed: number;
    cancelled: number;
    rejected: number;
    noShow: number;
  };
  services: {
    mostPopular: string | null;
    bookingCountByService: { serviceId: string; serviceName: string; count: number }[];
  };
  time: {
    peakDays: { day: string; count: number }[];
    peakTimes: { timeSlot: string; count: number }[];
  };
  finance: {
    recordedRevenue: number;
    recordedDeposits: number;
    monthlyTotals: { month: string; total: number; deposits: number }[];
    customRange?: { start: string; end: string; total: number; deposits: number } | null;
  };
}
