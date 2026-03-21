'use client';

/**
 * Loan Products Page
 *
 * Displays Fineract loan products with credit score eligibility,
 * interest rates, principal ranges, and GL account mappings.
 */

import { useQuery } from '@tanstack/react-query';
import { getFineractLoanProducts } from '@/lib/api/fineract';
import { formatCurrency, formatPercent } from '@lynia/utils';
import type { FineractLoanProductView } from '@/types/fineract';
import { AlertTriangle, CheckCircle, Database, Package, TrendingUp, Shield, CreditCard, Smartphone, Banknote } from 'lucide-react';

const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string; label: string }> = {
  smartphone: { border: 'border-sky-200', bg: 'bg-sky-50 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-400', label: 'Smartphone' },
  digital: { border: 'border-emerald-200', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400', label: 'Digital Credit' },
};

export default function LoanProductsPage() {
  const { data: products, isLoading, isError, error } = useQuery({
    queryKey: ['fineract-loan-products'],
    queryFn: getFineractLoanProducts,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Loan Products</h1>
        <p className="text-sm text-muted-foreground">
          Loan product configuration synced with Fineract core banking.
        </p>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                Unable to load Fineract products
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {error instanceof Error
                  ? error.message
                  : 'Could not connect to the Fineract core banking service. Please check that the service is running.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isError && products && products.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/50 p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No loan products configured
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create loan products via the Products page, then sync them to Fineract.
          </p>
        </div>
      )}

      {/* Product Cards */}
      {products && products.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: FineractLoanProductView }) {
  const category = product.productCategory || 'smartphone';
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.smartphone;
  const CategoryIcon = category === 'digital' ? Banknote : Smartphone;

  return (
    <div className={`rounded-lg border-2 ${style.border} bg-card shadow-sm`}>
      {/* Header */}
      <div className={`rounded-t-lg ${style.bg} p-4`}>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${style.text} ${style.bg}`}
          >
            {style.label}
          </span>
          <CategoryIcon className={`h-5 w-5 ${style.text}`} />
        </div>
        <h3 className="mt-2 text-lg font-bold text-foreground">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
      </div>

      {/* Details */}
      <div className="space-y-4 p-4">
        {/* Principal Range */}
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Principal Range
            </p>
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(product.minPrincipal)} - {formatCurrency(product.maxPrincipal)}
            </p>
            <p className="text-xs text-muted-foreground">
              Default: {formatCurrency(product.principal)}
            </p>
          </div>
        </div>

        {/* Interest Rate */}
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Interest Rate
            </p>
            <p className="text-sm font-semibold text-foreground">
              {product.interestRatePerPeriod}% per month
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPercent(product.annualInterestRate)} annual |{' '}
              {product.interestType}
            </p>
          </div>
        </div>

        {/* Credit Score Range */}
        {product.minCreditScore != null && product.maxCreditScore != null && (
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Credit Score Eligibility
              </p>
              <p className="text-sm font-semibold text-foreground">
                {product.minCreditScore} - {product.maxCreditScore}
              </p>
            </div>
          </div>
        )}

        {/* Term & Down Payment */}
        <div className="grid grid-cols-2 gap-4 rounded-md bg-muted p-3">
          <div>
            <p className="text-xs text-muted-foreground">Term</p>
            <p className="text-sm font-semibold text-foreground">
              {product.numberOfRepayments} months
            </p>
            {product.minNumberOfRepayments &&
              product.maxNumberOfRepayments && (
                <p className="text-xs text-muted-foreground">
                  {product.minNumberOfRepayments}-{product.maxNumberOfRepayments} range
                </p>
              )}
          </div>
          {product.downPaymentPercentage !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">Down Payment</p>
              <p className="text-sm font-semibold text-foreground">
                {product.downPaymentPercentage}%
              </p>
            </div>
          )}
        </div>

        {/* Accounting Rule */}
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Accounting</p>
          <p className="text-sm font-medium text-foreground">
            {product.accountingRule}
          </p>
        </div>

        {/* Source Indicator */}
        <div className="border-t border-border pt-3">
          {product.source === 'fineract' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-950 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              <CheckCircle className="h-3.5 w-3.5" /> Synced from Fineract
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Database className="h-3.5 w-3.5" /> Lynia only — not synced to Fineract
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
