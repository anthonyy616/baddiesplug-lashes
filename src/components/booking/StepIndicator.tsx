'use client';

import { X } from './icons';

const STEPS = ['Services', 'Add-ons', 'Date & Time', 'Details', 'Review'] as const;

interface StepIndicatorProps {
  currentStep: number; // 0-indexed
  onStepClick: (step: number) => void;
  onClose: () => void;
}

export default function StepIndicator({ currentStep, onStepClick, onClose }: StepIndicatorProps) {
  return (
    <div className="relative mb-8">
      <button
        onClick={onClose}
        aria-label="Exit booking flow"
        className="absolute -top-1 right-0 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <ol className="flex items-start justify-between pr-10">
        {STEPS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={label} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!isCompleted}
                  onClick={() => isCompleted && onStepClick(index)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={
                    isCompleted
                      ? `Step ${index + 1}: ${label} (completed, tap to go back)`
                      : `Step ${index + 1}: ${label}`
                  }
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                    isCompleted
                      ? 'bg-burgundy text-white cursor-pointer'
                      : isCurrent
                        ? 'border-2 border-burgundy text-burgundy'
                        : 'border border-line dark:border-line-dark text-ink-secondary dark:text-ink-dark-secondary'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>
                <span
                  className={`mt-1.5 text-[10px] sm:text-xs leading-tight text-center max-w-[56px] sm:max-w-none ${
                    isCurrent
                      ? 'text-burgundy dark:text-burgundy-lifted font-medium'
                      : 'text-ink-secondary dark:text-ink-dark-secondary'
                  }`}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-px mt-4 mx-2 ${
                    index < currentStep ? 'bg-burgundy' : 'bg-line dark:bg-line-dark'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
