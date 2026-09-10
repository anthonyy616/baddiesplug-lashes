import { inngest } from '../client';
import { db } from '@/lib/db';
import { referenceImages } from '@/lib/db/schema';
import { eq, lte } from 'drizzle-orm';

/**
 * Inngest function for cleaning up expired reference images.
 *
 * R2 delete and DB delete are separate step.run() calls so a failure
 * in one doesn't silently lose the retry opportunity for the other.
 */

export const cleanupExpiredImagesFn = inngest.fn('cleanup-expired-images', async (args: any) => {
  const step = args.step;

  const expired = await step.run('fetch-expired-images', async () => {
    return await db.query.referenceImages.findMany({
      where: lte(referenceImages.expiresAt, new Date()),
      limit: 100,
    });
  });

  if (expired.length === 0) {
    return { deleted: 0 };
  }

  let deleted = 0;

  for (const image of expired) {
    // Step 1: Delete from R2 storage
    const r2Result = await step.run(`delete-r2-${image.id}`, async () => {
      const { deleteFromR2 } = await import('@/lib/storage');
      return deleteFromR2(image.storageKey);
    });

    if (r2Result.success) {
      // Step 2: Delete from database (only if R2 delete succeeded)
      await step.run(`delete-db-${image.id}`, async () => {
        await db.delete(referenceImages).where(eq(referenceImages.id, image.id));
      });
      deleted++;
    }
  }

  return { deleted, totalFound: expired.length };
});
