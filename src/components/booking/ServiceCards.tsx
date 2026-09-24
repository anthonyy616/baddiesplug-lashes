'use client';

import { useState } from 'react';
import { Clock, Check } from './icons';

export interface SelectableService {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  category: string;
  subcategory?: string | null;
}

const formatPrice = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(kobo / 100);

interface ServiceCardsProps {
  services: SelectableService[];
  selectedIds: Set<string>;
  onToggle: (service: SelectableService) => void;
}

export default function ServiceCards({ services, selectedIds, onToggle }: ServiceCardsProps) {
  const [activeTab, setActiveTab] = useState<'lash' | 'eyebrow'>('lash');

  const filtered = services.filter((s) => s.category === activeTab);

  if (services.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-display text-xl italic text-ink dark:text-ink-dark">Check back soon</p>
        <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mt-2">
          Our service menu is being updated.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-2 mb-6" role="tablist" aria-label="Service categories">
        {(['lash', 'eyebrow'] as const).map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={activeTab === cat}
            onClick={() => setActiveTab(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium uppercase tracking-wide transition-colors ${
              activeTab === cat
                ? 'bg-burgundy text-white'
                : 'border border-line dark:border-line-dark text-burgundy dark:text-burgundy-lifted hover:bg-burgundy/5'
            }`}
          >
            {cat === 'lash' ? 'Lash' : 'Eyebrow'}
          </button>
        ))}
      </div>

      {/* Service cards */}
      <div className="space-y-8" role="tabpanel">
        {filtered.length === 0 ? (
          <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary py-6 text-center">
            No {activeTab === 'lash' ? 'lash' : 'eyebrow'} services available right now.
          </p>
        ) : (
          (['main', 'refills'] as const).map((section) => {
            const sectionServices = filtered.filter((service) =>
              section === 'refills' ? service.subcategory === 'refills' : !service.subcategory
            );

            if (sectionServices.length === 0) return null;

            return (
              <section key={section} aria-labelledby={`${activeTab}-${section}-heading`}>
                {activeTab === 'lash' && section === 'refills' && (
                  <>
                    <h3 id={`${activeTab}-${section}-heading`} className="font-display text-xl text-ink dark:text-ink-dark mb-3">
                      Refills
                    </h3>
                    <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mb-4">
                      Recommended every 2 weeks for existing Baddies Plug sets suitable for a refill.
                    </p>
                  </>
                )}
                <div className="space-y-3">
                  {sectionServices.map((service) => {
            const selected = selectedIds.has(service.id);
            return (
              <button
                key={service.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => onToggle(service)}
                className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                  selected
                    ? 'border-burgundy border-2 bg-burgundy/5 dark:bg-burgundy/10'
                    : 'border-line dark:border-line-dark hover:border-burgundy/40 bg-white dark:bg-surface-dark'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink dark:text-ink-dark">{service.name}</p>
                    <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mt-1 line-clamp-2">
                      {service.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-secondary dark:text-ink-dark-secondary mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      {service.durationMinutes} minutes
                    </span>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 gap-2">
                    <span className="font-bold text-burgundy dark:text-burgundy-lifted">
                      {formatPrice(service.price)}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-150 ${
                        selected
                          ? 'bg-burgundy border-burgundy scale-in'
                          : 'border-line dark:border-line-dark'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </div>
                </div>
              </button>
            );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
