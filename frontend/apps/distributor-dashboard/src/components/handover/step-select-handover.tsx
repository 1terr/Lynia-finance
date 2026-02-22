'use client';

import type { PendingHandover } from '@/types/distributor';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import { PackageCheck, Calendar, User, Smartphone } from 'lucide-react';

interface Props {
  handovers: PendingHandover[];
  selected: PendingHandover | null;
  onSelect: (h: PendingHandover) => void;
}

export function StepSelectHandover({ handovers, selected, onSelect }: Props) {
  const pendingOnly = handovers.filter((h) => h.status === 'pending');

  if (pendingOnly.length === 0) {
    return (
      <div className="py-8 text-center">
        <PackageCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No pending handovers at this time</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select a pending handover to begin the device delivery process.
      </p>
      <div className="space-y-2">
        {pendingOnly.map((h) => (
          <button
            key={h.id}
            onClick={() => onSelect(h)}
            className={cn(
              'w-full text-left rounded-lg border-2 p-3 transition-all',
              selected?.id === h.id
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-muted/40 hover:bg-muted/70',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{h.customer_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{h.device_model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.scheduled_date).toLocaleDateString('en-ZW', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-bold">${h.loan_amount}</p>
                <Badge
                  variant={h.deposit_paid ? 'success' : 'warning'}
                  className="text-[10px]"
                >
                  {h.deposit_paid ? 'Deposit Paid' : `$${h.deposit_amount} due`}
                </Badge>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{h.loan_id}</span>
              {selected?.id === h.id && (
                <span className="text-xs font-semibold text-primary">Selected</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
