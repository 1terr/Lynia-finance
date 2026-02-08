'use client';

import { useState } from 'react';
import type { HandoverData, PendingHandover } from '@/types/distributor';
import { HANDOVER_STEPS, INITIAL_DEVICE_CONDITION } from '@/types/distributor';
import { submitHandover } from '@/lib/api/distributor';
import type { HandoverResult } from '@/types/distributor';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepSelectHandover } from './step-select-handover';
import { StepVerifyIdentity } from './step-verify-identity';
import { StepScanImei } from './step-scan-imei';
import { StepDeviceCondition } from './step-device-condition';
import { StepCapturePhotos } from './step-capture-photos';
import { StepSignature } from './step-signature';
import { StepConfirm } from './step-confirm';
import { HandoverSuccess } from './handover-success';

const initialData: HandoverData = {
  handover_id: '',
  selected_handover: null,
  customer_national_id: '',
  identity_verified: false,
  identity_photo_url: null,
  scanned_imei: '',
  imei_verified: false,
  device_condition: { ...INITIAL_DEVICE_CONDITION },
  device_photos: [],
  signature_data_url: null,
  deposit_payment_method: 'ecocash',
  deposit_transaction_ref: '',
  deposit_verified: false,
};

interface Props {
  handovers: PendingHandover[];
  onComplete: () => void;
}

export function HandoverWizard({ handovers, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<HandoverData>({ ...initialData });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<HandoverResult | null>(null);

  const update = (partial: Partial<HandoverData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return data.selected_handover !== null;
      case 2: return data.identity_verified;
      case 3: return data.imei_verified;
      case 4: return data.device_condition.powers_on;
      case 5: return data.device_photos.length >= 2;
      case 6: return data.signature_data_url !== null;
      case 7: return data.deposit_verified;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await submitHandover({
        handover_id: data.handover_id,
        customer_national_id: data.customer_national_id,
        scanned_imei: data.scanned_imei,
        device_condition: data.device_condition,
        device_photos: data.device_photos,
        signature_data_url: data.signature_data_url!,
        deposit_payment_method: data.deposit_payment_method,
        deposit_transaction_ref: data.deposit_transaction_ref,
      });
      setResult(res);
    } catch {
      // handled inline
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return <HandoverSuccess result={result} onDone={onComplete} />;
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {HANDOVER_STEPS.map((s) => (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center min-w-[48px]">
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                  step === s.id && 'border-primary bg-primary text-primary-foreground',
                  step > s.id && 'border-green-500 bg-green-500 text-white',
                  step < s.id && 'border-muted-foreground/30 text-muted-foreground/50',
                )}
              >
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
              </div>
              <span
                className={cn(
                  'text-[9px] mt-0.5 text-center leading-tight',
                  step === s.id ? 'text-primary font-semibold' : 'text-muted-foreground/60',
                )}
              >
                {s.shortTitle}
              </span>
            </div>
            {s.id < 7 && (
              <div
                className={cn(
                  'h-0.5 w-4 mx-0.5 mt-[-10px]',
                  step > s.id ? 'bg-green-500' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step title */}
      <div className="flex items-center gap-2">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-lg font-bold">
          Step {step}: {HANDOVER_STEPS[step - 1].title}
        </h2>
      </div>

      {/* Step content */}
      <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm">
        {step === 1 && (
          <StepSelectHandover
            handovers={handovers}
            selected={data.selected_handover}
            onSelect={(h) =>
              update({ selected_handover: h, handover_id: h.id })
            }
          />
        )}
        {step === 2 && (
          <StepVerifyIdentity
            handover={data.selected_handover!}
            nationalId={data.customer_national_id}
            verified={data.identity_verified}
            onUpdate={update}
          />
        )}
        {step === 3 && (
          <StepScanImei
            handover={data.selected_handover!}
            scannedImei={data.scanned_imei}
            verified={data.imei_verified}
            onUpdate={update}
          />
        )}
        {step === 4 && (
          <StepDeviceCondition
            condition={data.device_condition}
            onUpdate={(c) => update({ device_condition: c })}
          />
        )}
        {step === 5 && (
          <StepCapturePhotos
            photos={data.device_photos}
            onUpdate={(photos) => update({ device_photos: photos })}
          />
        )}
        {step === 6 && (
          <StepSignature
            signatureUrl={data.signature_data_url}
            onUpdate={(url) => update({ signature_data_url: url })}
          />
        )}
        {step === 7 && (
          <StepConfirm
            data={data}
            onUpdate={update}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < 7 ? (
          <Button
            className="flex-1"
            disabled={!canProceed()}
            onClick={() => setStep(step + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!canProceed() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Submitting...' : 'Complete Handover'}
          </Button>
        )}
      </div>
    </div>
  );
}
