import Link from 'next/link';
import { Suspense } from 'react';
import BookingFlow from './BookingFlow';

export default function BookingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-burgundy">
              The Baddies Plug
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/services" className="text-gray-600 hover:text-burgundy">Services</Link>
              <Link href="/contact" className="text-gray-600 hover:text-burgundy">Contact</Link>
              <Link href="/account" className="text-gray-600 hover:text-burgundy">My Account</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Book an Appointment</h1>
          <p className="text-gray-600 mt-2">Select your services and choose a convenient time</p>
        </div>

        <Suspense fallback={<div className="text-center py-12">Loading booking form...</div>}>
          <BookingFlow />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} The Baddies Plug. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
