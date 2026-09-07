import { auth } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/types';
import { db } from '@/lib/db';
import { bookings, users, payments, services } from '@/lib/db/schema';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { getCurrentLagosDate, getLagosTime } from '@/lib/timezone';
import Link from 'next/link';

export default async function AnalyticsPage() {
  const session = await auth();
  await requireAdmin();

  const today = getCurrentLagosDate();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Get analytics data
  const [
    totalCustomers,
    totalBookings,
    pendingCount,
    confirmedCount,
    completedCount,
    cancelledCount,
    rejectedCount,
    noShowCount,
    totalRevenue,
    totalDeposits,
    todayRevenue,
  ] = await Promise.all([
    getCount(users),
    getCount(bookings),
    getCount(bookings, eq(bookings.status, 'pending')),
    getCount(bookings, eq(bookings.status, 'confirmed')),
    getCount(bookings, eq(bookings.status, 'completed')),
    getCount(bookings, eq(bookings.status, 'cancelled')),
    getCount(bookings, eq(bookings.status, 'rejected')),
    getCount(bookings, eq(bookings.status, 'no_show')),
    getSum(bookings, bookings.total),
    getSum(payments, payments.amount, eq(payments.paymentType, 'deposit')),
    getTodayRevenue(today),
  ]);

  // Get bookings by service
  const bookingsByService = await getBookingsByService();

  // Get peak hours
  const peakHours = await getPeakHours();

  // Calculate repeat customers (simplified)
  const repeatCustomers = await getRepeatCustomerCount();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Business metrics and insights</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Customers" value={totalCustomers} icon="users" />
        <MetricCard label="Total Bookings" value={totalBookings} icon="calendar" />
        <MetricCard label="Revenue (All Time)" value={totalRevenue} currency />
        <MetricCard label="Deposits Recorded" value={totalDeposits} currency />
      </div>

      {/* Booking Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Booking Status</h2>
          <div className="space-y-4">
            <StatusBar label="Pending" count={pendingCount} color="amber" total={totalBookings} />
            <StatusBar label="Confirmed" count={confirmedCount} color="green" total={totalBookings} />
            <StatusBar label="Completed" count={completedCount} color="blue" total={totalBookings} />
            <StatusBar label="Cancelled" count={cancelledCount} color="red" total={totalBookings} />
            <StatusBar label="Rejected" count={rejectedCount} color="gray" total={totalBookings} />
            <StatusBar label="No Show" count={noShowCount} color="purple" total={totalBookings} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Today's Performance</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Today's Revenue</span>
              <span className="font-medium">₦{(todayRevenue / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Repeat Customers (All Time)</span>
              <span className="font-medium">{repeatCustomers}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Service Popularity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Most Popular Services</h2>
        <div className="space-y-4">
          {bookingsByService.length === 0 ? (
            <p className="text-gray-500">No service data available</p>
          ) : (
            bookingsByService.map((service: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-sm text-gray-500">{index + 1}.</span>
                  <span className="font-medium">{service.serviceName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-burgundy h-2 rounded-full" 
                      style={{ width: `${Math.min((service.percentage) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-16 text-right">
                    {service.count} bookings ({service.percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Peak Hours */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Peak Hours</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {peakHours.map((hour: any, index: number) => (
            <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-burgundy">{hour.time}</p>
              <p className="text-sm text-gray-600">{hour.count} bookings</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, currency }: { label: string; value: number; icon?: string; currency?: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`text-2xl font-bold text-gray-900 ${currency ? 'text-burgundy' : ''}`}>
            {currency ? `₦${(value / 100).toFixed(0)}` : value}
          </p>
        </div>
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          {icon === 'users' && (
            <svg className="w-6 h-6 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
          {icon === 'calendar' && (
            <svg className="w-6 h-6 text-burgundy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[color] }} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-medium">{count} ({percentage.toFixed(0)}%)</span>
    </div>
  );
}

async function getCount(table: any, condition?: any): Promise<number> {
  try {
    if (condition) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(table).where(condition);
      return result[0]?.count || 0;
    }
    const result = await db.select({ count: sql<number>`count(*)` }).from(table);
    return result[0]?.count || 0;
  } catch {
    return 0;
  }
}

async function getSum(table: any, column: any, condition?: any): Promise<number> {
  try {
    if (condition) {
      const result = await db.select({ sum: sql<number>`coalesce(sum(${column}), 0)` }).from(table).where(condition);
      return result[0]?.sum || 0;
    }
    const result = await db.select({ sum: sql<number>`coalesce(sum(${column}), 0)` }).from(table);
    return result[0]?.sum || 0;
  } catch {
    return 0;
  }
}

async function getTodayRevenue(date: string): Promise<number> {
  try {
    const todayBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.appointmentDate, date),
        eq(bookings.status, 'confirmed')
      ),
    });
    return todayBookings.reduce((sum, b) => sum + (b.total || 0), 0);
  } catch {
    return 0;
  }
}

async function getBookingsByService() {
  try {
    const results = await db.select({
      serviceId: bookings.customerId,
      count: sql<number>`count(*)`,
    }).from(bookings)
      .groupBy(bookings.customerId)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    const serviceCounts = await Promise.all(results.map(async (r: any) => {
      const service = await db.query.services.findFirst({
        where: eq(services.id, r.serviceId),
      });
      return {
        serviceId: r.serviceId,
        serviceName: service?.name || 'Unknown',
        count: r.count,
      };
    }));

    const total = serviceCounts.reduce((sum: number, s: any) => sum + s.count, 0);

    return serviceCounts.map(s => ({
      ...s,
      percentage: total > 0 ? s.count / total : 0,
    }));
  } catch {
    return [];
  }
}

async function getPeakHours() {
  try {
    const bookingsList = await db.query.bookings.findMany({
      where: eq(bookings.status, 'confirmed'),
    });

    const hourCounts: Record<string, number> = {};
    for (const booking of bookingsList) {
      const hour = booking.startTime.split(':')[0];
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    return Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([time, count]) => ({ time: `${time}:00`, count }));
  } catch {
    return [];
  }
}

async function getRepeatCustomerCount(): Promise<number> {
  try {
    const customers = await db.query.users.findMany();
    let repeatCount = 0;

    for (const customer of customers) {
      const userBookings = await db.query.bookings.findMany({
        where: eq(bookings.customerId, customer.id),
        with: {
          // This won't work with the current schema - simplified
        },
      });

      if (userBookings.length > 1) {
        repeatCount++;
      }
    }

    return repeatCount;
  } catch {
    return 0;
  }
}
