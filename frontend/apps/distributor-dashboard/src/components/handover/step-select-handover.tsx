'use client';

import { useState, useEffect } from 'react';
import type { ApprovedLoan } from '@/types/distributor';
import { searchApprovedLoans } from '@/lib/api';
import { cn } from '@lynia/utils';
import { Search, User, DollarSign, Calendar, FileText, Loader2 } from 'lucide-react';

interface Props {
  selected: ApprovedLoan | null;
  onSelect: (loan: ApprovedLoan) => void;
}

export function StepSelectHandover({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApprovedLoan[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchApprovedLoans(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Search for a customer with an approved loan. Enter their name, national ID, or loan ID.
      </p>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "Farai" or "LYN-2026-091"'
          className="w-full rounded-lg border bg-background pl-9 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {query.length > 0 && query.length < 3 && (
        <p className="text-xs text-muted-foreground">Type at least 3 characters to search</p>
      )}

      {/* No results */}
      {hasSearched && results.length === 0 && !searching && (
        <div className="py-6 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No approved loans found for &ldquo;{query}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Check the spelling or try the loan ID
          </p>
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((loan) => (
            <button
              key={loan.loan_id}
              onClick={() => onSelect(loan)}
              className={cn(
                'w-full text-left rounded-lg border-2 p-3 transition-all',
                selected?.loan_id === loan.loan_id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-muted/40 hover:bg-muted/70',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{loan.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Budget: {loan.device_category} &middot; ${loan.loan_amount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {loan.loan_term_months} months &middot; ${loan.monthly_payment.toFixed(2)}/mo
                    </span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-bold">${loan.loan_amount}</p>
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                      loan.deposit_paid
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                    )}
                  >
                    {loan.deposit_paid ? 'Deposit Paid' : `$${loan.deposit_amount} due`}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">{loan.loan_id}</span>
                {selected?.loan_id === loan.loan_id && (
                  <span className="text-xs font-semibold text-primary">Selected</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected loan terms panel */}
      {selected && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Loan Terms (for customer)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Monthly Payment</p>
              <p className="font-bold">${selected.monthly_payment.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-bold">{selected.loan_term_months} months</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest Rate</p>
              <p className="font-bold">{selected.interest_rate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">First Payment</p>
              <p className="font-bold">
                {new Date(selected.first_payment_date).toLocaleDateString('en-ZW', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
