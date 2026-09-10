'use client';

import { useState } from 'react';
import { Chevron, ChevronUp } from './icons';

export interface SummaryItem {
  id: string;
  name: string;
  price: number;
  kind: 'service' | 'addon';
}

interface StickySummaryBarProps {
  items: SummaryItem[];
  date: string | null;
  slot: { startTime: string; endTime: string } | null;
  subtotal: number;
  deposit: number;
  ctaLabel: string;
  ctaDisabled: boolean;
  onCta: () => void;
  isSubmitting?: boolean;
}

const formatPrice = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(kobo / 100);

export function formatSlotLabel(slot: { startTime: string; endTime: string }): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(slot.startTime)} – ${fmt(slot.endTime)}`;
}

export default function StickySummaryBar({
  items,
  date,
  slot,
  subtotal,
  deposit,
  ctaLabel,
  ctaDisabled,
  onCta,
  isSubmitting,
}: StickySummaryBarProps) {
  const [expanded, setExpanded] = useState(false);

  const serviceCount = items.filter((i) => i.kind === 'service').length;
  const addonCount = items.filter((i) => i.kind === 'addon').length;

  const parts: string[] = [];
  if (serviceCount > 0) parts.push(`${serviceCount} Service${serviceCount > 1 ? 's' : ''}`);
  if (addonCount > 0) parts.push(`${addonCount} Add-on${addonCount > 1 ? 's' : ''}`);
  if (date && slot) parts.push(formatSlotLabel(slot));

  return (
    <div className="sticky bottom-0 z-30 bg-white dark:bg-surface-dark shadow-summary border-t border-line dark:border-line-dark rounded-t-xl">
      {/* Expanded itemized list */}
      {expanded && (
        <div className="px-4 pt-4 pb-2 max-h-56 overflow-y-auto border-b border-line dark:border-line-dark">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between py-1 text-sm">
              <span className="text-ink-secondary dark:text-ink-dark-secondary">
                {item.name}
                <span className="text-xs text-disabled-text dark:text-disabled-text-dark ml-1.5">
                  {item.kind === 'addon' ? 'add-on' : ''}
                </span>
              </span>
              <span className="font-medium">{formatPrice(item.price)}</span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary py-1">Nothing selected yet</p>
          )}
          <div className="flex justify-between py-1 text-sm border-t border-line dark:border-line-dark mt-2 pt-2">
            <span className="text-ink-secondary dark:text-ink-dark-secondary">Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-ink-secondary dark:text-ink-dark-secondary">Required deposit</span>
            <span className="font-bold text-burgundy dark:text-burgundy-lifted">{formatPrice(deposit)}</span>
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-ink-secondary dark:text-ink-dark-secondary hover:text-ink dark:hover:text-ink-dark transition-colors min-w-0"
            aria-expanded={expanded}
          >
            <span className="truncate">
              {parts.length > 0 ? parts.join(' · ') : 'Pick a service to start'}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <Chevron className="w-4 h-4 flex-shrink-0" />}
          </button>
          <div className="text-right flex-shrink-0 ml-3">
            <span
              className={`font-bold text-burgundy dark:text-burgundy-lifted transition-opacity duration-200 ${ctaDisabled ? 'opacity-40' : ''}`}
              key={subtotal}
            >
              {formatPrice(subtotal)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCta}
          disabled={ctaDisabled || isSubmitting}
          className={`w-full py-3.5 rounded-lg font-semibold transition-all duration-200 ${
            ctaDisabled || isSubmitting
              ? 'bg-disabled-surface dark:bg-disabled-surface-dark text-disabled-text dark:text-disabled-text-dark cursor-not-allowed'
              : 'bg-burgundy text-white hover:bg-burgundy-hover active:scale-[0.99]'
          }`}
        >
          {isSubmitting ? 'Please wait...' : ctaLabel}
        </button>
      </div>
    </div>
  );
}
