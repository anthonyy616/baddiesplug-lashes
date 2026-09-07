'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn('google', { callbackUrl });
  };

  const handleAppleSignIn = () => {
    setIsLoading(true);
    signIn('apple', { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your account to continue</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32c-.36.26-.78.39-1.24.39-.61 0-1.16-.32-1.49-.78a5.26 5.26 0 0 1-9.46 0 5.26 5.26 0 0 1-1.49.78 5.06 5.06 0 0 1-1.24-.39 5.06 5.06 0 0 1-2.2-3.32H2.95c-.13.72-.2 1.47-.2 2.25v4.19h5.92A5.06 5.06 0 0 1 4.83 19.5c.36.26.78.39 1.24.39.61 0 1.16-.32 1.49-.78a5.26 5.26 0 0 1 7.28 0 5.26 5.26 0 0 1 1.49.78 5.06 5.06 0 0 1 1.24.39 5.06 5.06 0 0 1 2.2 3.32h5.92v-4.19z"
              />
            </svg>
            <span className="text-gray-700 font-medium">Continue with Google</span>
          </button>

          <button
            onClick={handleAppleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.13 0-1.3.6-2.05.42-3.08-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.2 2.58-2.38 4.5-3.74 4.25z"
              />
            </svg>
            <span className="text-gray-700 font-medium">Continue with Apple</span>
          </button>
        </div>          <p className="mt-8 text-center text-sm text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">Loading...</div></div>}>
      <SignInContent />
    </Suspense>
  );
}
