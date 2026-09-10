import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { users, accounts, credentials } from '@/lib/db/schema';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Auth.js adapter backed by our custom `users`/`accounts` tables.
 *
 * The stock DrizzleAdapter assumes a NextAuth-shaped users table (emailVerified,
 * image columns, nullable name) and doesn't know about our NOT NULL auth_user_id
 * column, so OAuth sign-in could never create a user profile. This adapter maps
 * Auth.js's calls onto our schema instead:
 * - new users get a fresh auth_user_id and the default 'customer' role
 * - soft-deleted users are treated as non-existent (they can re-register)
 * - OAuth accounts are stored in `accounts` keyed by (provider, providerAccountId)
 *
 * Only the OAuth-flow methods are implemented; sessions are JWT-based
 * (required anyway for the credentials provider), so no session methods needed.
 */
const customAdapter: Adapter = {
  async createUser(data) {
    const email = (data.email ?? '').toLowerCase();
    const [row] = await db
      .insert(users)
      .values({
        // Auth.js may pass a profile id; ours is DB-generated.
        // authUserId ties the profile to credentials rows; OAuth-only users
        // get their own unused auth_user_id since the column is NOT NULL.
        authUserId: uuidv4(),
        name: data.name ?? email.split('@')[0],
        email,
        role: 'customer',
      })
      .returning();
    return toAdapterUser(row);
  },

  async getUser(id) {
    const row = await db.query.users.findFirst({
      where: and(eq(users.id, id), isNull(users.deletedAt)),
    });
    return row ? toAdapterUser(row) : null;
  },

  async getUserByEmail(email) {
    const row = await db.query.users.findFirst({
      where: and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)),
    });
    return row ? toAdapterUser(row) : null;
  },

  async getUserByAccount({ provider, providerAccountId }) {
    const result = await db
      .select({ user: users })
      .from(accounts)
      .innerJoin(users, eq(users.id, accounts.userId))
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    const row = result[0]?.user;
    return row ? toAdapterUser(row) : null;
  },

  async updateUser(data) {
    if (!data.id) throw new Error('No user id.');
    const [row] = await db
      .update(users)
      .set({
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.email != null ? { email: data.email.toLowerCase() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.id))
      .returning();
    if (!row) throw new Error('No user found.');
    return toAdapterUser(row);
  },

  // Our users table has no emailVerified/image columns, so those fields
  // (the only ones Auth.js writes on OAuth link) are intentionally dropped.
  async linkAccount(data) {
    await db.insert(accounts).values({
      id: uuidv4(),
      userId: data.userId,
      type: data.type,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      refresh_token: data.refresh_token ?? null,
      access_token: data.access_token ?? null,
      expires_at: data.expires_at ?? null,
      token_type: data.token_type ?? null,
      scope: data.scope ?? null,
      id_token: data.id_token ?? null,
      // Auth.js types session_state broadly (it can be an object for some
      // providers); our column is varchar, so coerce anything non-null.
      session_state:
        data.session_state == null ? null : String(data.session_state),
    });
  },

  async unlinkAccount({ provider, providerAccountId }) {
    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      );
  },
};

/**
 * Map our custom users row to Auth.js's AdapterUser shape.
 * role/phone survive via the jwt callback, which re-reads the row from the DB.
 */
function toAdapterUser(row: typeof users.$inferSelect): AdapterUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: null,
    image: null,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: customAdapter,
  // JWT sessions: the credentials provider requires them (Auth.js throws
  // UnsupportedStrategy with the database strategy), and they avoid a DB
  // round-trip on every request. The jwt callback stamps our app user id,
  // role, and phone onto the token so server code can use session.user.id.
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
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
      if (user?.email) {
        // On sign-in, stamp our application user fields onto the token.
        // user.id is our users.id for both providers (custom adapter /
        // credentials authorize return it), but re-reading by email keeps
        // role/phone fresh and covers legacy tokens.
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email.toLowerCase()),
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
