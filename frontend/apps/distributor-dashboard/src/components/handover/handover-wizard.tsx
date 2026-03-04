'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HandoverData, HandoverResult } from '@/types/distributor';
import { HANDOVER_STEPS, INITIAL_DEVICE_CONDITION } from '@/types/distributor';
import { submitHandover } from '@/lib/api';
import { useOfflineQueue } from '@/lib/hooks/use-offline-queue';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { cn } from '@lynia/utils';
import { Check, ChevronLeft, WifiOff, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepSelectHandover } from './step-select-handover';
import { StepVerifyIdentity } from './step-verify-identity';
import { StepScanImei } from './step-scan-imei';
import { StepDeviceCondition } from './step-device-condition';
import { StepCapturePhotos } from './step-capture-photos';
import { StepSignature } from './step-signature';
import { StepConfirm } from './step-confirm';
import { HandoverSuccess } from './handover-success';

const SESSION_KEY = 'lynia-handover-draft';
const SWIPE_THRESHOLD = 50;

const initialData: HandoverData = {
  selected_loan: null,
  customer_national_id: '',
  identity_verified: false,
  identity_photo_url: null,
  selected_device: null,
  device_imei_confirmed: false,
  device_condition: { ...INITIAL_DEVICE_CONDITION },
  app_installed: false,
  app_configured: false,
  lock_test_passed: false,
  device_photos: [],
  signature_data_url: null,
  deposit_payment_method: 'ecocash',
  deposit_transaction_ref: '',
  deposit_verified: false,
};

interface Props {
  onComplete: () => void;
}

export function HandoverWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<HandoverData>({ ...initialData });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<HandoverResult | null>(null);
  const [showResume, setShowResume] = useState(false);
  const [resumeName, setResumeName] = useState('');

  // Haptic feedback
  const haptics = useHaptics();

  // Swipe gesture tracking
  const touchStartX = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Offline queue for failed submissions
  const offlineQueue = useOfflineQueue(
    useCallback(async (payload: Record<string, unknown>) => {
      await submitHandover(payload as Parameters<typeof submitHandover>[0]);
    }, []),
  );

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step: number; data: HandoverData };
        if (parsed.data?.selected_loan) {
          setResumeName(parsed.data.selected_loan.customer_name);
          setShowResume(true);
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // Save draft to sessionStorage on step/data changes (skip step 1 and result)
  useEffect(() => {
    if (result || step === 1 || !data.selected_loan) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ step, data }));
    } catch {
      // storage full or unavailable
    }
  }, [step, data, result]);

  const clearDraft = () => {
    sessionStorage.removeItem(SESSION_KEY);
  };

  const handleResume = () => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step: number; data: HandoverData };
        setStep(parsed.step);
        setData(parsed.data);
      }
    } catch {
      // ignore
    }
    setShowResume(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowResume(false);
  };

  const update = (partial: Partial<HandoverData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return data.selected_loan !== null;
      case 2: return data.identity_verified;
      case 3: return data.device_imei_confirmed;
      case 4: return data.device_condition.powers_on && data.app_installed && data.lock_test_passed;
      case 5: return data.device_photos.length >= 2;
      case 6: return data.signature_data_url !== null;
      case 7: return data.deposit_verified || data.selected_loan?.deposit_paid === true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!data.selected_loan || !data.selected_device) return;
    setSubmitting(true);
    setSubmitError('');

    const payload = {
      loan_id: data.selected_loan.loan_id,
      customer_id: data.selected_loan.customer_id,
      device_id: data.selected_device.id,
      customer_national_id: data.customer_national_id,
      device_imei: data.selected_device.imei,
      device_condition: data.device_condition,
      device_photos: data.device_photos,
      signature_data_url: data.signature_data_url!,
      deposit_payment_method: data.deposit_payment_method,
      deposit_transaction_ref: data.deposit_transaction_ref,
    };

    try {
      const res = await submitHandover(payload);
      clearDraft();
      haptics.success();
      setResult(res);
    } catch (err) {
      // If offline, queue for later
      if (!navigator.onLine) {
        offlineQueue.enqueue(payload as unknown as Record<string, unknown>);
        clearDraft();
        setResult({
          success: true,
          handover_id: 'pending',
          loan_id: data.selected_loan.loan_id,
          commission_amount: 0,
          next_payment_date: '',
          message: 'Handover saved offline — will be submitted when you reconnect.',
        });
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'Submission failed — please try again',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(diff) < SWIPE_THRESHOLD) return;

    if (diff < 0 && canProceed() && step < 7) {
      // Swipe left → next step
      setStep(step + 1);
    } else if (diff > 0 && step > 1) {
      // Swipe right → previous step
      setStep(step - 1);
    }
  };

  // Resume prompt
  if (showResume) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">Resume Handover?</h3>
            <p className="text-sm text-muted-foreground">
              You have an unfinished handover for <strong>{resumeName}</strong>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button className="flex-1 h-12" onClick={handleResume}>
            Resume
          </Button>
          <Button variant="outline" className="flex-1 h-12" onClick={handleDiscardDraft}>
            Start Fresh
          </Button>
        </div>
      </div>
    );
  }

  if (result) {
    return <HandoverSuccess result={result} onDone={onComplete} />;
  }

  const progressPercent = ((step - 1) / 6) * 100;

  return (
    <div className="space-y-4">
      {/* Offline queue badge */}
      {offlineQueue.pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 p-2.5">
          <WifiOff className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-400 flex-1">
            {offlineQueue.pendingCount} pending upload{offlineQueue.pendingCount > 1 ? 's' : ''} — will auto-submit when online
          </p>
          {offlineQueue.processing && (
            <span className="text-xs text-yellow-600 animate-pulse">Syncing...</span>
          )}
        </div>
      )}

      {/* Mobile step indicator: compact progress bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-primary">
            Step {step} of 7
          </p>
          <p className="text-xs text-muted-foreground">
            {HANDOVER_STEPS[step - 1].shortTitle}
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Desktop step indicator: circles */}
      <div className="hidden sm:flex items-center gap-1 overflow-x-auto pb-2">
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
                  'text-xs mt-0.5 text-center leading-tight',
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
            className="p-2.5 rounded-lg hover:bg-muted transition-colors touch-target"
            aria-label="Go to previous step"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-lg font-bold flex-1">
          {HANDOVER_STEPS[step - 1].title}
        </h2>
        {step > 1 && (
          <button
            onClick={() => {
              clearDraft();
              setStep(1);
              setData({ ...initialData });
            }}
            className="p-2.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground touch-target"
            title="Cancel handover"
            aria-label="Cancel handover"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Step content with swipe support */}
      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="rounded-xl border bg-card p-5 md:p-6 shadow-sm"
      >
        {step === 1 && (
          <StepSelectHandover
            selected={data.selected_loan}
            onSelect={(loan) => update({ selected_loan: loan })}
          />
        )}
        {step === 2 && (
          <StepVerifyIdentity
            loan={data.selected_loan!}
            nationalId={data.customer_national_id}
            verified={data.identity_verified}
            onUpdate={update}
          />
        )}
        {step === 3 && (
          <StepScanImei
            loan={data.selected_loan!}
            selectedDevice={data.selected_device}
            confirmed={data.device_imei_confirmed}
            onUpdate={update}
          />
        )}
        {step === 4 && (
          <StepDeviceCondition
            condition={data.device_condition}
            onUpdate={(c) => update({ device_condition: c })}
            appInstalled={data.app_installed}
            appConfigured={data.app_configured}
            lockTestPassed={data.lock_test_passed}
            onAppUpdate={update}
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

      {/* Submit error */}
      {submitError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
          <X className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{submitError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < 7 ? (
          <Button
            className="flex-1 h-12"
            disabled={!canProceed()}
            onClick={() => { haptics.light(); setStep(step + 1); }}
          >
            Continue
          </Button>
        ) : (
          <Button
            className="flex-1 h-14 text-base"
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
