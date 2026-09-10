import { db } from '@/lib/db';
import { addons } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import AddonsManager from './AddonsManager';

export const dynamic = 'force-dynamic';

export default async function AdminAddonsPage() {
  const all = await db.query.addons.findMany({
    orderBy: [asc(addons.displayOrder)],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Add-ons</h1>
        <p className="text-gray-600">Extras that modify price only — never duration</p>
      </div>

      <AddonsManager
        initialAddons={all.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          price: a.price,
          isActive: a.isActive,
          displayOrder: a.displayOrder,
        }))}
      />
    </div>
  );
}
