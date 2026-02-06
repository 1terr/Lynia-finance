'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchPendingKYC } from '@/lib/api/customers';
import { KYCReviewCard } from '@/components/customers/KYCReviewCard';

export default function KYCReviewPage() {
  const { data: pendingKYC, isLoading } = useQuery({
    queryKey: ['kyc-pending-review'],
    queryFn: fetchPendingKYC,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/customers"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Customers
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700">KYC Review</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            KYC Manual Review
          </h1>
          <p className="mt-2 text-gray-600">
            Review and approve customer identity verification
          </p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {pendingKYC?.length || 0}
          </div>
          <div className="text-sm text-gray-500">Pending Reviews</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow">
          <p className="text-gray-500">Loading pending reviews...</p>
        </div>
      ) : !pendingKYC || pendingKYC.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="text-4xl">&#10003;</div>
          <p className="mt-4 text-lg font-medium text-gray-900">
            All caught up!
          </p>
          <p className="mt-1 text-gray-500">
            No pending KYC submissions to review
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {pendingKYC.map((submission: any) => (
            <KYCReviewCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
