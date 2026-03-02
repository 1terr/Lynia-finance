'use client';

import { useState } from 'react';
import type { ApprovedLoan, HandoverData } from '@/types/distributor';
import { verifyCustomerIdentity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import { Camera, CheckCircle2, XCircle, ShieldCheck, User } from 'lucide-react';

interface Props {
  loan: ApprovedLoan;
  nationalId: string;
  verified: boolean;
  onUpdate: (partial: Partial<HandoverData>) => void;
}

export function StepVerifyIdentity({ loan, nationalId, verified, onUpdate }: Props) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  const handleVerify = async () => {
    setError('');
    setVerifying(true);
    const res = await verifyCustomerIdentity(loan.loan_id, nationalId);
    setVerifying(false);
    if (res.verified) {
      onUpdate({ identity_verified: true });
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Verify the customer&apos;s identity by checking their National ID against the loan application.
      </p>

      {/* Customer info */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Customer Details</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{loan.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Loan ID</p>
            <p className="font-medium">{loan.loan_id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Loan Amount</p>
            <p className="font-medium">${loan.loan_amount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Device Budget</p>
            <p className="font-medium">{loan.device_category}</p>
          </div>
        </div>
      </div>

      {/* ID photo capture */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Customer ID Photo (optional)
        </label>
        <button
          onClick={() => setCameraActive(!cameraActive)}
          className={cn(
            'w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors',
            cameraActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-muted-foreground/40',
          )}
        >
          <Camera className="h-8 w-8 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">
            {cameraActive ? 'Camera preview would appear here' : 'Tap to capture ID photo'}
          </span>
        </button>
      </div>

      {/* National ID input */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Enter Customer&apos;s National ID Number
        </label>
        <input
          value={nationalId}
          onChange={(e) => onUpdate({ customer_national_id: e.target.value.toUpperCase(), identity_verified: false })}
          placeholder="e.g. 63-234567B89"
          className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring font-mono tracking-wider"
          disabled={verified}
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Format: XX-XXXXXXXYY (e.g. 63-234567B89)
        </p>
      </div>

      {/* Verify button or status */}
      {verified ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Identity Verified</p>
            <p className="text-xs text-green-600/80 dark:text-green-500/80">
              National ID matches loan application record
            </p>
          </div>
          <Badge variant="success" className="ml-auto">
            <ShieldCheck className="h-3 w-3 mr-1" /> Verified
          </Badge>
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
          <Button
            className="w-full"
            disabled={!nationalId || nationalId.length < 8 || verifying}
            onClick={handleVerify}
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            {verifying ? 'Verifying...' : 'Verify Identity'}
          </Button>
        </>
      )}
    </div>
  );
}
