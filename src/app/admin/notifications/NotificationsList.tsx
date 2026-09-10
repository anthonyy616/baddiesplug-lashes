'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  bookingId: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsList({ items: initialItems }: { items: NotificationRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);

  const markRead = async (id?: string, markAll = false) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(markAll ? { markAll: true } : { id }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((n) => (markAll || n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => markRead(undefined, true)}
          disabled={busy || unreadCount === 0}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50"
        >
          Mark all read ({unreadCount})
        </button>
      </div>

      <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">No notifications</div>
        )}
        {items.map((n) => (
          <div key={n.id} className={`p-4 flex items-start justify-between gap-4 ${n.isRead ? 'opacity-60' : ''}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!n.isRead && <span className="w-2 h-2 bg-burgundy rounded-full flex-shrink-0" />}
                <p className={`font-medium ${n.isRead ? 'text-gray-500' : 'text-gray-900'}`}>{n.title}</p>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
              <p className="text-xs text-gray-400 mt-1">{n.createdAt}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {n.bookingId && (
                <Link
                  href={`/admin/bookings/${n.bookingId}`}
                  className="text-sm text-burgundy hover:underline"
                >
                  View
                </Link>
              )}
              {!n.isRead && (
                <button
                  onClick={() => markRead(n.id)}
                  disabled={busy}
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
