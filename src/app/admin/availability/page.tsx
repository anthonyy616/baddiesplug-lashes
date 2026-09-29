import { db } from '@/lib/db';
import { availabilityOverrides, availabilityRules } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentLagosDate } from '@/lib/timezone';
import AvailabilityManager from './AvailabilityManager';
import RulesManager from './RulesManager';

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

  // Advanced rules (Stage 9) — recurring/date-range layer.
  const rules = await db
    .select()
    .from(availabilityRules)
    .orderBy(desc(availabilityRules.createdAt));

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

      {/* Advanced rules (Stage 9): holidays, vacation, custom days/hours, breaks */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Advanced Rules</h2>
        <p className="text-gray-600 text-sm mb-4">
          Recurring and date-range rules. Precedence: base schedule → rules → per-date overrides → booked slots.
        </p>
        <RulesManager
          initialRules={rules.map((r) => ({
            id: r.id,
            ruleType: r.ruleType,
            dayOfWeek: r.dayOfWeek,
            startDate: r.startDate,
            endDate: r.endDate,
            startTime: r.startTime,
            endTime: r.endTime,
            label: r.label,
            isActive: r.isActive,
          }))}
        />
      </div>
    </div>
  );
}
