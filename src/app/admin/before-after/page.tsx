import { requireAdminSession } from '@/lib/admin-auth';
import BeforeAfterManager from './BeforeAfterManager';
import { getBeforeAfterAdminOptions, getBeforeAfterEntries } from '@/lib/before-after';

export const dynamic = 'force-dynamic';

export default async function AdminBeforeAfterPage() {
  await requireAdminSession();
  const [entries, options] = await Promise.all([
    getBeforeAfterEntries(),
    getBeforeAfterAdminOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Before &amp; After</h1>
        <p className="text-gray-600 mt-1">
          Client results gallery. Entries are <strong>never public just because they were
          uploaded</strong> — publish only with recorded client consent.
        </p>
      </div>
      <BeforeAfterManager initialEntries={entries} {...options} />
    </div>
  );
}
