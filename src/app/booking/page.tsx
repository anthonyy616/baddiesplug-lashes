import Link from 'next/link';
import { Suspense } from 'react';
import BookingFlow from './BookingFlow';
import { ThemeToggle } from '@/components/ThemeProvider';

export default function BookingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-line dark:border-line-dark">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-burgundy dark:text-burgundy-lifted">
            The Baddies Plug
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/account" className="text-sm text-ink-secondary dark:text-ink-dark-secondary hover:text-burgundy dark:hover:text-burgundy-lifted transition-colors">
              My Account
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">
        <Suspense fallback={<div className="text-center py-12 text-ink-secondary">Loading booking form...</div>}>
          <BookingFlow />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="py-8 mt-12 text-center text-sm text-ink-secondary dark:text-ink-dark-secondary">
        <p>&copy; {new Date().getFullYear()} The Baddies Plug. All rights reserved.</p>
      </footer>
    </div>
  );
}
