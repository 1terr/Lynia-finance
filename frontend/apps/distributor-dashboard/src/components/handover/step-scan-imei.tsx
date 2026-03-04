'use client';

import { useState, useMemo } from 'react';
import type { ApprovedLoan, InventoryDevice, HandoverData } from '@/types/distributor';
import { verifyDeviceSelection, fetchInventory } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@lynia/utils';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Search,
  ScanLine,
  Keyboard,
  Info,
  Loader2,
} from 'lucide-react';

interface Props {
  loan: ApprovedLoan;
  selectedDevice: InventoryDevice | null;
  confirmed: boolean;
  onUpdate: (partial: Partial<HandoverData>) => void;
}

export function StepScanImei({ loan, selectedDevice, confirmed, onUpdate }: Props) {
  const [deviceFilter, setDeviceFilter] = useState('');
  const [imeiInput, setImeiInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [scanMode, setScanMode] = useState(false);

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['distributor', 'inventory'],
    queryFn: fetchInventory,
  });

  const eligibleDevices = useMemo(() => {
    return inventory
      .filter((d) => d.status === 'available' && d.retail_price <= loan.loan_amount)
      .filter((d) => {
        if (!deviceFilter) return true;
        const q = deviceFilter.toLowerCase();
        return (
          d.brand.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          d.imei.includes(q)
        );
      });
  }, [inventory, loan.loan_amount, deviceFilter]);

  const handleSelectDevice = (device: InventoryDevice) => {
    onUpdate({ selected_device: device, device_imei_confirmed: false });
    setImeiInput('');
    setError('');
  };

  const handleVerify = async () => {
    if (!selectedDevice) return;
    setError('');
    setVerifying(true);
    try {
      const res = await verifyDeviceSelection(loan.loan_id, selectedDevice.id, imeiInput);
      if (res.verified) {
        onUpdate({ device_imei_confirmed: true });
      } else {
        setError(res.message);
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading inventory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a device from your inventory for this customer. Only devices within the
        approved budget of <strong>${loan.loan_amount}</strong> are shown.
      </p>

      {/* Device search filter */}
      {!confirmed && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            placeholder="Filter by brand, model, or IMEI..."
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Device list */}
      {!confirmed && (
        <>
          {eligibleDevices.length === 0 ? (
            <div className="py-6 text-center">
              <Smartphone className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {inventory.filter((d) => d.status === 'available').length === 0
                  ? 'No available devices in your inventory'
                  : `No devices within the $${loan.loan_amount} budget`}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {eligibleDevices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device)}
                  className={cn(
                    'w-full text-left rounded-lg border-2 p-2.5 transition-all',
                    selectedDevice?.id === device.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/40 hover:bg-muted/70',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{device.brand} {device.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">{device.imei}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${device.retail_price}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {device.condition.replace('_', ' ')}
                        {device.storage_gb ? ` · ${device.storage_gb}GB` : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* IMEI confirmation */}
      {selectedDevice && !confirmed && (
        <>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Selected Device</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Model</p>
                <p className="font-medium">{selectedDevice.brand} {selectedDevice.model}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-medium">${selectedDevice.retail_price}</p>
              </div>
            </div>
          </div>

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
              <span className="text-xs font-medium">Type IMEI</span>
            </button>
          </div>

          {scanMode ? (
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 flex flex-col items-center gap-2">
              <ScanLine className="h-10 w-10 text-muted-foreground/40 animate-pulse" />
              <p className="text-xs text-muted-foreground text-center">
                Point camera at device IMEI barcode.
                <br />
                Dial <code className="bg-muted px-1 rounded text-xs">*#06#</code> on the device to display IMEI.
              </p>
              <button
                onClick={() => {
                  setImeiInput(selectedDevice.imei);
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
                Confirm 15-digit IMEI Number
              </label>
              <input
                value={imeiInput}
                onChange={(e) => {
                  setImeiInput(e.target.value.replace(/\D/g, '').slice(0, 15));
                  setError('');
                }}
                placeholder="351234567890123"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring font-mono tracking-widest"
                inputMode="numeric"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {imeiInput.length}/15 digits entered
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-2.5">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Confirm the IMEI matches the device you selected. This ensures the correct device is linked to the loan.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <Button
            className="w-full"
            disabled={imeiInput.length !== 15 || verifying}
            onClick={handleVerify}
          >
            <ScanLine className="h-4 w-4 mr-1.5" />
            {verifying ? 'Verifying...' : 'Confirm Device'}
          </Button>
        </>
      )}

      {/* Confirmed state */}
      {confirmed && selectedDevice && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Device Confirmed
            </p>
            <p className="text-xs text-green-600/80 dark:text-green-500/80">
              {selectedDevice.brand} {selectedDevice.model} — ${selectedDevice.retail_price}
            </p>
            <p className="text-xs text-green-600/80 dark:text-green-500/80 font-mono">
              IMEI: {selectedDevice.imei}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
