'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, User, X } from 'lucide-react';

const LINKS = [
  { label: 'Services', href: '/services' },
  { label: 'Gallery', href: '/#gallery' },
  { label: 'Policies', href: '/policies' },
  { label: 'Contact', href: '/contact' },
];

/**
 * Luxury navbar (§6-8). Transparent over the hero; gains a translucent dark
 * backdrop + blur + reduced height on scroll. Icon-only account button
 * (customer routes only — no admin entry, §7). Full-screen editorial mobile
 * menu with staggered link reveals (§8).
 */
export default function LuxuryNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { status } = useSession();
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the overlay menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Escape closes the menu (§45 keyboard support).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const accountHref = status === 'authenticated' ? '/account' : '/auth/signin';
  const accountLabel = status === 'authenticated' ? 'My account' : 'Sign in';

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color,height] duration-500 ${
          scrolled
            ? 'bg-[rgba(20,5,10,0.72)] backdrop-blur-md border-b border-white/10'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <nav
          aria-label="Main"
          className={`mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 transition-[height] duration-500 ${
            scrolled ? 'h-14' : 'h-16 md:h-20'
          }`}
        >
          {/* Wordmark */}
          <Link
            href="/"
            className="font-editorial text-lg md:text-xl font-semibold tracking-[0.08em] text-warm-white"
          >
            THE BADDIES&nbsp;PLUG
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans-ui text-xs tracking-[0.25em] uppercase text-warm-white/80 transition-colors hover:text-warm-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Book now — routes through the existing booking flow (§30) */}
            <Link
              href="/booking"
              className="hidden sm:inline-flex min-h-[44px] items-center bg-burgundy px-5 py-2 font-sans-ui text-xs font-semibold tracking-[0.22em] uppercase text-warm-white transition-colors hover:bg-burgundy-lifted"
            >
              Book Now
            </Link>

            {/* Icon-only account button (§7) */}
            <Link
              href={accountHref}
              aria-label="My account"
              className="inline-flex h-11 w-11 items-center justify-center text-warm-white transition-colors hover:text-rose-muted"
            >
              <User size={22} strokeWidth={1.5} aria-hidden="true" />
            </Link>

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="inline-flex h-11 w-11 items-center justify-center text-warm-white md:hidden"
            >
              <Menu size={24} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </nav>
      </header>

      {/* Full-screen mobile menu (§8) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[60] flex flex-col bg-ink-black/[0.985] backdrop-blur-sm md:hidden"
            initial={reduced ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <span className="font-editorial text-lg font-semibold tracking-[0.08em] text-warm-white">
                THE BADDIES&nbsp;PLUG
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="inline-flex h-11 w-11 items-center justify-center text-warm-white"
              >
                <X size={24} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Mobile" className="flex flex-1 flex-col justify-center px-8">
              <ul className="space-y-2">
                {LINKS.map((link, i) => (
                  <li key={link.href} className="overflow-hidden">
                    <motion.div
                      initial={reduced ? { opacity: 0 } : { y: '110%' }}
                      animate={reduced ? { opacity: 1 } : { y: '0%' }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        href={link.href}
                        onClick={closeMenu}
                        className="block py-2 font-editorial text-5xl font-semibold leading-[1.05] text-warm-white transition-colors hover:text-rose-muted"
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="px-8 pb-10">
              <Link
                href="/booking"
                onClick={closeMenu}
                className="flex min-h-[44px] w-full items-center justify-center bg-burgundy px-6 py-3 font-sans-ui text-sm font-semibold tracking-[0.22em] uppercase text-warm-white"
              >
                Book Appointment
              </Link>
              <Link
                href={accountHref}
                onClick={closeMenu}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center border border-white/20 px-6 py-3 font-sans-ui text-sm tracking-[0.22em] uppercase text-warm-white/90"
              >
                {accountLabel}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
