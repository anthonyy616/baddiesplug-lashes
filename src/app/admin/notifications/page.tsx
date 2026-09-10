import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { formatLagosTime } from '@/lib/timezone';
import NotificationsList from './NotificationsList';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const all = await db.query.notifications.findMany({
    orderBy: [desc(notifications.createdAt)],
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600">Booking events requiring attention</p>
      </div>

      <NotificationsList
        items={all.map((n) => ({
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
