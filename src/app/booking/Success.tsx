'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface SuccessProps {
  reference: string;
}

export default function Success({ reference }: SuccessProps) {
  useEffect(() => {
    // Clear any stored booking intent
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bookingIntent');
    }
  }, []);

  return (
    <div className="text-center py-12">
      {/* Success Icon */}
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Created!</h1>
      <p className="text-gray-600 mb-6">Your booking has been submitted for approval.</p>

      {/* Booking Reference */}
      <div className="bg-gray-50 rounded-lg p-6 inline-block border border-gray-200 mb-6">
        <p className="text-sm text-gray-600">Booking Reference</p>
        <p className="text-2xl font-bold text-burgundy font-mono mt-1">{reference}</p>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 max-w-md mx-auto text-left">
        <h3 className="font-semibold text-amber-800 mb-2">What happens next?</h3>
        <ul className="text-sm text-amber-800 space-y-2">
          <li>• We'll review your booking and approve it shortly</li>
          <li>• You'll receive a confirmation email once approved</li>
          <li>• A WhatsApp message with payment details will be sent</li>
          <li>• Please complete the deposit before your appointment</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/account"
          className="px-6 py-3 bg-burgundy text-white font-medium rounded-lg hover:bg-burgundy/90 transition-colors"
        >
          View My Bookings
        </Link>
        <Link
          href="/services"
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Book Another Appointment
        </Link>
      </div>

      <p className="text-sm text-gray-500 mt-8">
        Need help? Contact us at{' '}
        <a href={`https://wa.me/${process.env.WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || ''}`} className="text-burgundy hover:underline">
          WhatsApp
        </a>
      </p>
    </div>
  );
}
