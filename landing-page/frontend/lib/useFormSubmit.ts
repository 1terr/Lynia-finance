'use client';

import { useState } from 'react';
import { submitForm } from './api';

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

/** Strip HTML tags and limit string length to prevent XSS / abuse. */
function sanitize(value: string, maxLength = 1000): string {
  return value
    .replace(/<[^>]*>/g, '')    // strip HTML tags
    .replace(/[<>]/g, '')       // remove stray angle brackets
    .trim()
    .slice(0, maxLength);
}

export function useFormSubmit() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (data: Record<string, string>) => {
    // Honeypot check — if the hidden "website" field is filled, silently reject
    if (data._hp) {
      setStatus('success');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    // Sanitize all string values before sending
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === '_hp') continue;
      sanitized[key] = typeof value === 'string' ? sanitize(value) : value;
    }

    try {
      const result = await submitForm(sanitized);
      if (!result.success) {
        setErrorMsg(result.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  };

  return { status, errorMsg, handleSubmit };
}
