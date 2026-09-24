import Link from 'next/link';
import { db } from '@/lib/db';
import { services, serviceImages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import SiteNav from '@/components/SiteNav';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Services | The Baddies Plug',
  description: 'Browse our luxury lash and eyebrow services',
};

export default async function ServicesPage() {
  const activeServices = await db.query.services.findMany({
    where: and(eq(services.isActive, true)),
    orderBy: (s) => [s.category, s.displayOrder],
  });

  const lashServices = activeServices.filter((s) => s.category === 'lash');
  const browServices = activeServices.filter((s) => s.category === 'eyebrow');

  const formatPrice = (kobo: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(kobo / 100);

  const renderServices = (list: typeof activeServices) => (
    <>
      {list.length === 0 ? (
        <p className="text-gray-500">Services coming soon.</p>
      ) : (
        list.map((service) => (
          <Link
            key={service.id}
            href={`/services/${service.slug}`}
            className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
          >
            <ServiceCover serviceId={service.id} />
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-burgundy transition-colors">
                {service.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {service.description}
              </p>
              <p className="text-burgundy font-bold mt-3">{formatPrice(service.price)}</p>
            </div>
          </Link>
        ))
      )}
    </>
  );

  const renderCategory = (title: string, list: typeof activeServices) => (
    <section className="mb-12">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderServices(list.filter((service) => !service.subcategory))}
      </div>
      {list.some((service) => service.subcategory === 'refills') && (
        <div className="mt-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Refills</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 max-w-3xl">
            Refills are recommended every 2 weeks to maintain the fullness and appearance of your set. Refill pricing applies to existing Baddies Plug sets that are suitable for a refill. If too much of the original set has shed, a new full set may be required.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderServices(list.filter((service) => service.subcategory === 'refills'))}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <SiteNav />
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Our Services</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Premium lash extensions and eyebrow artistry
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {renderCategory('Lash Services', lashServices)}
        {renderCategory('Eyebrow Services', browServices)}

        <div className="text-center py-8">
          <Link
            href="/booking"
            className="inline-block bg-burgundy text-white px-8 py-4 rounded-lg font-semibold hover:bg-burgundy/90 transition-colors"
          >
            Book an Appointment
          </Link>
        </div>
      </main>
    </div>
  );
}

async function ServiceCover({ serviceId }: { serviceId: string }) {
  const image = await db.query.serviceImages.findFirst({
    where: eq(serviceImages.serviceId, serviceId),
    orderBy: (img) => [img.displayOrder],
  });

  if (!image) {
    return (
      <div className="aspect-[4/3] bg-burgundy/10 flex items-center justify-center">
        <span className="text-burgundy text-4xl font-bold">✦</span>
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.publicUrl}
        alt={image.altText || 'Service image'}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    </div>
  );
}
