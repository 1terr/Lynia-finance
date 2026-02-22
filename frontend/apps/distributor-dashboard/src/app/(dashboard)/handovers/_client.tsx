'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PendingHandover } from '@/types/distributor';
import { fetchPendingHandovers } from '@/lib/api/distributor';
import { HandoverWizard } from '@/components/handover/handover-wizard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@lynia/utils';
import {
  PackageCheck,
  Plus,
  Clock,
  CheckCircle2,
  Calendar,
  ArrowRight,
} from 'lucide-react';

type ViewMode = 'list' | 'wizard';

export default function HandoversPage() {
  const queryClient = useQueryClient();
  const { data: handovers = [], isLoading: loading } = useQuery({
    queryKey: ['distributor', 'handovers', 'initiated'],
    queryFn: fetchPendingHandovers,
  });

  const [view, setView] = useState<ViewMode>('list');

  const handleComplete = () => {
    // Invalidate handovers and stats queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['distributor', 'handovers'] });
    queryClient.invalidateQueries({ queryKey: ['distributor', 'stats'] });
    setView('list');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (view === 'wizard') {
    return (
      <div className="max-w-2xl">
        <HandoverWizard handovers={handovers} onComplete={handleComplete} />
      </div>
    );
  }

  const pending = handovers.filter((h) => h.status === 'pending');
  const completed = handovers.filter((h) => h.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Device Handovers</h1>
          <p className="text-sm text-muted-foreground">
            Manage device deliveries to customers
          </p>
        </div>
        <Button size="sm" onClick={() => setView('wizard')}>
          <Plus className="h-4 w-4 mr-1.5" /> Start Handover
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-[10px] text-muted-foreground">Pending</span>
          </div>
          <p className="text-xl font-bold">{pending.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="text-[10px] text-muted-foreground">Completed</span>
          </div>
          <p className="text-xl font-bold">{completed.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <PackageCheck className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold">{handovers.length}</p>
        </div>
      </div>

      {/* Pending handovers */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            Pending Handovers ({pending.length})
          </h2>
        </div>
        <div className="divide-y">
          {pending.length === 0 ? (
            <div className="p-8 text-center">
              <PackageCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending handovers</p>
            </div>
          ) : (
            pending.map((h) => (
              <button
                key={h.id}
                onClick={() => setView('wizard')}
                className="w-full text-left flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <PackageCheck className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{h.customer_name}</p>
                    <Badge
                      variant={h.deposit_paid ? 'success' : 'warning'}
                      className="text-[10px]"
                    >
                      {h.deposit_paid ? 'Deposit Paid' : `$${h.deposit_amount} due`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {h.device_model} &middot; {h.loan_id}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(h.scheduled_date).toLocaleDateString('en-ZW', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold">${h.loan_amount}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Completed handovers */}
      {completed.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Completed ({completed.length})
            </h2>
          </div>
          <div className="divide-y">
            {completed.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-4 opacity-70">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.device_model} &middot; {h.loan_id}
                  </p>
                </div>
                <span className="text-sm font-bold">${h.loan_amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
