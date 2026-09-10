import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  varchar,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Users table - extended with our custom fields while compatible with NextAuth
// NextAuth expects: id, name, email, emailVerified, image, password,uuid
// We'll use authUserId to link to NextAuth's user id
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  role: varchar('role', { length: 20 }).notNull().default('customer'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('users_email_idx').on(table.email),
  index('users_role_idx').on(table.role),
  index('users_deleted_at_idx').on(table.deletedAt),
]);

// Admin panel credentials (hidden panel; username chosen at first login).
// Session cookies are signed with SESSION_SECRET.
export const adminAuth = pgTable('admin_auth', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Password credentials for email/password sign-in.
// Keyed by auth_user_id which mirrors users.auth_user_id.
export const credentials = pgTable('credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// NextAuth tables - required for DrizzleAdapter
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
  created_at: timestamp('created_at', { withTimezone: true }),
  updated_at: timestamp('updated_at', { withTimezone: true }),
}, (table) => [
  index('accounts_userId_idx').on(table.userId),
  uniqueIndex('accounts_provider_providerAccountId_unique').on(table.provider, table.providerAccountId),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (table) => [
  index('sessions_userId_idx').on(table.userId),
]);

// Password reset tokens (single-use, 1 hour expiry)
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('password_reset_tokens_identifier_idx').on(table.identifier),
]);

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (table) => [
  uniqueIndex('verification_tokens_identifier_token_unique').on(table.identifier, table.token),
]);

// Services table
export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  category: varchar('category', { length: 50 }).notNull(), // 'lash' or 'eyebrow'
  description: text('description').notNull(),
  notes: text('notes').notNull(),
  price: integer('price').notNull(), // NGN kobo (minor currency unit)
  durationMinutes: integer('duration_minutes').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('services_category_idx').on(table.category),
  index('services_is_active_idx').on(table.isActive),
  index('services_display_order_idx').on(table.displayOrder),
  index('services_deleted_at_idx').on(table.deletedAt),
]);

// Service images table
export const serviceImages = pgTable('service_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  publicUrl: varchar('public_url', { length: 500 }).notNull(),
  altText: varchar('alt_text', { length: 255 }),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('service_images_service_id_idx').on(table.serviceId),
  index('service_images_display_order_idx').on(table.displayOrder),
]);

// Addons table
export const addons = pgTable('addons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // NGN kobo
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('addons_is_active_idx').on(table.isActive),
  index('addons_display_order_idx').on(table.displayOrder),
]);

// Bookings table
export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: varchar('reference', { length: 50 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  appointmentDate: varchar('appointment_date', { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  phone: varchar('phone', { length: 20 }).notNull(),
  customerNotes: text('customer_notes'),
  subtotal: integer('subtotal').notNull(), // NGN kobo
  depositRequired: integer('deposit_required').notNull(), // NGN kobo
  total: integer('total').notNull(), // NGN kobo
  previousBookingId: uuid('previous_booking_id'),
  createdByAdminId: uuid('created_by_admin_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('bookings_customer_id_idx').on(table.customerId),
  index('bookings_appointment_date_idx').on(table.appointmentDate),
  index('bookings_status_idx').on(table.status),
  index('bookings_created_at_idx').on(table.createdAt),
  // Active booking unique constraint to prevent double booking.
  // Only pending/confirmed bookings occupy a slot; cancelled/rejected/completed
  // bookings must not block it. See booking-rules.md.
  uniqueIndex('active_booking_slot_unique')
    .on(
      table.appointmentDate,
      table.startTime,
      table.endTime,
    )
    .where(sql`status IN ('pending', 'confirmed')`),
]);

// Booking services table (historical snapshots)
export const bookingServices = pgTable('booking_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => services.id, { onDelete: 'restrict' }),
  serviceNameSnapshot: varchar('service_name_snapshot', { length: 255 }).notNull(),
  unitPriceSnapshot: integer('unit_price_snapshot').notNull(), // NGN kobo at time of booking
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('booking_services_booking_id_idx').on(table.bookingId),
  index('booking_services_service_id_idx').on(table.serviceId),
]);

// Booking addons table (historical snapshots)
export const bookingAddons = pgTable('booking_addons', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  addonId: uuid('addon_id').notNull().references(() => addons.id, { onDelete: 'restrict' }),
  addonNameSnapshot: varchar('addon_name_snapshot', { length: 255 }).notNull(),
  unitPriceSnapshot: integer('unit_price_snapshot').notNull(), // NGN kobo at time of booking
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('booking_addons_booking_id_idx').on(table.bookingId),
  index('booking_addons_addon_id_idx').on(table.addonId),
]);

// Payments table
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'restrict' }),
  amount: integer('amount').notNull(), // NGN kobo
  paymentType: varchar('payment_type', { length: 20 }).notNull(), // 'deposit', 'balance', 'other'
  note: varchar('note', { length: 500 }),
  recordedByAdminId: uuid('recorded_by_admin_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('payments_booking_id_idx').on(table.bookingId),
]);

// Availability overrides table
export const availabilityOverrides = pgTable('availability_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM
  mode: varchar('mode', { length: 20 }).notNull(), // 'available' or 'blocked'
  reason: varchar('reason', { length: 500 }),
  // Nullable: admin panel sessions are standalone (not users rows)
  createdByAdminId: uuid('created_by_admin_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('availability_overrides_date_idx').on(table.date),
]);

// Reference images table
export const referenceImages = pgTable('reference_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 50 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('reference_images_booking_id_idx').on(table.bookingId),
  index('reference_images_expires_at_idx').on(table.expiresAt),
]);

// Notifications table
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 100 }).notNull(),
  bookingId: uuid('booking_id'),
  customerId: uuid('customer_id'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (table) => [
  index('notifications_is_read_idx').on(table.isRead),
  index('notifications_created_at_idx').on(table.createdAt),
  index('notifications_booking_id_idx').on(table.bookingId),
  index('notifications_customer_id_idx').on(table.customerId),
]);

// Email events table
export const emailEvents = pgTable('email_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  bookingId: uuid('booking_id'),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  payload: text('payload').notNull(), // JSON string
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'processing', 'sent', 'failed'
  attempts: integer('attempts').notNull().default(0),
  lastError: varchar('last_error', { length: 1000 }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('email_events_status_scheduled_for_idx').on(table.status, table.scheduledFor),
  index('email_events_booking_id_idx').on(table.bookingId),
]);

// Relations
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [verificationTokens.identifier],
    references: [users.email],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  notifications: many(notifications),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  images: many(serviceImages),
  bookingServices: many(bookingServices),
}));

export const serviceImagesRelations = relations(serviceImages, ({ one }) => ({
  service: one(services, {
    fields: [serviceImages.serviceId],
    references: [services.id],
  }),
}));

export const addonsRelations = relations(addons, ({ many }) => ({
  bookingAddons: many(bookingAddons),
}));

export const bookingsRelations = relations(bookings, ({ many, one }) => ({
  services: many(bookingServices),
  addons: many(bookingAddons),
  payments: many(payments),
  referenceImages: many(referenceImages),
  notifications: many(notifications),
  emailEvents: many(emailEvents),
  customer: one(users, {
    fields: [bookings.customerId],
    references: [users.id],
  }),
  previousBooking: one(bookings, {
    fields: [bookings.previousBookingId],
    references: [bookings.id],
    relationName: 'previousBooking',
  }),
}));

export const bookingServicesRelations = relations(bookingServices, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingServices.bookingId],
    references: [bookings.id],
  }),
  service: one(services, {
    fields: [bookingServices.serviceId],
    references: [services.id],
  }),
}));

export const bookingAddonsRelations = relations(bookingAddons, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingAddons.bookingId],
    references: [bookings.id],
  }),
  addon: one(addons, {
    fields: [bookingAddons.addonId],
    references: [addons.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const referenceImagesRelations = relations(referenceImages, ({ one }) => ({
  booking: one(bookings, {
    fields: [referenceImages.bookingId],
    references: [bookings.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  booking: one(bookings, {
    fields: [notifications.bookingId],
    references: [bookings.id],
  }),
  customer: one(users, {
    fields: [notifications.customerId],
    references: [users.id],
  }),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  booking: one(bookings, {
    fields: [emailEvents.bookingId],
    references: [bookings.id],
  }),
}));

export const availabilityOverridesRelations = relations(availabilityOverrides, ({ one }) => ({
  createdBy: one(users, {
    fields: [availabilityOverrides.createdByAdminId],
    references: [users.id],
  }),
}));
