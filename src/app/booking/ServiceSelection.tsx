'use client';

import { useState } from 'react';

interface ServiceSelectionProps {
  services: any[];
  addons: any[];
  selectedServices: any[];
  selectedAddons: any[];
  onServiceSelect: (service: any) => void;
  onAddonSelect: (addon: any) => void;
  onContinue: () => void;
  isLoading: boolean;
  loadingMessage: string;
}

export default function ServiceSelection({
  services,
  addons,
  selectedServices,
  selectedAddons,
  onServiceSelect,
  onAddonSelect,
  onContinue,
  isLoading,
  loadingMessage,
}: ServiceSelectionProps) {
  const [activeTab, setActiveTab] = useState<'lashes' | 'brows'>('lashes');

  const lashServices = services.filter(s => s.category === 'lash');
  const browServices = services.filter(s => s.category === 'eyebrow');

  const selectedServiceIds = selectedServices.map(s => s.id);
  const selectedAddonIds = selectedAddons.map(a => a.id);

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0) + 
                    selectedAddons.reduce((sum, a) => sum + a.price, 0);

  const formatPrice = (priceInKobo: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(priceInKobo / 100);
  };

  return (
    <div className="space-y-6">
      {/* Services */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Services</h3>
        
        {/* Category Tabs */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setActiveTab('lashes')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'lashes' ? 'bg-burgundy text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Lashes
          </button>
          <button
            onClick={() => setActiveTab('brows')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'brows' ? 'bg-burgundy text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Brows
          </button>
        </div>

        {/* Service Cards */}
        <div className="grid gap-4">
          {(activeTab === 'lashes' ? lashServices : browServices).map((service) => {
            const isSelected = selectedServiceIds.includes(service.id);
            return (
              <button
                key={service.id}
                onClick={() => onServiceSelect(service)}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? 'border-burgundy bg-burgundy/5' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{service.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                    <p className="text-xs text-gray-500 mt-2">{service.notes}</p>
                    <p className="text-sm text-gray-500 mt-2">{service.durationMinutes} min</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-burgundy">{formatPrice(service.price)}</p>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-2 ${
                      isSelected ? 'bg-burgundy border-burgundy' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedServices.length === 0 && (
          <p className="text-sm text-amber-600 mt-2">Please select at least one service to continue</p>
        )}
      </div>

      {/* Add-ons */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add-ons (Optional)</h3>

        <div className="grid gap-3">
          {addons.map((addon) => {
            const isSelected = selectedAddonIds.includes(addon.id);
            return (
              <button
                key={addon.id}
                onClick={() => onAddonSelect(addon)}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? 'border-burgundy bg-burgundy/5' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{addon.name}</h4>
                    <p className="text-sm text-gray-600">{addon.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-burgundy">{formatPrice(addon.price)}</p>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-2 ${
                      isSelected ? 'bg-burgundy border-burgundy' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Summary */}
      {selectedServices.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2">Selected Services:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {selectedServices.map(s => (
              <li key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="font-medium">{formatPrice(s.price)}</span>
              </li>
            ))}
          </ul>
          {selectedAddons.length > 0 && (
            <>
              <h4 className="font-medium text-gray-900 mt-2 mb-1">Selected Add-ons:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {selectedAddons.map(a => (
                  <li key={a.id} className="flex justify-between">
                    <span>{a.name}</span>
                    <span className="font-medium">{formatPrice(a.price)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="border-t mt-3 pt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-burgundy">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      )}

      {/* Continue Button */}
      <button
        onClick={onContinue}
        disabled={selectedServices.length === 0 || isLoading}
        className="w-full mt-6 px-6 py-3 bg-burgundy text-white font-semibold rounded-lg hover:bg-burgundy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? loadingMessage : 'Continue to Date Selection'}
      </button>
    </div>
  );
}
