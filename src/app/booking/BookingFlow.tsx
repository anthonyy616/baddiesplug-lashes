'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StepIndicator from '@/components/booking/StepIndicator';
import StickySummaryBar, { SummaryItem } from '@/components/booking/StickySummaryBar';
import ServiceCards, { SelectableService } from '@/components/booking/ServiceCards';
import AddonCards, { SelectableAddon } from '@/components/booking/AddonCards';
import DateTimePicker, { SlotInfo } from '@/components/booking/DateTimePicker';
import DetailsStep from '@/components/booking/DetailsStep';
import ReviewStep from '@/components/booking/ReviewStep';
import Success from './Success';

const STEPS = ['services', 'addons', 'datetime', 'details', 'review'] as const;
type Step = (typeof STEPS)[number];

interface SelectedService extends SelectableService {}
interface SelectedAddon extends SelectableAddon {}

interface BookingIntent {
  serviceIds: string[];
  addonIds: string[];
  date: string | null;
  slot: { startTime: string; endTime: string } | null;
  phone: string;
  notes: string;
  step: number;
}

const INTENT_KEY = 'bookingIntent';

export default function BookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stepIndex, setStepIndex] = useState(0);
  const [services, setServices] = useState<SelectableService[]>([]);
  const [addons, setAddons] = useState<SelectableAddon[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<{ id: string; filename: string }[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{ reference: string; whatsappUrl?: string } | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; phone?: string | null } | null>(null);
  const restoredRef = useRef(false);

  // Load catalog
  useEffect(() => {
    const load = async () => {
      try {
        const [serviceRes, addonRes] = await Promise.all([
          fetch('/api/services'),
          fetch('/api/addons'),
        ]);
        const serviceData = await serviceRes.json();
        const addonData = await addonRes.json();
        setServices(serviceData.services || []);
        setAddons(addonData.addons || []);
      } catch {
        // Leave empty; empty states handle this
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Auth status
  useEffect(() => {
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        setIsAuthenticated(!!data.user);
        if (data.user) {
          setUser(data.user);
          if (data.user.phone && !phone) setPhone(data.user.phone);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore booking intent (survives the sign-in round trip)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    try {
      const raw = localStorage.getItem(INTENT_KEY);
      if (!raw) return;
      const intent = JSON.parse(raw) as BookingIntent & { _savedAt?: number };

      // Expire stale intents (2 hours)
      if (intent._savedAt && Date.now() - intent._savedAt > 2 * 60 * 60 * 1000) {
        localStorage.removeItem(INTENT_KEY);
        return;
      }

      // Defer catalog-matching until services/addons load
      const applyIntent = () => {
        if (intent.serviceIds?.length && services.length > 0) {
          const picked = services.filter((s) => intent.serviceIds.includes(s.id));
          if (picked.length > 0) setSelectedServices(picked);
        }
        if (intent.addonIds?.length && addons.length > 0) {
          const picked = addons.filter((a) => intent.addonIds.includes(a.id));
          if (picked.length > 0) setSelectedAddons(picked);
        }
        if (intent.date) setSelectedDate(intent.date);
        if (intent.slot) setSelectedSlot(intent.slot as SlotInfo);
        if (intent.phone) setPhone(intent.phone);
        if (intent.notes) setNotes(intent.notes);
        if (typeof intent.step === 'number') {
          setStepIndex(Math.min(intent.step, STEPS.length - 1));
        }
      };
      applyIntent();
    } catch {
      // Corrupt intent — ignore
    }
  }, [services, addons]);

  // Persist intent on every change
  useEffect(() => {
    const intent: BookingIntent & { _savedAt: number } = {
      serviceIds: selectedServices.map((s) => s.id),
      addonIds: selectedAddons.map((a) => a.id),
      date: selectedDate,
      slot: selectedSlot ? { startTime: selectedSlot.startTime, endTime: selectedSlot.endTime } : null,
      phone,
      notes,
      step: stepIndex,
      _savedAt: Date.now(),
    };
    try {
      localStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    } catch {
      // Storage full/blocked — non-fatal
    }
  }, [selectedServices, selectedAddons, selectedDate, selectedSlot, phone, notes, stepIndex]);

  const handleSignOutReturn = useCallback(() => {
    // After sign-in completes, we land back on /booking?restored=1; intent restores automatically
  }, []);

  // Catalog toggles
  const toggleService = (service: SelectableService) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  };

  const toggleAddon = (addon: SelectableAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  // Pricing — deposit rule matches lib/pricing (50% or ₦5,000 minimum, in kobo)
  const subtotal = useMemo(
    () =>
      selectedServices.reduce((sum, s) => sum + s.price, 0) +
      selectedAddons.reduce((sum, a) => sum + a.price, 0),
    [selectedServices, selectedAddons]
  );
  const deposit = useMemo(
    () => Math.max(Math.round(subtotal * 0.5), subtotal > 0 ? 500000 : 0),
    [subtotal]
  );

  const summaryItems: SummaryItem[] = useMemo(
    () => [
      ...selectedServices.map((s) => ({ id: s.id, name: s.name, price: s.price, kind: 'service' as const })),
      ...selectedAddons.map((a) => ({ id: a.id, name: a.name, price: a.price, kind: 'addon' as const })),
    ],
    [selectedServices, selectedAddons]
  );

  const canContinue = useMemo(() => {
    switch (STEPS[stepIndex]) {
      case 'services':
        return selectedServices.length > 0;
      case 'addons':
        return true; // optional
      case 'datetime':
        return !!selectedDate && !!selectedSlot;
      case 'details':
        return isAuthenticated && phone.trim().length >= 10;
      case 'review':
        return !isSubmitting;
      default:
        return false;
    }
  }, [stepIndex, selectedServices, selectedDate, selectedSlot, isAuthenticated, phone, isSubmitting]);

  const ctaLabel = stepIndex === STEPS.length - 1 ? 'Confirm Booking' : 'Continue';

  const goToStep = (index: number) => setStepIndex(Math.max(0, Math.min(index, STEPS.length - 1)));

  const handleCta = () => {
    if (STEPS[stepIndex] === 'review') {
      void submitBooking();
    } else {
      goToStep(stepIndex + 1);
    }
  };

  const submitBooking = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedServices.map((s) => s.id),
          addonIds: selectedAddons.map((a) => a.id),
          date: selectedDate,
          startTime: selectedSlot?.startTime,
          endTime: selectedSlot?.endTime,
          phone: phone.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.success && data.reference) {
        setCreatedBookingId(data.bookingId);
        setBookingResult({ reference: data.reference, whatsappUrl: data.whatsappUrl });
        localStorage.removeItem(INTENT_KEY);
      } else {
        const friendly =
          data.error === 'slot_no_longer_available'
            ? 'Sorry, that slot was just booked by someone else. Please pick another time.'
            : data.error === 'too_soon'
              ? 'Same-day appointments need to start at least 1 hour from now.'
              : data.error === 'outside_booking_window'
                ? 'Bookings can be made up to 1 month ahead.'
                : data.error;
        setError(friendly || 'Failed to create booking. Please try again.');
        if (data.error === 'slot_no_longer_available' || data.error === 'too_soon') {
          goToStep(2); // back to date & time
        }
      }
    } catch {
      setError('Failed to create booking. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = () => {
    // Intent is already persisted; sign-in returns to /booking via callbackUrl
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/booking')}`);
  };

  // Success screen replaces the entire flow
  if (bookingResult) {
    return (
      <Success
        reference={bookingResult.reference}
        whatsappUrl={bookingResult.whatsappUrl}
        bookingId={createdBookingId}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl border border-line dark:border-line-dark p-4 sm:p-6">
      <StepIndicator
        currentStep={stepIndex}
        onStepClick={goToStep}
        onClose={() => router.push('/')}
      />

      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="min-h-[320px] mb-8">
        {isLoading ? (
          <div className="space-y-3" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {STEPS[stepIndex] === 'services' && (
              <section aria-label="Select your services">
                <h2 className="font-display text-2xl text-ink dark:text-ink-dark mb-6">
                  Select your services
                </h2>
                <ServiceCards
                  services={services}
                  selectedIds={new Set(selectedServices.map((s) => s.id))}
                  onToggle={toggleService}
                />
              </section>
            )}

            {STEPS[stepIndex] === 'addons' && (
              <section aria-label="Select add-ons">
                <h2 className="font-display text-2xl text-ink dark:text-ink-dark mb-6">
                  Add-ons <span className="text-sm font-sans text-ink-secondary dark:text-ink-dark-secondary">(optional)</span>
                </h2>
                <AddonCards
                  addons={addons}
                  selectedIds={new Set(selectedAddons.map((a) => a.id))}
                  onToggle={toggleAddon}
                />
              </section>
            )}

            {STEPS[stepIndex] === 'datetime' && (
              <section aria-label="Choose date and time">
                <h2 className="font-display text-2xl text-ink dark:text-ink-dark mb-6">
                  Choose a date &amp; time
                </h2>
                <DateTimePicker
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  onSelectDate={(d) => {
                    setSelectedDate(d);
                    setSelectedSlot(null);
                  }}
                  onSelectSlot={setSelectedSlot}
                />
              </section>
            )}

            {STEPS[stepIndex] === 'details' && (
              <section aria-label="Your details">
                <h2 className="font-display text-2xl text-ink dark:text-ink-dark mb-6">Your details</h2>
                <DetailsStep
                  isAuthenticated={isAuthenticated}
                  user={user}
                  phone={phone}
                  notes={notes}
                  photos={photos}
                  onPhoneChange={setPhone}
                  onNotesChange={setNotes}
                  onPhotoUploaded={(p) => setPhotos((prev) => [...prev, p])}
                  onPhotoRemoved={(id) => setPhotos((prev) => prev.filter((p) => p.id !== id))}
                  onSignIn={handleSignIn}
                  uploadBookingId={null}
                />
              </section>
            )}

            {STEPS[stepIndex] === 'review' && (
              <section aria-label="Review your booking">
                <h2 className="font-display text-2xl text-ink dark:text-ink-dark mb-6">Review your booking</h2>
                <ReviewStep
                  items={summaryItems}
                  date={selectedDate}
                  slot={selectedSlot}
                  subtotal={subtotal}
                  deposit={deposit}
                  phone={phone}
                  notes={notes}
                  photoCount={photos.length}
                />
              </section>
            )}
          </>
        )}
      </div>

      {/* Back link for steps after the first */}
      {stepIndex > 0 && (
        <button
          type="button"
          onClick={() => goToStep(stepIndex - 1)}
          className="mb-4 text-sm text-ink-secondary dark:text-ink-dark-secondary hover:text-ink dark:hover:text-ink-dark transition-colors"
        >
          ← Back
        </button>
      )}

      <StickySummaryBar
        items={summaryItems}
        date={selectedDate}
        slot={selectedSlot}
        subtotal={subtotal}
        deposit={deposit}
        ctaLabel={ctaLabel}
        ctaDisabled={!canContinue}
        onCta={handleCta}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
