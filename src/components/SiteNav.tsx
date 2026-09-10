import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeProvider';

const links = [
  { href: '/services', label: 'Services' },
  { href: '/contact', label: 'Contact' },
  { href: '/policies', label: 'Policies' },
];

/**
 * Shared site navigation with dark-mode toggle, used on the homepage,
 * services, contact, policies, and account pages (the booking page keeps its
 * own compact header). Server component; ThemeToggle is a client island.
 */
export default function SiteNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold text-burgundy dark:text-burgundy-lifted">
            The Baddies Plug
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 dark:text-gray-300 hover:text-burgundy dark:hover:text-burgundy-lifted transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/booking"
              className="bg-burgundy text-white px-4 py-2 rounded-md hover:bg-burgundy/90 transition-colors"
            >
              Book Now
            </Link>
            <ThemeToggle />
          </div>

          {/* Mobile: brand, toggle, book CTA (links stay in the footer) */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <Link
              href="/booking"
              className="bg-burgundy text-white px-3 py-2 rounded-md text-sm hover:bg-burgundy/90 transition-colors"
            >
              Book Now
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
