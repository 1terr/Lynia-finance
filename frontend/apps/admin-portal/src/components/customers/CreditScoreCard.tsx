'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCreditScoreHistory } from '@/lib/api/customers';
import { formatCurrency } from '@lynia/utils';
import type { CustomerWithRelations } from '@/types/database';

interface CreditScoreCardProps {
  customer: CustomerWithRelations;
}

export function CreditScoreCard({ customer }: CreditScoreCardProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="text-lg font-semibold text-gray-900">Credit Score</h3>

      <div className="mt-4 flex items-center justify-center">
        <div className="relative h-32 w-32">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            {/* Score arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={getScoreColor(customer.credit_score || 0)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${((customer.credit_score || 0) / 1000) * 251.2} 251.2`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">
              {customer.credit_score || 0}
            </span>
            <span className="text-xs text-gray-500">/ 1000</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Credit Tier</span>
          <span className="font-medium text-gray-900">
            Tier {customer.credit_tier}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Credit Limit</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(customer.credit_limit)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Completed Loans</span>
          <span className="font-medium text-gray-900">
            {customer.completed_loans}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Defaulted Loans</span>
          <span className="font-medium text-gray-900">
            {customer.defaulted_loans}
          </span>
        </div>
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 700) return '#22c55e';
  if (score >= 400) return '#eab308';
  return '#ef4444';
}
