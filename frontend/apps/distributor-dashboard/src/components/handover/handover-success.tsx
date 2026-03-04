'use client';

import type { HandoverResult } from '@/types/distributor';
import { Button } from '@/components/ui/button';
import { CheckCircle2, DollarSign, Calendar, FileText } from 'lucide-react';

interface Props {
  result: HandoverResult;
  onDone: () => void;
}

export function HandoverSuccess({ result, onDone }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 md:p-8 shadow-sm text-center space-y-5">
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
          Handover Complete!
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loan Activated</span>
          </div>
          <p className="text-sm font-bold">{result.loan_id}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs text-muted-foreground">Commission Earned</span>
          </div>
          <p className="text-sm font-bold text-green-600">${result.commission_amount.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">First Payment Due</span>
          </div>
          <p className="text-sm font-bold">
            {new Date(result.next_payment_date).toLocaleDateString('en-ZW', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        A confirmation has been sent to the customer via WhatsApp.
      </div>

      <Button className="w-full" onClick={onDone}>
        Back to Handovers
      </Button>
    </div>
  );
}
