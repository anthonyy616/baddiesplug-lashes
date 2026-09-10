'use client';

import { Check } from './icons';

export interface SelectableAddon {
  id: string;
  name: string;
  description: string;
  price: number;
}

const formatPrice = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(kobo / 100);

interface AddonCardsProps {
  addons: SelectableAddon[];
  selectedIds: Set<string>;
  onToggle: (addon: SelectableAddon) => void;
}

export default function AddonCards({ addons, selectedIds, onToggle }: AddonCardsProps) {
  if (addons.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-display text-xl italic text-ink dark:text-ink-dark">No add-ons right now</p>
        <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mt-2">
          You can continue — add-ons are always optional.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addons.map((addon) => {
        const selected = selectedIds.has(addon.id);
        return (
          <button
            key={addon.id}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => onToggle(addon)}
            className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
              selected
                ? 'border-burgundy border-2 bg-burgundy/5 dark:bg-burgundy/10'
                : 'border-line dark:border-line-dark hover:border-burgundy/40 bg-white dark:bg-surface-dark'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink dark:text-ink-dark">{addon.name}</p>
                <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary mt-1">
                  {addon.description}
                </p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 gap-2">
                <span className="font-bold text-burgundy dark:text-burgundy-lifted">
                  {formatPrice(addon.price)}
                </span>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-150 ${
                    selected
                      ? 'bg-burgundy border-burgundy'
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
  );
}
