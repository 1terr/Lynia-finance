'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const phone = (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).value;

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <p className="text-body-sm text-success font-medium">
        You&apos;re on the list! We&apos;ll notify you when Digital Credit launches.
      </p>
    );
  }

  return (
    <div>
      <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleSubmit}>
        <input
          name="phone"
          type="tel"
          required
          placeholder="+263 7XX XXX XXX"
          className="h-11 px-4 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-body-sm focus:border-primary focus:outline-none flex-1"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="h-11 px-6 rounded-md bg-primary text-white text-body-sm font-medium hover:bg-primary-hover transition-colors whitespace-nowrap disabled:opacity-50"
        >
          {status === 'submitting' ? 'Joining\u2026' : 'Get notified when we launch \u2192'}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-body-sm text-error mt-2">{errorMsg}</p>
      )}
    </div>
  );
}
