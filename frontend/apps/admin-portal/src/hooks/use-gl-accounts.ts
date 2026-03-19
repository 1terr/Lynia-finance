'use client';

import { useQuery } from '@tanstack/react-query';
import { getGLAccounts } from '@/lib/api/products';
import type { GLAccount } from '@/types';

/**
 * Hook to fetch and cache Fineract GL accounts, grouped by type.
 * Used by the product wizard to populate GL account mapping dropdowns.
 */
export function useGLAccounts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: getGLAccounts,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  return {
    accounts: data?.accounts ?? [],
    grouped: data?.grouped ?? { asset: [], liability: [], equity: [], income: [], expense: [] },
    isLoading,
    error,
  };
}

/**
 * Filter GL accounts for a specific dropdown field.
 * Each GL mapping field should only show accounts of the appropriate type.
 */
export function getAccountsForField(
  grouped: Record<string, GLAccount[]>,
  field: string
): GLAccount[] {
  switch (field) {
    // Asset accounts
    case 'fund_source_account_id':
    case 'loan_portfolio_account_id':
    case 'receivable_interest_account_id':
    case 'receivable_fee_account_id':
    case 'receivable_penalty_account_id':
      return grouped.asset ?? [];
    // Liability accounts
    case 'overpayment_liability_account_id':
    case 'transfers_in_suspense_account_id':
      return grouped.liability ?? [];
    // Income accounts
    case 'interest_on_loan_account_id':
    case 'income_from_fee_account_id':
    case 'income_from_penalty_account_id':
      return grouped.income ?? [];
    // Expense accounts
    case 'write_off_account_id':
      return grouped.expense ?? [];
    default:
      return [...(grouped.asset ?? []), ...(grouped.liability ?? []), ...(grouped.income ?? []), ...(grouped.expense ?? [])];
  }
}
