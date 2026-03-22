'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import type { CompletedHandover } from '@/types/distributor';
import { fetchCompletedHandovers } from '@/lib/api';
import { HandoverWizard } from '@/components/handover/handover-wizard';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/shared/pagination';
import { HandoversSkeleton } from '@/components/ui/skeleton';
import {
  PackageCheck,
  Plus,
  CheckCircle2,
  DollarSign,
  Smartphone,
  Search,
  Download,
} from 'lucide-react';

type ViewMode = 'list' | 'wizard';

const PAGE_LIMIT = 20;

function exportHandoversCSV(handovers: CompletedHandover[]) {
  const header = 'Date,Customer,Device,Loan ID,IMEI,Loan Amount,Commission Earned\n';
  const rows = handovers
    .map(
      (h) =>
        `${new Date(h.completed_at).toLocaleDateString('en-ZW')},${h.customer_name},${h.device_model},${h.loan_id},${h.device_imei},$${h.loan_amount.toFixed(2)},$${h.commission_earned.toFixed(2)}`,
    )
    .join('\n');

  const totalCommission = handovers.reduce((s, h) => s + h.commission_earned, 0);
  const totalLoans = handovers.reduce((s, h) => s + h.loan_amount, 0);
  const summary = `\n\nTotal,,,,,$${totalLoans.toFixed(2)},$${totalCommission.toFixed(2)}`;

  const blob = new Blob([header + rows + summary], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `handovers_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HandoversPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: handoverResult, isLoading: loading } = useQuery({
    queryKey: ['distributor', 'handovers', 'completed', { search: debouncedSearch, page, limit: PAGE_LIMIT }],
    queryFn: () => fetchCompletedHandovers({
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_LIMIT,
    }),
  });

  const completed = handoverResult?.data ?? [];
  const totalHandovers = handoverResult?.total ?? 0;

  const handleComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['distributor', 'handovers'] });
    queryClient.invalidateQueries({ queryKey: ['distributor', 'stats'] });
    setView('list');
  };

  if (loading && page === 1 && !debouncedSearch) {
    return <HandoversSkeleton />;
  }

  if (view === 'wizard') {
    return (
      <div className="max-w-2xl">
        <HandoverWizard onComplete={handleComplete} />
      </div>
    );
  }

  const totalCommission = completed.reduce((sum, h) => sum + h.commission_earned, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Device Handovers</h1>
          <p className="text-sm text-muted-foreground">
            Hand over devices to approved customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportHandoversCSV(completed)}
            className="hidden sm:inline-flex"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setView('wizard')}>
            <Plus className="h-4 w-4 mr-1.5" /> Start Handover
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
          <p className="text-xl font-bold">{totalHandovers}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs text-muted-foreground">Earned</span>
          </div>
          <p className="text-xl font-bold">${totalCommission.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Smartphone className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs text-muted-foreground">Devices</span>
          </div>
          <p className="text-xl font-bold">{totalHandovers}</p>
        </div>
      </div>

      {/* Search input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer, device, loan ID, or IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search handovers"
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2.5 text-base h-11 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportHandoversCSV(completed)}
          className="sm:hidden h-11 px-3"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Start handover CTA (when no completed handovers and no search) */}
      {totalHandovers === 0 && !debouncedSearch && (
        <div className="rounded-xl border bg-card shadow-sm p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <PackageCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-base font-semibold mb-1">No handovers yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Start a handover when a customer with an approved loan comes to collect their device.
          </p>
          <Button onClick={() => setView('wizard')}>
            <Plus className="h-4 w-4 mr-1.5" /> Start Handover
          </Button>
        </div>
      )}

      {/* Completed handovers */}
      {(completed.length > 0 || debouncedSearch) && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Completed Handovers ({totalHandovers})
            </h2>
          </div>
          {completed.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No handovers match your search
            </div>
          ) : (
            <>
              <div className="divide-y">
                {completed.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{h.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.device_model} &middot; {h.loan_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.completed_at).toLocaleDateString('en-ZW', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold">${h.loan_amount}</p>
                      <p className="text-xs font-medium text-green-600">
                        +${h.commission_earned.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                page={page}
                limit={PAGE_LIMIT}
                total={totalHandovers}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
