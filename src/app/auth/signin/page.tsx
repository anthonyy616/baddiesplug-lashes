'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

type Mode = 'signin' | 'signup' | 'forgot';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/account';
  const urlError = searchParams.get('error');

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your email address.');
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (res.ok) {
          setInfo("If an account exists for that email, we've sent a reset link.");
        } else {
          setError('Something went wrong. Please try again.');
        }
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Could not create your account.');
          return;
        }
        // Auto sign-in after registration
        const result = await signIn('credentials', {
          email: email.trim(),
          password,
          redirect: false,
        });
        if (result?.error) {
          setMode('signin');
          setInfo('Account created! Please sign in.');
        } else {
          router.push(callbackUrl);
          router.refresh();
        }
      } catch {
        setError('Could not create your account.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Sign in
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('Invalid email or password.');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const oauth = (provider: 'google' | 'apple') => {
    setIsLoading(true);
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {mode === 'signin' && 'Welcome Back'}
            {mode === 'signup' && 'Create Your Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {mode === 'signin' && 'Sign in to book and manage your appointments'}
            {mode === 'signup' && 'Sign up to book your first appointment'}
            {mode === 'forgot' && "We'll email you a reset link"}
          </p>
        </div>

        {(error || urlError) && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error || 'Sign in failed. Please try again.'}
          </div>
        )}
        {info && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 rounded-lg text-sm">
            {info}
          </div>
        )}

        {mode !== 'forgot' && (
          <div className="space-y-3 mb-6">
            <button
              onClick={() => oauth('google')}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32c-.36.26-.78.39-1.24.39-.61 0-1.16-.32-1.49-.78a5.26 5.26 0 0 1-9.46 0 5.26 5.26 0 0 1-1.49.78 5.06 5.06 0 0 1-1.24-.39 5.06 5.06 0 0 1-2.2-3.32H2.95c-.13.72-.2 1.47-.2 2.25v4.19h5.92A5.06 5.06 0 0 1 4.83 19.5c.36.26.78.39 1.24.39.61 0 1.16-.32 1.49-.78a5.26 5.26 0 0 1 7.28 0 5.26 5.26 0 0 1 1.49.78 5.06 5.06 0 0 1 1.24.39 5.06 5.06 0 0 1 2.2 3.32h5.92v-4.19z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300 font-medium">Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs text-gray-400">or with email</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy"
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-burgundy"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-burgundy text-white font-semibold rounded-lg hover:bg-burgundy/90 disabled:opacity-50 transition-colors"
          >
            {isLoading
              ? 'Please wait...'
              : mode === 'signin'
                ? 'Sign In'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm space-y-2">
          {mode === 'signin' && (
            <>
              <p className="text-gray-600 dark:text-gray-400">
                Don&apos;t have an account?{' '}
                <button onClick={() => switchMode('signup')} className="text-burgundy hover:underline font-medium">
                  Sign up
                </button>
              </p>
              <button onClick={() => switchMode('forgot')} className="text-gray-500 hover:text-burgundy">
                Forgot your password?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <p className="text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <button onClick={() => switchMode('signin')} className="text-burgundy hover:underline font-medium">
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button onClick={() => switchMode('signin')} className="text-burgundy hover:underline font-medium">
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl p-8">Loading...</div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
