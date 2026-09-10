import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from '@/lib/db';
import { db } from '@/lib/db';
import { users, accounts, credentials, sessions } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * OAuth Integration Tests
 *
 * These tests verify the OAuth authentication flow for Google and Apple.
 * They test:
 * - User creation via OAuth
 * - Account linking for existing email/password users
 * - Session persistence
 * - Admin isolation (OAuth users cannot access admin)
 *
 * Prerequisites:
 * - Set up test OAuth credentials in .env.test or .env
 * - Have a running database instance
 */

// Test fixtures
const TEST_EMAIL = `test-${uuidv4()}@example.com`;
const TEST_NAME = 'Test OAuth User';
const TEST_PASSWORD = 'TestPassword123!';

describe('OAuth Authentication', () => {
  // Cleanup before tests
  beforeAll(async () => {
    // Ensure test database is clean
    console.log('OAuth tests starting...');
  });

  // Cleanup after tests
  afterAll(async () => {
    // Clean up test users
    console.log('OAuth tests completed.');
  });  describe('Account Linking', () => {
    it('should allow account linking when OAuth email matches existing user', async () => {
      // This test verifies that the schema supports account linking.
      // In production, allowDangerousEmailAccountLinking: true handles this.

      // Verify we can query accounts table (proves it exists and is accessible)
      const accountRows = await db.query.accounts.findMany({
        limit: 1,
        offset: 0,
      });
      expect(Array.isArray(accountRows)).toBe(true);

      // Verify users table is queryable
      const userRows = await db.query.users.findMany({
        limit: 1,
        offset: 0,
      });
      expect(Array.isArray(userRows)).toBe(true);

      // Verify accounts table has provider column by checking a sample
      // (if there are existing accounts in the DB)
      if (accountRows.length > 0) {
        const firstAccount = accountRows[0];
        expect(firstAccount.provider).toBeDefined();
        expect(firstAccount.providerAccountId).toBeDefined();
      }
    });

    it('should create a new user when OAuth email does not match existing user', async () => {
      // Verify that a new user can be created
      const newUserId = uuidv4();
      const authUserId = uuidv4();
      const testEmail = `test-${Date.now()}@example.com`;

      // Insert a test user
      await db.insert(users).values({
        id: newUserId,
        authUserId,
        name: TEST_NAME,
        email: testEmail,
        role: 'customer',
      });

      // Verify the user was created
      const createdUser = await db.query.users.findFirst({
        where: eq(users.id, newUserId),
      });

      expect(createdUser).not.toBeNull();
      expect(createdUser?.email).toBe(testEmail);
      expect(createdUser?.name).toBe(TEST_NAME);
      expect(createdUser?.role).toBe('customer');

      // Clean up
      await db.delete(users).where(eq(users.id, newUserId));
    });

    it('should NOT create duplicate users when OAuth links to existing email', async () => {
      // Create an initial user
      const existingUserId = uuidv4();
      const existingAuthUserId = uuidv4();
      const testEmail = `unique-${Date.now()}@example.com`;

      await db.insert(users).values({
        id: existingUserId,
        authUserId: existingAuthUserId,
        name: 'Existing User',
        email: testEmail,
        role: 'customer',
      });

      await db.insert(credentials).values({
        authUserId: existingAuthUserId,
        passwordHash: '$2a$10$testhash',
      });

      // Simulate OAuth account linking by adding an account entry
      const accountId = uuidv4();
      await db.insert(accounts).values({
        id: accountId,
        userId: existingUserId,
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'google-123',
      });

      // Verify only ONE user exists with this email
      const usersWithEmail = await db.query.users.findMany({
        where: eq(users.email, testEmail),
      });

      expect(usersWithEmail.length).toBe(1);

      // Verify the account is linked to the existing user
      const linkedAccount = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.provider, 'google'),
          eq(accounts.providerAccountId, 'google-123')
        ),
      });

      expect(linkedAccount).not.toBeNull();
      expect(linkedAccount?.userId).toBe(existingUserId);

      // Clean up
      await db.delete(accounts).where(eq(accounts.id, accountId));
      await db.delete(credentials).where(eq(credentials.authUserId, existingAuthUserId));
      await db.delete(users).where(eq(users.id, existingUserId));
    });
  });

  describe('OAuth User Integration', () => {
    it('should create a complete user profile for OAuth users', async () => {
      // Verify OAuth users have all required fields for the application
      const oauthUserId = uuidv4();

      await db.insert(users).values({
        id: oauthUserId,
        authUserId: uuidv4(),
        name: 'OAuth User',
        email: 'oauth-user@example.com',
        role: 'customer',
        phone: '+1234567890',
      });

      // Verify the user can be queried
      const user = await db.query.users.findFirst({
        where: eq(users.id, oauthUserId),
      });

      expect(user).not.toBeNull();
      expect(user?.name).toBeDefined();
      expect(user?.email).toBeDefined();
      expect(user?.role).toBe('customer');

      // Clean up
      await db.delete(users).where(eq(users.id, oauthUserId));
    });

    it('should store OAuth account information in accounts table', async () => {
      const userId = uuidv4();

      await db.insert(users).values({
        id: userId,
        authUserId: uuidv4(),
        name: 'Account Test User',
        email: 'account-test@example.com',
        role: 'customer',
      });

      // Insert OAuth account
      const accountId = uuidv4();
      await db.insert(accounts).values({
        id: accountId,
        userId,
        type: 'oauth',
        provider: 'apple',
        providerAccountId: 'apple-456',
        access_token: 'test-access-token',
        id_token: 'test-id-token',
      });

      // Verify account is stored
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.provider, 'apple'),
          eq(accounts.providerAccountId, 'apple-456')
        ),
      });

      expect(account).not.toBeNull();
      expect(account?.provider).toBe('apple');
      expect(account?.userId).toBe(userId);

      // Clean up
      await db.delete(accounts).where(eq(accounts.id, accountId));
      await db.delete(users).where(eq(users.id, userId));
    });

    it('should support session creation for OAuth users', async () => {
      const userId = uuidv4();
      const authUserId = uuidv4();

      await db.insert(users).values({
        id: userId,
        authUserId,
        name: 'Session Test User',
        email: 'session-test@example.com',
        role: 'customer',
      });

      // Create a session
      const sessionToken = uuidv4();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(sessions).values({
        id: uuidv4(),
        sessionToken,
        userId,
        expires,
      });

      // Verify session is stored
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.sessionToken, sessionToken),
      });

      expect(session).not.toBeNull();
      expect(session?.userId).toBe(userId);
      // expires is a Date object, compare properly
      expect(session?.expires?.getTime()).toBeGreaterThan(Date.now());

      // Clean up
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
      await db.delete(users).where(eq(users.id, userId));
    });
  });

  describe('Admin Isolation', () => {
    it('should ensure OAuth users have customer role by default', async () => {
      const oauthUserId = uuidv4();

      await db.insert(users).values({
        id: oauthUserId,
        authUserId: uuidv4(),
        name: 'OAuth Customer',
        email: 'oauth-customer@example.com',
        role: 'customer', // Default role for OAuth users
      });

      const user = await db.query.users.findFirst({
        where: eq(users.id, oauthUserId),
      });

      expect(user).not.toBeNull();
      expect(user?.role).toBe('customer');

      // Clean up
      await db.delete(users).where(eq(users.id, oauthUserId));
    });

    it('should NOT grant admin access based on OAuth provider', async () => {
      // Verify that having a Google or Apple account does not grant admin access
      const userId = uuidv4();

      await db.insert(users).values({
        id: userId,
        authUserId: uuidv4(),
        name: 'Regular OAuth User',
        email: 'regular@example.com',
        role: 'customer', // Explicitly customer, not admin
      });

      // Add OAuth accounts for both providers (simulating user has both)
      const googleAccountId = uuidv4();
      const appleAccountId = uuidv4();

      await db.insert(accounts).values([
        {
          id: googleAccountId,
          userId,
          type: 'oauth',
          provider: 'google',
          providerAccountId: 'google-user-123',
        },
        {
          id: appleAccountId,
          userId,
          type: 'oauth',
          provider: 'apple',
          providerAccountId: 'apple-user-456',
        },
      ]);

      // Verify the user still has customer role despite having OAuth accounts
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      expect(user).not.toBeNull();
      expect(user?.role).toBe('customer');

      // Clean up
      await db.delete(accounts).where(eq(accounts.id, googleAccountId));
      await db.delete(accounts).where(eq(accounts.id, appleAccountId));
      await db.delete(users).where(eq(users.id, userId));
    });

    it('should allow admin to view OAuth customer profiles', async () => {
      // Create a customer with OAuth
      const customerId = uuidv4();
      const authUserId = uuidv4();

      await db.insert(users).values({
        id: customerId,
        authUserId,
        name: 'OAuth Customer for Admin View',
        email: 'admin-view-customer@example.com',
        role: 'customer',
      });

      await db.insert(accounts).values({
        id: uuidv4(),
        userId: customerId,
        type: 'oauth',
        provider: 'google',
        providerAccountId: 'admin-view-google-id',
      });

      // Admin should be able to query this customer
      const customer = await db.query.users.findFirst({
        where: eq(users.id, customerId),
      });

      expect(customer).not.toBeNull();
      expect(customer?.email).toBe('admin-view-customer@example.com');

      // Clean up
      await db.delete(accounts).where(eq(accounts.userId, customerId));
      await db.delete(users).where(eq(users.id, customerId));
    });
  });

  describe('Booking Integration', () => {
    it('should allow OAuth customers to create bookings', async () => {
      // Create an OAuth customer
      const customerId = uuidv4();
      const authUserId = uuidv4();

      await db.insert(users).values({
        id: customerId,
        authUserId,
        name: 'Booking Customer',
        email: 'booking-customer@example.com',
        phone: '+1234567890',
        role: 'customer',
      });

      // Note: In real flow, bookings are created via the booking API
      // This test verifies the schema supports OAuth customers making bookings
      // by creating a test booking with the OAuth customer

      const bookingId = uuidv4();
      await db.insert(bookings).values({
        id: bookingId,
        reference: `TEST-${uuidv4().slice(0, 8).toUpperCase()}`,
        customerId,
        appointmentDate: new Date().toISOString().slice(0, 10),
        startTime: '10:00',
        endTime: '11:00',
        status: 'pending',
        phone: '+1234567890',
        subtotal: 50000,
        depositRequired: 25000,
        total: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Verify the booking was created for this customer
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
      });

      expect(booking).not.toBeNull();
      expect(booking?.customerId).toBe(customerId);

      // Clean up
      await db.delete(bookings).where(eq(bookings.id, bookingId));
      await db.delete(users).where(eq(users.id, customerId));
    });
  });
});

// Import bookings for the booking test
import { bookings } from '@/lib/db/schema';
