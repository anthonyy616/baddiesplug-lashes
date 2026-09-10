import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { users, accounts, sessions, credentials, verificationTokens } from '@/lib/db/schema';
import { z } from 'zod';

// Type assertions to satisfy DrizzleAdapter's strict types.
// Our custom tables have additional columns (e.g., authUserId, role, phone)
// but are compatible at runtime with the adapter's expectations.
const adaptUsersTable = users as any;
const adaptAccountsTable = accounts as any;
const adaptSessionsTable = sessions as any;
const adaptVerificationTokensTable = verificationTokens as any;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Use Drizzle adapter for persisting users, accounts, sessions, and verification tokens
  adapter: DrizzleAdapter(db, {
    usersTable: adaptUsersTable,
    accountsTable: adaptAccountsTable,
    sessionsTable: adaptSessionsTable,
    verificationTokensTable: adaptVerificationTokensTable,
  }),
  // Use database sessions via the adapter (instead of JWT-only)
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Find the linked application user row by email
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });

        if (!dbUser || dbUser.deletedAt) return null;

        // Password hash lives in the credentials table keyed by auth_user_id
        const credential = await db.query.credentials.findFirst({
          // credentials.authUserId mirrors users.authUserId
          where: eq(credentials.authUserId, dbUser.authUserId),
        });

        if (!credential || !credential.passwordHash) return null;

        const valid = await bcrypt.compare(password, credential.passwordHash);
        if (!valid) return null;

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          phone: dbUser.phone ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Look up our application user row (linked by email)
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, (user.email ?? '').toLowerCase()),
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.phone = dbUser.phone;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).phone = token.phone;
      }
      return session;
    },
  },
});
