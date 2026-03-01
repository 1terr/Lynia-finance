'use client';

import { useFormSubmit } from '@/lib/useFormSubmit';

export function WaitlistForm() {
  const { status, errorMsg, handleSubmit } = useFormSubmit();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const phone = (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).value;
    await handleSubmit({ type: 'waitlist', phone });
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
      <form className="flex flex-col sm:flex-row gap-3" onSubmit={onSubmit}>
        <input
          name="phone"
          type="tel"
          required
          placeholder="+263 7XX XXX XXX"
          className="form-input flex-1"
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="h-11 px-5 rounded-md bg-primary text-white text-base font-semibold shadow-btn hover:bg-primary-hover transition-all duration-250 ease-stripe whitespace-nowrap disabled:opacity-50"
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
