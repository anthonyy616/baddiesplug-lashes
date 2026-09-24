import type { Metadata } from 'next';
import { Playfair_Display, Bodoni_Moda } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

// Sentry is initialized separately in sentry configs.
// The @sentry/nextjs package should be installed for production error tracking.
// If not installed, these configs are simply no-ops.

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

// Editorial serif for the v2 homepage redesign only; other pages keep Playfair.
const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
});

// Sentry initialization is handled in sentry.client.config.ts and sentry.server.config.ts
// These files are only loaded when @sentry/nextjs package is installed.
// To enable Sentry, run: npm install @sentry/nextjs

export const metadata: Metadata = {
  title: 'The Baddies Plug | Luxury Lash & Beauty Services',
  description: 'Book your luxury lash and beauty appointments with The Baddies Plug. Professional lash extensions, eyebrow services, and more.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved/OS theme before first paint to avoid a white flash
            on dark-mode reloads. Matches getInitialTheme() in ThemeProvider. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${playfair.variable} ${bodoni.variable}`}>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
