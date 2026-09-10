'use client';

import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'selectedService';

interface BookNowButtonProps {
  slug: string;
  serviceId: string;
  serviceName: string;
  price: number; // kobo
}

export default function BookNowButton({ slug, serviceId, serviceName, price }: BookNowButtonProps) {
  const router = useRouter();

  const handleBook = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          slug,
          serviceId,
          serviceName,
          price,
          selectedAt: Date.now(),
        })
      );
    } catch {
      // Storage unavailable — navigate anyway; the booking flow will
      // gracefully show the full service list if the key is missing.
    }
    router.push('/booking');
  };

  return (
    <button
      type="button"
      onClick={handleBook}
      className="inline-block mt-8 bg-burgundy text-white px-8 py-4 rounded-lg font-semibold hover:bg-burgundy/90 transition-colors"
    >
      Book Now
    </button>
  );
}
