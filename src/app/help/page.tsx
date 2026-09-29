import Link from 'next/link';

export const metadata = {
  title: 'Admin Help | The Baddies Plug',
  description: 'A practical guide to managing The Baddies Plug admin panel.',
};

const sections = [
  {
    title: 'Start here',
    items: [
      'Use the menu on the left on a computer, or open the menu button at the top on a phone.',
      'The Dashboard gives you a quick view of recent bookings, upcoming appointments, and items that need attention.',
      'Changes are saved as soon as you submit a form. Refresh the page if you want to confirm a change.',
    ],
  },
  {
    title: 'Bookings',
    items: [
      'All Bookings shows every appointment. Use the tabs to view pending, confirmed, approved, completed, cancelled, or no-show bookings.',
      'Open a booking to review the customer details, selected services, appointment time, deposit, and payment proof.',
      'A confirmed booking has been accepted by the system. Approve it after you have checked the customer payment proof.',
      'Use Complete after the appointment is finished. Use No-show only when the customer did not attend, and Cancelled when the appointment is cancelled.',
    ],
  },
  {
    title: 'Payments',
    items: [
      'The Payments page is for recording money received outside the automatic payment flow.',
      'Only approved bookings appear in the booking list. This keeps payment records tied to bookings whose payment proof has been reviewed.',
      'If you cannot find a booking, open it from Bookings and approve its payment first. It will then appear in Payments.',
      'Choose the payment type, enter the amount in naira, add a note if useful, and select Record Payment.',
    ],
  },
  {
    title: 'Services, add-ons, and availability',
    items: [
      'Services controls the treatments customers can book. Update names, descriptions, prices, categories, and whether a service is active or featured.',
      'Add-ons controls optional extras customers can select during booking. Keep inactive add-ons for reference instead of deleting them when possible.',
      'Availability controls the appointment times customers can select. Check this before changing opening hours or adding blocked periods.',
    ],
  },
  {
    title: 'Homepage Media',
    items: [
      'Use Homepage Media to replace the homepage hero and editorial images, and to manage the work gallery.',
      'For each gallery image, choose the service it belongs to. That service name is shown on the homepage and groups the image in the public gallery.',
      'Use captions and alt text to describe an image. Reorder images when you want to change their display order.',
    ],
  },
  {
    title: 'Customers and notifications',
    items: [
      'Customers shows customer profiles and their appointment history. Open a customer to review previous bookings.',
      'Notifications contains system notices for the admin team. Read them after handling the related booking or payment task.',
    ],
  },
  {
    title: 'Analytics and daily routine',
    items: [
      'Analytics summarizes bookings, revenue, service demand, and booking outcomes. Use it for trends rather than as a replacement for checking individual bookings.',
      'A simple daily routine is: check Dashboard, review new payment proofs, approve valid bookings, confirm the day’s availability, and record received payments.',
      'Sign out from the bottom of the navigation when you finish using the admin panel, especially on a shared device.',
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 text-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-burgundy">Admin guide</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">How to use the admin panel</h1>
            <p className="mt-3 max-w-2xl text-gray-600">
              This guide explains the main areas of the panel in everyday language. You do not need technical knowledge to use it.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-burgundy hover:underline">
            Back to admin dashboard →
          </Link>
        </div>

        <div className="mt-8 space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}