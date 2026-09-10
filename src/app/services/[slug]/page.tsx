import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceBySlugWithImages } from '@/lib/pricing';
import ServiceGallery from './ServiceGallery';
import BookNowButton from '@/components/BookNowButton';
import SiteNav from '@/components/SiteNav';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}
export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const service = await getServiceBySlugWithImages(slug);

  if (!service || !service.isActive) {
    notFound();
  }

  const formatPrice = (kobo: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(kobo / 100);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <SiteNav />
      <div className="pt-16">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/services"
          className="inline-block mb-6 text-burgundy hover:text-burgundy/80"
        >
          ← All Services
        </Link>

        <div className="grid lg:grid-cols-2 gap-10">
          <ServiceGallery images={service.images} serviceName={service.name} />

          <div>
            <span className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {service.category === 'lash' ? 'Lash Services' : 'Eyebrow Services'}
            </span>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mt-2">
              {service.name}
            </h1>
            <p className="text-3xl font-bold text-burgundy mt-4">
              {formatPrice(service.price)}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-6 leading-relaxed">
              {service.description}
            </p>

            {service.notes && (
              <div className="mt-8 bg-gray-50 dark:bg-gray-900 rounded-lg p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Details & Specifications
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {service.notes}
                </p>
              </div>
            )}

            <BookNowButton
              slug={service.slug}
              serviceId={service.id}
              serviceName={service.name}
              price={service.price}
            />
          </div>
        </div>
        </main>
      </div>
    </div>
  );
}

