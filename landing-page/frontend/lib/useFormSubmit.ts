'use client';

import { useState } from 'react';
import { submitForm } from './api';

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export function useFormSubmit() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (data: Record<string, string>) => {
    setStatus('submitting');
    setErrorMsg('');

    try {
      const result = await submitForm(data);
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
