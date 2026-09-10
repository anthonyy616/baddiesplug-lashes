import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, sql } from '@/lib/db';
import { users, accounts, sessions, credentials, verificationTokens } from '@/lib/db/schema';
import { z } from 'zod';
import { getAppleClientSecret } from './apple-jwt';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Get Apple client secret (generated dynamically from .p8 key if configured)
let cachedAppleSecret: string | null = null;
let secretExpiration: number = 0;

async function getAppleSecret(): Promise<string> {
  // Cache the secret for up to 5 hours to avoid excessive JWT generation
  if (cachedAppleSecret && Date.now() < secretExpiration) {
    return cachedAppleSecret;
  }
  
  const secret = await getAppleClientSecret();
  if (secret) {
    cachedAppleSecret = secret;
    secretExpiration = Date.now() + 5 * 60 * 60 * 1000; // 5 hours
  }
  return secret;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Use Drizzle adapter for persisting users, accounts, sessions, and verification tokens
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
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
    Apple({
      clientId: process.env.APPLE_CLIENT_ID ?? '',
      // Dynamically generate Apple client secret from .p8 key, or use env var if provided
      clientSecret: async () => {
        // Try env var first, then generate from .p8 key
        const envSecret = process.env.APPLE_CLIENT_SECRET;
        if (envSecret) return envSecret;
        return getAppleSecret();
      },
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
