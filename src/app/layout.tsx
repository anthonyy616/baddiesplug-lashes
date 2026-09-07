import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
