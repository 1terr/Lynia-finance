'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompletedHandover } from '@/types/distributor';
import { fetchCompletedHandovers } from '@/lib/api';
import { HandoverWizard } from '@/components/handover/handover-wizard';
import { Button } from '@/components/ui/button';
import { HandoversSkeleton } from '@/components/ui/skeleton';
import {
  PackageCheck,
  Plus,
  CheckCircle2,
  DollarSign,
  Smartphone,
} from 'lucide-react';

type ViewMode = 'list' | 'wizard';

export default function HandoversPage() {
  const queryClient = useQueryClient();
  const { data: completed = [], isLoading: loading } = useQuery({
    queryKey: ['distributor', 'handovers', 'completed'],
    queryFn: fetchCompletedHandovers,
  });

  const [view, setView] = useState<ViewMode>('list');

  const handleComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['distributor', 'handovers'] });
    queryClient.invalidateQueries({ queryKey: ['distributor', 'stats'] });
    setView('list');
  };

  if (loading) {
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
        <Button size="sm" onClick={() => setView('wizard')}>
          <Plus className="h-4 w-4 mr-1.5" /> Start Handover
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="text-[10px] text-muted-foreground">Completed</span>
          </div>
          <p className="text-xl font-bold">{completed.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-green-600" />
            <span className="text-[10px] text-muted-foreground">Earned</span>
          </div>
          <p className="text-xl font-bold">${totalCommission.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Smartphone className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] text-muted-foreground">Devices</span>
          </div>
          <p className="text-xl font-bold">{completed.length}</p>
        </div>
      </div>

      {/* Start handover CTA (when no completed handovers) */}
      {completed.length === 0 && (
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
      {completed.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Completed Handovers ({completed.length})
            </h2>
          </div>
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
                  <p className="text-[10px] text-muted-foreground">
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
        </div>
      )}
    </div>
  );
}
