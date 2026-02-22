'use client';

import { useState } from 'react';
import type { PendingHandover, HandoverData } from '@/types/distributor';
import { verifyImei } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@lynia/utils';
import { ScanLine, CheckCircle2, XCircle, Keyboard, Info } from 'lucide-react';

interface Props {
  handover: PendingHandover;
  scannedImei: string;
  verified: boolean;
  onUpdate: (partial: Partial<HandoverData>) => void;
}

export function StepScanImei({ handover, scannedImei, verified, onUpdate }: Props) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [scanMode, setScanMode] = useState(false);

  const handleVerify = async () => {
    setError('');
    setVerifying(true);
    const res = await verifyImei(handover.id, scannedImei, handover.device_imei);
    setVerifying(false);
    if (res.verified) {
      onUpdate({ imei_verified: true });
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Verify the device IMEI matches the assigned device record. Dial <code className="bg-muted px-1 rounded text-xs">*#06#</code> on the device to display IMEI.
      </p>

      {/* Device info */}
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Device</p>
            <p className="font-medium">{handover.device_model}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected IMEI</p>
            <p className="font-medium font-mono text-xs">{handover.device_imei}</p>
          </div>
        </div>
      </div>

      {/* Scan / Manual toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setScanMode(true)}
          className={cn(
            'flex-1 rounded-lg border-2 p-3 flex flex-col items-center gap-1.5 transition-colors',
            scanMode ? 'border-primary bg-primary/5' : 'border-muted-foreground/20',
          )}
        >
          <ScanLine className="h-5 w-5" />
          <span className="text-xs font-medium">Scan Barcode</span>
        </button>
        <button
          onClick={() => setScanMode(false)}
          className={cn(
            'flex-1 rounded-lg border-2 p-3 flex flex-col items-center gap-1.5 transition-colors',
            !scanMode ? 'border-primary bg-primary/5' : 'border-muted-foreground/20',
          )}
        >
          <Keyboard className="h-5 w-5" />
          <span className="text-xs font-medium">Type Manually</span>
        </button>
      </div>

      {scanMode ? (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 flex flex-col items-center gap-2">
          <ScanLine className="h-10 w-10 text-muted-foreground/40 animate-pulse" />
          <p className="text-xs text-muted-foreground text-center">
            Camera barcode scanner would activate here.
            <br />
            Point camera at device IMEI barcode.
          </p>
          <button
            onClick={() => {
              onUpdate({ scanned_imei: handover.device_imei, imei_verified: false });
              setScanMode(false);
            }}
            className="text-xs text-primary font-medium mt-2"
          >
            Simulate successful scan
          </button>
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Enter 15-digit IMEI Number
          </label>
          <input
            value={scannedImei}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 15);
              onUpdate({ scanned_imei: val, imei_verified: false });
            }}
            placeholder="351234567890123"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring font-mono tracking-widest"
            inputMode="numeric"
            maxLength={15}
            disabled={verified}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {scannedImei.length}/15 digits entered
          </p>
        </div>
      )}

      {/* Tip */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-2.5">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-400">
          The IMEI is also printed on the device box and under the battery (if removable).
        </p>
      </div>

      {/* Verify button or status */}
      {verified ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">IMEI Verified</p>
            <p className="text-xs text-green-600/80 dark:text-green-500/80 font-mono">{scannedImei}</p>
          </div>
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
            disabled={scannedImei.length !== 15 || verifying}
            onClick={handleVerify}
          >
            <ScanLine className="h-4 w-4 mr-1.5" />
            {verifying ? 'Verifying...' : 'Verify IMEI'}
          </Button>
        </>
      )}
    </div>
  );
}
