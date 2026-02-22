'use client';

/**
 * Loan Products Page (Phase 7 - T015)
 *
 * Displays Fineract loan products with tier details, interest rates,
 * credit score ranges, and GL account mappings.
 */

import { useQuery } from '@tanstack/react-query';
import { getFineractLoanProducts } from '@/lib/api/fineract';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { FineractLoanProductView } from '@/types/fineract';
import { Package, TrendingUp, Shield, CreditCard } from 'lucide-react';

const TIER_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  'Tier 1': { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  'Tier 2': { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700' },
  'Tier 3': { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700' },
};

export default function LoanProductsPage() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['fineract-loan-products'],
    queryFn: getFineractLoanProducts,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loan Products</h1>
        <p className="text-sm text-gray-500">
          Fineract loan product configuration for device financing tiers.
        </p>
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {(products || []).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: FineractLoanProductView }) {
  const tier = product.lyniaTier || 'Tier 1';
  const colors = TIER_COLORS[tier] || TIER_COLORS['Tier 1'];

  return (
    <div className={`rounded-lg border-2 ${colors.border} bg-white shadow-sm`}>
      {/* Header */}
      <div className={`rounded-t-lg ${colors.bg} p-4`}>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${colors.text} ${colors.bg}`}
          >
            {tier}
          </span>
          <Package className={`h-5 w-5 ${colors.text}`} />
        </div>
        <h3 className="mt-2 text-lg font-bold text-gray-900">
          {product.name.replace('Lynia Device Finance - ', '')}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{product.description}</p>
      </div>

      {/* Details */}
      <div className="space-y-4 p-4">
        {/* Principal Range */}
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">
              Principal Range
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(product.minPrincipal)} - {formatCurrency(product.maxPrincipal)}
            </p>
            <p className="text-xs text-gray-400">
              Default: {formatCurrency(product.principal)}
            </p>
          </div>
        </div>

        {/* Interest Rate */}
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">
              Interest Rate
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {product.interestRatePerPeriod}% per month
            </p>
            <p className="text-xs text-gray-400">
              {formatPercent(product.annualInterestRate)} annual |{' '}
              {product.interestType}
            </p>
          </div>
        </div>

        {/* Credit Score Range */}
        {product.minCreditScore && product.maxCreditScore && (
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                Credit Score
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {product.minCreditScore} - {product.maxCreditScore}
              </p>
            </div>
          </div>
        )}

        {/* Term & Down Payment */}
        <div className="grid grid-cols-2 gap-4 rounded-md bg-gray-50 p-3">
          <div>
            <p className="text-xs text-gray-500">Term</p>
            <p className="text-sm font-semibold text-gray-900">
              {product.numberOfRepayments} months
            </p>
            {product.minNumberOfRepayments &&
              product.maxNumberOfRepayments && (
                <p className="text-xs text-gray-400">
                  {product.minNumberOfRepayments}-{product.maxNumberOfRepayments} range
                </p>
              )}
          </div>
          {product.downPaymentPercentage !== undefined && (
            <div>
              <p className="text-xs text-gray-500">Down Payment</p>
              <p className="text-sm font-semibold text-gray-900">
                {product.downPaymentPercentage}%
              </p>
            </div>
          )}
        </div>

        {/* Accounting Rule */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">Accounting</p>
          <p className="text-sm font-medium text-gray-700">
            {product.accountingRule}
          </p>
        </div>
      </div>
    </div>
  );
}
