import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { desc, notLike } from 'drizzle-orm';
import { formatLagosTime } from '@/lib/timezone';
import { isAdminNotification } from '@/types';
import NotificationsList from './NotificationsList';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const all = await db.query.notifications.findMany({
    where: notLike(notifications.type, 'customer_%'),
    orderBy: [desc(notifications.createdAt)],
    limit: 200,
  });

  // Consistent with the admin API route: customer_ prefix marks
  // customer-facing types; everything else is admin-facing.
  const items = all.filter((n) => isAdminNotification(n.type));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600">Booking events requiring attention</p>
      </div>

      <NotificationsList
        items={items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          bookingId: n.bookingId,
          isRead: n.isRead,
          createdAt: formatLagosTime(new Date(n.createdAt), 'MMM d, h:mm a'),
        }))}
      />
    </div>
  );
}
