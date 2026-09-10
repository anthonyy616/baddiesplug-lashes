import { auth } from './index';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminSession, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { cookies } from 'next/headers';

export type UserRole = 'customer' | 'admin';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  image?: string | null;
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user as SessionUser | undefined;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  // Admin panel uses its own cookie session; customer routes use NextAuth.
  const cookieStore = await cookies();
  const adminUsername = getAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (adminUsername) {
    // Admin API actions don't need a customer row; return a synthetic session.
    return {
      id: `admin:${adminUsername}`,
      name: adminUsername,
      email: '',
      role: 'admin',
    };
  }

  const user = await requireAuth();
  if (user.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return user;
}

export async function getUserById(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  return user;
}

export async function getUserByEmail(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  return user;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.role === 'admin';
}
