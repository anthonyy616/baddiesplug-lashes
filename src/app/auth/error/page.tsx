'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    console.error('Auth error:', error);
  }, [error]);

  return (
    <>
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
      <p className="text-gray-600 mb-6">
        {error === 'CredentialsSignin'
          ? 'Invalid credentials. Please try again.'
          : 'Something went wrong during authentication. Please try again.'}
      </p>
    </>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <Suspense fallback={<div className="text-gray-600 mb-6">Loading...</div>}>
          <ErrorContent />
        </Suspense>
        <Link
          href="/auth/signin"
          className="inline-block bg-burgundy text-white px-6 py-3 rounded-lg font-medium hover:bg-burgundy/90 transition-colors"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}
