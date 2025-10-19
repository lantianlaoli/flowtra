'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

export function StoreLinkCTA() {
  const { isLoaded } = useUser();
  const [storeUrl, setStoreUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const url = storeUrl.trim();

    if (!url) {
      setError('Please paste your store URL.');
      return;
    }

    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      setError('Please enter a valid URL (including https://).');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/lead/store-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeUrl: url }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to submit');
      }

      setSubmitted(true);
      setStoreUrl('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Submission failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-10 md:mt-12">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 rounded-lg p-5 md:p-6 shadow-sm">
        <div className="grid gap-4 md:gap-6 md:grid-cols-12 items-center">
          <div className="md:col-span-4">
            <h3 className="text-2xl font-bold text-gray-900">Get free ad mockups</h3>
            <p className="text-sm sm:text-base text-gray-600 mt-2">Paste your store link — we’ll email you sample ad visuals.</p>
          </div>
          <div className="md:col-span-8">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <input
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="https://yourstore.example.com"
                className="min-w-0 flex-1 border border-gray-300 rounded-lg px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                inputMode="url"
                aria-label="Store URL"
              />
              <button
                onClick={handleSubmit}
                disabled={!isLoaded || submitting}
                className="shrink-0 bg-gray-900 text-white px-6 py-3.5 rounded-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer w-full sm:w-auto"
                aria-live="polite"
              >
                <Sparkles className="w-5 h-5" />
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
            {error && (
              <div className="text-sm text-red-600 mt-2">{error}</div>
            )}
            {submitted && (
              <div className="text-sm text-green-600 mt-2">Thanks! We’ll review your store.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
