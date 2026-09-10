import Link from 'next/link';

export const metadata = {
  title: 'Contact | The Baddies Plug',
  description: 'Get in touch with The Baddies Plug',
};

export default function ContactPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || '';

  return (
    <div className="min-h-screen bg-white dark:bg-black pt-16">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Contact Us</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-10">
          Questions about bookings, services, or policies? We&apos;d love to hear from you.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-800"
          >
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">WhatsApp</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fastest way to reach us — booking questions, payment, and appointment changes.
            </p>
            <span className="inline-block mt-4 text-burgundy font-medium">Open WhatsApp →</span>
          </a>

          <div className="p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Hours</h2>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>Tuesday – Friday</li>
              <li>9:00 AM – 6:00 PM (WAT)</li>
              <li>Monday, Saturday &amp; Sunday: Closed</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 p-6 bg-burgundy/5 rounded-xl border border-burgundy/10">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Ready to book?</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Appointments are managed entirely online — pick your services and a time that suits you.
          </p>
          <Link
            href="/booking"
            className="inline-block bg-burgundy text-white px-6 py-3 rounded-lg font-semibold hover:bg-burgundy/90 transition-colors"
          >
            Book an Appointment
          </Link>
        </div>
      </main>
    </div>
  );
}
