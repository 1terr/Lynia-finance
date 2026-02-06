'use client';

import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recordManualPayment } from '@/lib/api/payments';

interface RecordPaymentFormData {
  loan_id: string;
  customer_id: string;
  amount_usd: number;
  payment_method: string;
  payment_type: string;
  reference_number: string;
  payment_date: string;
  notes: string;
}

interface RecordPaymentFormProps {
  onClose: () => void;
}

export function RecordPaymentForm({ onClose }: RecordPaymentFormProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordPaymentFormData>({
    defaultValues: {
      payment_type: 'installment',
      payment_method: 'ecocash',
      payment_date: new Date().toISOString().split('T')[0],
    },
  });

  const mutation = useMutation({
    mutationFn: recordManualPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      onClose();
    },
  });

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Record Manual Payment
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form
        onSubmit={handleSubmit((data) =>
          mutation.mutate({
            ...data,
            amount_usd: Number(data.amount_usd),
          })
        )}
        className="mt-4 space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Loan ID *
            </label>
            <input
              {...register('loan_id', { required: 'Loan ID is required' })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Enter loan UUID"
            />
            {errors.loan_id && (
              <p className="mt-1 text-xs text-red-500">
                {errors.loan_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Customer ID *
            </label>
            <input
              {...register('customer_id', {
                required: 'Customer ID is required',
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Enter customer UUID"
            />
            {errors.customer_id && (
              <p className="mt-1 text-xs text-red-500">
                {errors.customer_id.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Amount (USD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount_usd', {
                required: 'Amount is required',
                min: { value: 0.01, message: 'Must be greater than 0' },
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="0.00"
            />
            {errors.amount_usd && (
              <p className="mt-1 text-xs text-red-500">
                {errors.amount_usd.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Payment Date *
            </label>
            <input
              type="date"
              {...register('payment_date', {
                required: 'Payment date is required',
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Payment Method *
            </label>
            <select
              {...register('payment_method')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="ecocash">EcoCash</option>
              <option value="onemoney">OneMoney</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Payment Type *
            </label>
            <select
              {...register('payment_type')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="installment">Installment</option>
              <option value="deposit">Deposit</option>
              <option value="late_fee">Late Fee</option>
              <option value="early_payoff">Early Payoff</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Reference Number *
            </label>
            <input
              {...register('reference_number', {
                required: 'Reference number is required',
              })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Transaction/receipt reference"
            />
            {errors.reference_number && (
              <p className="mt-1 text-xs text-red-500">
                {errors.reference_number.message}
              </p>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Recording...' : 'Record Payment'}
          </button>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            Failed to record payment. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
