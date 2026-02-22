'use client';

/**
 * Record Payment Form (Phase 7 - T011)
 *
 * Form for recording a repayment against a Fineract loan.
 * Posts the transaction to Fineract via the backend API.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { recordFineractRepayment } from '@/lib/api/fineract';
import { formatCurrency } from '@lynia/utils';

interface Props {
  lyniaLoanId: string;
  outstandingBalance: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RecordPaymentForm({
  lyniaLoanId,
  outstandingBalance,
  onSuccess,
  onCancel,
}: Props) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      recordFineractRepayment(lyniaLoanId, {
        transactionDate: date,
        transactionAmount: parseFloat(amount),
        note: note || undefined,
      }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to record payment');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    if (parsedAmount > outstandingBalance) {
      setError('Amount exceeds outstanding balance');
      return;
    }

    if (!date) {
      setError('Payment date is required');
      return;
    }

    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Record Payment</h3>

      <div className="rounded-md bg-gray-50 p-3">
        <p className="text-sm text-gray-500">
          Outstanding Balance:{' '}
          <span className="font-semibold text-gray-900">
            {formatCurrency(outstandingBalance)}
          </span>
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="payment-amount"
          className="block text-sm font-medium text-gray-700"
        >
          Amount (USD)
        </label>
        <input
          id="payment-amount"
          type="number"
          step="0.01"
          min="0.01"
          max={outstandingBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="0.00"
          required
        />
      </div>

      <div>
        <label
          htmlFor="payment-date"
          className="block text-sm font-medium text-gray-700"
        >
          Payment Date
        </label>
        <input
          id="payment-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          required
        />
      </div>

      <div>
        <label
          htmlFor="payment-note"
          className="block text-sm font-medium text-gray-700"
        >
          Note (optional)
        </label>
        <textarea
          id="payment-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Payment reference or note..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Processing...' : 'Submit Payment'}
        </button>
      </div>
    </form>
  );
}
