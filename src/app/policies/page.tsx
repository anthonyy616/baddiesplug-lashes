import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

export const metadata = {
  title: 'Policies | The Baddies Plug',
  description: 'Cancellation, deposit, terms, and privacy policies',
};

const policies = [
  {
    id: 'cancellation',
    title: 'Cancellation Policy',
    body: [
      'Appointments can be cancelled up to 1 hour before the scheduled start time directly from your account page.',
      'Cancellations made within 1 hour of the appointment may not be eligible for a deposit refund.',
      'To discuss refunds, please contact us via WhatsApp after cancelling — refunds are handled manually.',
      'Repeated no-shows or late cancellations may require prepayment for future bookings.',
    ],
  },
  {
    id: 'deposit',
    title: 'Deposit Policy',
    body: [
      'A deposit is required to secure every appointment. The required deposit is shown before you confirm your booking.',
      'Deposits are paid manually via WhatsApp using the link provided after booking.',
      'Your booking is reviewed by our team once your deposit is arranged.',
      'Deposits are credited toward the total price of your services.',
    ],
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    body: [
      'All appointments are scheduled in fixed 2-hour slots, Tuesday through Friday.',
      'Please arrive on time; late arrivals may result in a shortened service.',
      'Prices shown are in Nigerian Naira and may change over time. The price shown at booking is the price you pay.',
      'We reserve the right to decline or reschedule bookings when necessary.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    body: [
      'We collect only the information needed to manage your appointments: your name, email, phone number, and booking details.',
      'Reference photos you attach are private, visible only to you and our team, and are automatically deleted after 1 month.',
      'We never sell your personal information.',
      'You may request account deletion at any time by contacting us.',
    ],
  },
];

export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Policies</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-10">
          The fine print, in plain language.
        </p>

        <div className="space-y-8">
          {policies.map((policy) => (
            <section
              key={policy.id}
              id={policy.id}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {policy.title}
              </h2>
              <ul className="space-y-2">
                {policy.body.map((paragraph, i) => (
                  <li key={i} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {paragraph}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
