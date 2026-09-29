'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin manager for advanced availability rules (Stage 9): holidays /
 * vacation closures (date-range blocks), custom working days (weekday opens),
 * date-specific weekday hours, and weekly recurring breaks.
 */

interface Rule {
  id: string;
  ruleType: string;
  dayOfWeek: number | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  label: string | null;
  isActive: boolean;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  date_range_block: 'Closure (holiday / vacation)',
  weekday_open: 'Custom working day (opens a closed weekday)',
  weekday_hours: 'Custom hours for a weekday',
  recurring_break: 'Weekly recurring break',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RulesManager({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ruleType, setRuleType] = useState('date_range_block');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('2');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [label, setLabel] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/availability/rules', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
    }
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const base: Record<string, unknown> = { ruleType, label: label.trim() || undefined };
      let body: Record<string, unknown>;
      if (ruleType === 'date_range_block') {
        body = { ...base, startDate, endDate };
      } else {
        body = {
          ...base,
          dayOfWeek: Number(dayOfWeek),
          startTime,
          endTime,
        };
      }
      const res = await fetch('/api/admin/availability/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create rule');
        return;
      }
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
      setLabel('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/availability/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this availability rule?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/availability/rules?id=${id}`, { method: 'DELETE' });
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  const needsTimes = ruleType !== 'date_range_block';

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Add an availability rule</h2>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Rule type</span>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {Object.entries(RULE_TYPE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Label (optional)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="e.g. Christmas holiday"
            />
          </label>
        </div>

        {ruleType === 'date_range_block' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-gray-600 mb-1">From</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-600 mb-1">To (inclusive)</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="block text-sm text-gray-600 mb-1">Weekday</span>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-gray-600 mb-1">{ruleType === 'recurring_break' ? 'Break from' : 'From'}</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-600 mb-1">{ruleType === 'recurring_break' ? 'Break to' : 'To'}</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </label>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Precedence: base schedule → these rules → per-date overrides → booked slots. Existing
          bookings are never affected by rule changes.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-burgundy text-white rounded-lg hover:bg-burgundy/90 disabled:opacity-50 text-sm"
        >
          {busy ? 'Saving…' : 'Add rule'}
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">Active &amp; past rules ({rules.length})</h2>
        {rules.length === 0 && <p className="text-sm text-gray-500">No rules configured.</p>}
        {rules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}
                {!rule.isActive && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {rule.ruleType === 'date_range_block'
                  ? `${rule.startDate} → ${rule.endDate}`
                  : `${DAYS[rule.dayOfWeek ?? 0]} ${rule.startTime}–${rule.endTime}`}
                {rule.label ? ` · ${rule.label}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => patch(rule.id, { isActive: !rule.isActive })}
                disabled={busy}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                {rule.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => remove(rule.id)}
                disabled={busy}
                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
