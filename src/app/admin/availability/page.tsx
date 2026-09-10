import { db } from '@/lib/db';
import { availabilityOverrides } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentLagosDate } from '@/lib/timezone';
import AvailabilityManager from './AvailabilityManager';

export const dynamic = 'force-dynamic';

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || getCurrentLagosDate();

  const overrides = await db.query.availabilityOverrides.findMany({
    where: eq(availabilityOverrides.date, date),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Availability</h1>
        <p className="text-gray-600">Open or block individual slots per day</p>
      </div>

      <AvailabilityManager
        date={date}
        overrides={overrides.map((o) => ({
          id: o.id,
          date: o.date,
          startTime: o.startTime,
          endTime: o.endTime,
          mode: o.mode,
          reason: o.reason,
        }))}
      />
    </div>
  );
}
