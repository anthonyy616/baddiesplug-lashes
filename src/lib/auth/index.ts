import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import { neon } from '@neondatabase/serverless';
import env from '@/lib/env';
import { db, sql } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const sqlClient = neon(env.databaseUrl);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: undefined,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    Apple({
      clientId: process.env.APPLE_CLIENT_ID ?? '',
      clientSecret: process.env.APPLE_CLIENT_SECRET ?? '',
    }),
  ],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async session({ session, user }) {
      if (user) {
        try {
          const result = await sqlClient`
            SELECT id, role, phone FROM users WHERE auth_user_id = ${user.id}
          `;
          
          if (result.length > 0) {
            const dbUser = result[0];
            (session.user as any).id = dbUser.id;
            (session.user as any).role = dbUser.role;
            (session.user as any).phone = dbUser.phone;
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      try {
        // Insert using raw query builder to bypass type issues
        await sqlClient`INSERT INTO users (id, auth_user_id, name, email, role, created_at, updated_at)
           VALUES (${crypto.randomUUID()}, ${user.id}, ${user.name ?? 'User'}, ${user.email ?? ''}, 'customer', NOW(), NOW())
           ON CONFLICT (auth_user_id) DO NOTHING`;
      } catch (error) {
        console.error('Error creating user:', error);
      }
    },
  },
});
