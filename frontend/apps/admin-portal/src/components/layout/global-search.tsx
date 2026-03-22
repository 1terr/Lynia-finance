'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, CreditCard, Banknote, Smartphone, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@lynia/utils';
import { Badge } from '@/components/ui/badge';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { globalSearch, type GlobalSearchResult } from '@/lib/api/search';

/**
 * GlobalSearch — Command-palette style search modal (Ctrl+K).
 *
 * Searches across customers, loans, payments, and devices. Results
 * are grouped by entity type with inline previews and navigation.
 */

// ─── Search Trigger Button ───

export function GlobalSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
        Ctrl+K
      </kbd>
    </button>
  );
}

// ─── Main Component ───

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  // ─── Keyboard shortcut: Ctrl+K ───
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay so the modal renders first
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults(null);
      setExpandedItem(null);
    }
  }, [open]);

  // ─── Fetch results on debounced query change ───
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    globalSearch(debouncedQuery)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const toggleExpand = (key: string) => {
    setExpandedItem((prev) => (prev === key ? null : key));
  };

  if (!open) {
    return <GlobalSearchTrigger onClick={() => setOpen(true)} />;
  }

  const hasResults = results && results.total > 0;
  const noResults = results && results.total === 0;
  const showHint = query.length > 0 && query.length < 2;

  return (
    <>
      {/* Trigger stays in the header */}
      <GlobalSearchTrigger onClick={() => setOpen(true)} />

      {/* Overlay */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        />

        {/* Search Panel */}
        <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers, loans, payments, devices..."
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {loading && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />}
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Results area */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {/* Hint: too short */}
            {showHint && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </p>
            )}

            {/* No results */}
            {noResults && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{results.query}&rdquo;
              </p>
            )}

            {/* Loading without existing results */}
            {loading && !results && query.length >= 2 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Results */}
            {hasResults && (
              <div className="space-y-1">
                {/* ─── Customers ─── */}
                {results.results.customers.length > 0 && (
                  <ResultSection
                    title="Customers"
                    icon={<Users className="h-4 w-4" />}
                    count={results.results.customers.length}
                  >
                    {results.results.customers.map((c) => {
                      const key = `customer-${c.id}`;
                      const expanded = expandedItem === key;
                      return (
                        <ResultItem
                          key={key}
                          expanded={expanded}
                          onClick={() => toggleExpand(key)}
                          title={`${c.first_name} ${c.last_name}`}
                          subtitle={c.phone_number}
                          badge={<Badge variant="status" status={c.status}>{c.status}</Badge>}
                        >
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <Detail label="National ID" value={c.national_id || 'N/A'} />
                              <Detail label="KYC Status">
                                <Badge variant="status" status={c.kyc_status}>{c.kyc_status}</Badge>
                              </Detail>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-1">
                              <LinkTag
                                onClick={() => navigate(`/customers?selected=${c.id}`)}
                                label={`${c.loan_count} loan${c.loan_count !== 1 ? 's' : ''}`}
                              />
                              <LinkTag
                                onClick={() => navigate(`/customers?selected=${c.id}`)}
                                label={`${c.payment_count} payment${c.payment_count !== 1 ? 's' : ''}`}
                              />
                              <LinkTag
                                onClick={() => navigate(`/customers?selected=${c.id}`)}
                                label={`${c.device_count} device${c.device_count !== 1 ? 's' : ''}`}
                              />
                            </div>
                            <ViewDetailsButton onClick={() => navigate(`/customers?selected=${c.id}`)} />
                          </div>
                        </ResultItem>
                      );
                    })}
                  </ResultSection>
                )}

                {/* ─── Loans ─── */}
                {results.results.loans.length > 0 && (
                  <ResultSection
                    title="Loans"
                    icon={<Banknote className="h-4 w-4" />}
                    count={results.results.loans.length}
                  >
                    {results.results.loans.map((l) => {
                      const key = `loan-${l.id}`;
                      const expanded = expandedItem === key;
                      return (
                        <ResultItem
                          key={key}
                          expanded={expanded}
                          onClick={() => toggleExpand(key)}
                          title={l.loan_number}
                          subtitle={l.customer_name}
                          badge={<Badge variant="status" status={l.status}>{l.status}</Badge>}
                        >
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <Detail label="Outstanding" value={`$${Number(l.outstanding_balance_usd || 0).toFixed(2)}`} />
                              <Detail label="Days Past Due" value={String(l.days_past_due ?? 0)} />
                            </div>
                            <LinkTag
                              onClick={() => navigate(`/customers?selected=${l.customer_id}`)}
                              label={`Customer: ${l.customer_name}`}
                            />
                            <ViewDetailsButton onClick={() => navigate('/fineract/loans')} />
                          </div>
                        </ResultItem>
                      );
                    })}
                  </ResultSection>
                )}

                {/* ─── Payments ─── */}
                {results.results.payments.length > 0 && (
                  <ResultSection
                    title="Payments"
                    icon={<CreditCard className="h-4 w-4" />}
                    count={results.results.payments.length}
                  >
                    {results.results.payments.map((p) => {
                      const key = `payment-${p.id}`;
                      const expanded = expandedItem === key;
                      return (
                        <ResultItem
                          key={key}
                          expanded={expanded}
                          onClick={() => toggleExpand(key)}
                          title={p.reference_number}
                          subtitle={p.customer_name}
                          badge={<Badge variant="status" status={p.status}>{p.status}</Badge>}
                        >
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <Detail label="Amount" value={`$${Number(p.amount_usd || 0).toFixed(2)}`} />
                              <Detail label="Date" value={p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'N/A'} />
                            </div>
                            <LinkTag
                              onClick={() => navigate(`/customers?selected=${p.customer_id}`)}
                              label={`Customer: ${p.customer_name}`}
                            />
                            <ViewDetailsButton onClick={() => navigate('/payments')} />
                          </div>
                        </ResultItem>
                      );
                    })}
                  </ResultSection>
                )}

                {/* ─── Devices ─── */}
                {results.results.devices.length > 0 && (
                  <ResultSection
                    title="Devices"
                    icon={<Smartphone className="h-4 w-4" />}
                    count={results.results.devices.length}
                  >
                    {results.results.devices.map((d) => {
                      const key = `device-${d.id}`;
                      const expanded = expandedItem === key;
                      return (
                        <ResultItem
                          key={key}
                          expanded={expanded}
                          onClick={() => toggleExpand(key)}
                          title={d.imei}
                          subtitle={`${d.manufacturer} ${d.model}`}
                          badge={<Badge variant="status" status={d.status}>{d.status}</Badge>}
                        >
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <Detail label="Manufacturer" value={d.manufacturer || 'N/A'} />
                              <Detail label="Model" value={d.model || 'N/A'} />
                            </div>
                            {d.customer_id && d.customer_name && (
                              <LinkTag
                                onClick={() => navigate(`/customers?selected=${d.customer_id}`)}
                                label={`Customer: ${d.customer_name}`}
                              />
                            )}
                            <ViewDetailsButton onClick={() => navigate('/devices')} />
                          </div>
                        </ResultItem>
                      );
                    })}
                  </ResultSection>
                )}
              </div>
            )}

            {/* Empty initial state */}
            {!query && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Search across customers, loans, payments, and devices
              </p>
            )}
          </div>

          {/* Footer */}
          {hasResults && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {results.total} result{results.total !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───

function ResultSection({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{count}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultItem({
  expanded,
  onClick,
  title,
  subtitle,
  badge,
  children,
}: {
  expanded: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg transition-colors',
        expanded ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {badge}
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 pb-3 pt-2">{children}</div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground">{children ?? value}</div>
    </div>
  );
}

function LinkTag({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </button>
  );
}

function ViewDetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      View Details
      <ExternalLink className="h-3 w-3" />
    </button>
  );
}
