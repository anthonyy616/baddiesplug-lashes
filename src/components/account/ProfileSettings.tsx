'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ProfileSettingsProps {
  name: string;
  email: string;
  phone?: string | null;
}

export default function ProfileSettings({ name, email, phone }: ProfileSettingsProps) {
  const router = useRouter();
  const [form, setForm] = useState({ name, phone: phone || '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to update your account.');
        return;
      }
      setMessage('Account details updated.');
      router.refresh();
    } catch {
      setError('Failed to update your account.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Account details</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-sm text-burgundy hover:underline whitespace-nowrap"
        >
          Log out
        </button>
      </div>

      {(message || error) && (
        <p className={`mb-4 text-sm ${error ? 'text-red-600' : 'text-green-600'}`} role="status">
          {error || message}
        </p>
      )}

      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg"
            required
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone number</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg"
          />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="sm:col-span-2 w-full sm:w-auto sm:justify-self-start px-4 py-2 bg-burgundy text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}