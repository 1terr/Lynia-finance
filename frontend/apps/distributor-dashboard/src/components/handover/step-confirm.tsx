'use client';

import { useState } from 'react';
import type { HandoverData } from '@/types/distributor';
import { verifyDepositPayment } from '@/lib/api/distributor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@lynia/utils';
import {
  CheckCircle2,
  XCircle,
  User,
  Smartphone,
  ScanLine,
  ClipboardCheck,
  Camera,
  PenLine,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  data: HandoverData;
  onUpdate: (partial: Partial<HandoverData>) => void;
}

const PAYMENT_METHODS = [
  { value: 'ecocash', label: 'EcoCash' },
  { value: 'onemoney', label: 'OneMoney' },
  { value: 'innbucks', label: 'InnBucks' },
  { value: 'onewallet', label: 'OneWallet' },
] as const;

function CheckItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
      )}
      <span className={cn('text-sm', checked ? 'text-foreground' : 'text-red-600')}>{label}</span>
    </div>
  );
}

export function StepConfirm({ data, onUpdate }: Props) {
  const [verifyingDeposit, setVerifyingDeposit] = useState(false);
  const [depositError, setDepositError] = useState('');

  const handover = data.selected_handover!;
  const depositAlreadyPaid = handover.deposit_paid;

  const handleVerifyDeposit = async () => {
    setDepositError('');
    setVerifyingDeposit(true);
    const res = await verifyDepositPayment(
      data.handover_id,
      data.deposit_payment_method,
      data.deposit_transaction_ref,
    );
    setVerifyingDeposit(false);
    if (res.verified) {
      onUpdate({ deposit_verified: true });
    } else {
      setDepositError(res.message);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Review all details below and verify the deposit payment before completing the handover.
      </p>

      {/* Summary checklist */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Handover Checklist
        </h3>
        <CheckItem label={`Customer: ${handover.customer_name}`} checked={true} />
        <CheckItem label={`Identity verified (${data.customer_national_id})`} checked={data.identity_verified} />
        <CheckItem label={`IMEI verified (${data.scanned_imei})`} checked={data.imei_verified} />
        <CheckItem label={`Device condition recorded`} checked={data.device_condition.powers_on} />
        <CheckItem label="Lynia app installed &amp; configured" checked={data.app_installed && data.app_configured} />
        <CheckItem label="Remote lock test passed" checked={data.lock_test_passed} />
        <CheckItem label={`${data.device_photos.filter(Boolean).length} photos captured`} checked={data.device_photos.filter(Boolean).length >= 2} />
        <CheckItem label="Customer signature obtained" checked={data.signature_data_url !== null} />
      </div>

      {/* Handover details */}
      <div className="rounded-lg border p-3 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Handover Details
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground">Customer</p>
              <p className="font-medium">{handover.customer_name}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground">Device</p>
              <p className="font-medium">{handover.device_model}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ScanLine className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground">IMEI</p>
              <p className="font-medium font-mono text-xs">{data.scanned_imei}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground">Condition</p>
              <p className="font-medium capitalize">
                Screen: {data.device_condition.screen_condition}, Body: {data.device_condition.body_condition}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Camera className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground">Photos</p>
              <p className="font-medium">{data.device_photos.filter(Boolean).length} captured</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <PenLine className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground">Signature</p>
              <p className="font-medium">{data.signature_data_url ? 'Captured' : 'Missing'}</p>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">Loan</p>
            <p className="text-sm font-bold">{handover.loan_id}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-lg font-bold">${handover.loan_amount}</p>
          </div>
        </div>
      </div>

      {/* Deposit verification */}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Deposit Payment
          </h3>
          {(depositAlreadyPaid || data.deposit_verified) && (
            <Badge variant="success" className="ml-auto text-[10px]">Verified</Badge>
          )}
        </div>

        {depositAlreadyPaid || data.deposit_verified ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                Deposit of ${handover.deposit_amount} verified
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-500/80">
                {depositAlreadyPaid ? 'Pre-paid via mobile money' : `Paid via ${data.deposit_payment_method}`}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 p-2.5">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Customer must pay a deposit of <strong>${handover.deposit_amount}</strong> before the device can be handed over.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Payment Method
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => onUpdate({ deposit_payment_method: m.value })}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium border-2 transition-colors',
                      data.deposit_payment_method === m.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/20 text-muted-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Transaction Reference
              </label>
              <input
                value={data.deposit_transaction_ref}
                onChange={(e) => onUpdate({ deposit_transaction_ref: e.target.value })}
                placeholder="e.g. MP240207.1234.A56789"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>

            {depositError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-700 dark:text-red-400">{depositError}</p>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!data.deposit_transaction_ref || data.deposit_transaction_ref.length < 4 || verifyingDeposit}
              onClick={handleVerifyDeposit}
            >
              <CreditCard className="h-4 w-4 mr-1.5" />
              {verifyingDeposit ? 'Verifying Payment...' : `Verify $${handover.deposit_amount} Deposit`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
