import Link from 'next/link';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') || '';

/**
 * Customer rescheduling awareness (Stage 1).
 *
 * Customers CANNOT change their appointment date/time themselves — only the
 * admin can reschedule an appointment, at the customer's request. This block
 * states the policy plainly and offers the WhatsApp contact path. It must
 * never contain reschedule controls.
 */
export default function ReschedulePolicy({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      <h3 className={`font-semibold text-gray-900 dark:text-white ${compact ? 'text-sm' : 'text-base'}`}>
        Need to change your appointment?
      </h3>
      <div className={`text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2 space-y-1`}>
        <p>
          Appointments can be rescheduled by contacting us on{' '}
          {WHATSAPP_NUMBER ? (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              className="text-burgundy hover:text-burgundy/80 font-medium"
            >
              WhatsApp
            </a>
          ) : (
            'WhatsApp'
          )}
          . Please include your booking reference and the date/time you would like.
        </p>
        <p>
          You cannot change the date or time yourself — our team will make the change for
          you and you will receive a confirmation email once your appointment has been
          moved.
        </p>
      </div>
      <Link
        href="/policies#rescheduling"
        className="inline-block mt-3 text-xs text-gray-500 dark:text-gray-400 underline hover:text-burgundy"
      >
        Read the full rescheduling policy
      </Link>
    </div>
  );
}
