import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getAdminSession, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const username = getAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (!username) {
    redirect('/admin/login');
  }

  let unreadNotifications = 0;
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.isRead, false), sql`${notifications.customerId} IS NULL`));
    unreadNotifications = result[0]?.count || 0;
  } catch {
    unreadNotifications = 0;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Responsive nav: mobile top bar + drawer, desktop sidebar */}
      <AdminNav username={username} unread={unreadNotifications} />

      <main className="lg:ml-64 p-4 sm:p-6">{children}</main>
    </div>
  );
}
