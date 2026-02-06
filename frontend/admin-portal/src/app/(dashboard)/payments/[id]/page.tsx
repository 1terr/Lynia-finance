'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchPaymentById } from '@/lib/api/payments';
import { PaymentDetail } from '@/components/payments/PaymentDetail';

export default function PaymentDetailPage() {
  const params = useParams();
  const paymentId = params.id as string;

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => fetchPaymentById(paymentId),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading payment...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="text-red-500">Payment not found</p>
        <Link
          href="/dashboard/payments"
          className="mt-2 text-sm text-primary-600 hover:underline"
        >
          Back to payments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/payments"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          className="mr-1 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Payments
      </Link>

      <PaymentDetail payment={payment} />
    </div>
  );
}
