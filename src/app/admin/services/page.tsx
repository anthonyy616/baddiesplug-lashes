import { db } from '@/lib/db';
import { services } from '@/lib/db/schema';
import { asc, isNull } from 'drizzle-orm';
import ServicesManager from './ServicesManager';

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const all = await db.query.services.findMany({
    where: isNull(services.deletedAt),
    orderBy: [asc(services.category), asc(services.displayOrder)],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Services</h1>
        <p className="text-gray-600">Manage your service catalog</p>
      </div>

      <ServicesManager
        initialServices={all.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          price: s.price,
          durationMinutes: s.durationMinutes,
          isActive: s.isActive,
          displayOrder: s.displayOrder,
        }))}
      />
    </div>
  );
}
