'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ServiceSelection from './ServiceSelection';
import DateSelection from './DateSelection';
import SlotSelection from './SlotSelection';
import Checkout from './Checkout';
import Success from './Success';
import { getActiveServices, getActiveAddons } from '@/lib/pricing';

type Step = 'services' | 'date' | 'slot' | 'checkout' | 'success';

interface SelectedService {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface SelectedAddon {
  id: string;
  name: string;
  price: number;
}

export default function BookingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('services');
  const [services, setServices] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<{ date: string; startTime: string; endTime: string; available: boolean }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [bookingResult, setBookingResult] = useState<{ reference: string; whatsappUrl?: string } | null>(null);
  
  // Get auth status
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; phone?: string } | null>(null);

  useEffect(() => {
    // Check auth status
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        setIsAuthenticated(!!data.user);
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Load services and addons
    const loadData = async () => {
      try {
        const [serviceRes, addonRes] = await Promise.all([
          fetch('/api/services'),
          fetch('/api/addons'),
        ]);
        const serviceData = await serviceRes.json();
        const addonData = await addonRes.json();
        setServices(serviceData.services || []);
        setAddons(addonData.addons || []);
      } catch (error) {
        console.error('Failed to load services:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    // If date is selected, load available slots
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const loadAvailableSlots = async (date: string) => {
    setIsLoading(true);
    setLoadingMessage('Loading available slots...');
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      const data = await res.json();
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error('Failed to load slots:', error);
      setAvailableSlots([]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleServiceSelect = (service: any) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      }
      return [...prev, { id: service.id, name: service.name, price: service.price, duration: service.durationMinutes }];
    });
  };

  const handleAddonSelect = (addon: any) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      }
      return [...prev, { id: addon.id, name: addon.name, price: addon.price }];
    });
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setStep('slot');
  };

  const handleSlotSelect = (slot: { startTime: string; endTime: string }) => {
    setSelectedSlot(slot);
    setStep('checkout');
  };

  const handleCheckoutSubmit = async (formData: { phone: string; notes?: string }) => {
    if (!isAuthenticated) {
      // Redirect to login
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/booking')}`);
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Creating booking...');

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedServices.map(s => s.id),
          addonIds: selectedAddons.map(a => a.id),
          date: selectedDate,
          startTime: selectedSlot?.startTime,
          endTime: selectedSlot?.endTime,
          phone: formData.phone,
          notes: formData.notes,
        }),
      });

      const data = await res.json();

      if (data.success && data.reference) {
        setBookingResult({ reference: data.reference, whatsappUrl: data.whatsappUrl });
        setStep('success');
      } else {
        const friendly = data.error === 'slot_no_longer_available'
          ? 'Sorry, that slot was just booked by someone else. Please pick another time.'
          : data.error;
        alert(friendly || 'Failed to create booking');
      }
    } catch (error) {
      alert('Failed to create booking');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'date':
        setStep('services');
        break;
      case 'slot':
        setStep('date');
        break;
      case 'checkout':
        setStep('slot');
        break;
      default:
        setStep('services');
    }
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0) + 
                    selectedAddons.reduce((sum, a) => sum + a.price, 0);
  
  const depositRequired = Math.max(Math.round(totalPrice * 0.5), 500000);
  const totalActualSlots = Math.max(...selectedServices.map(s => s.duration), 120);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {['services', 'date', 'slot', 'checkout'].map((s, index) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-burgundy text-white' :
              ['services', 'date', 'slot', 'checkout'].indexOf(step) > index ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {index + 1}
            </div>
            {index < 3 && (
              <div className={`w-16 h-1 mx-2 ${
                ['services', 'date', 'slot', 'checkout'].indexOf(step) > index ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 'services' && (
        <ServiceSelection
          services={services}
          addons={addons}
          selectedServices={selectedServices}
          selectedAddons={selectedAddons}
          onServiceSelect={handleServiceSelect}
          onAddonSelect={handleAddonSelect}
          onContinue={() => setStep('date')}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
        />
      )}

      {step === 'date' && (          <DateSelection
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onDateSelect={handleDateSelect}
          onBack={handleBack}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
        />
      )}

      {step === 'slot' && (
        <SlotSelection
          date={selectedDate || ''}
          slots={availableSlots}
          selectedSlot={selectedSlot}
          onSlotSelect={handleSlotSelect}
          onBack={handleBack}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
        />
      )}

      {step === 'checkout' && (
        <Checkout
          services={selectedServices}
          addons={selectedAddons}
          date={selectedDate || ''}
          slot={selectedSlot}
          totalPrice={totalPrice}
          depositRequired={depositRequired}
          isAuthenticated={isAuthenticated}
          user={user}
          onSubmit={handleCheckoutSubmit}
          onBack={handleBack}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
        />
      )}

      {step === 'success' && (
        <Success
          reference={bookingResult?.reference || ''}
          whatsappUrl={bookingResult?.whatsappUrl}
        />
      )}
    </div>
  );
}
