'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import type { DeviceModel, CreateDeviceModelInput } from '@/types';

interface DeviceModelFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDeviceModelInput) => Promise<void>;
  deviceModel?: DeviceModel | null;
  productDefaults?: { depositPercentage?: number; maxTermMonths?: number };
}

export function DeviceModelForm({ open, onClose, onSubmit, deviceModel, productDefaults }: DeviceModelFormProps) {
  const isEditing = !!deviceModel;
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [storageGb, setStorageGb] = useState('');
  const [ramGb, setRamGb] = useState('');
  const [screenSize, setScreenSize] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [minDepositPct, setMinDepositPct] = useState('');
  const [maxTermMonths, setMaxTermMonths] = useState('');

  useEffect(() => {
    if (deviceModel) {
      setBrand(deviceModel.brand);
      setModelName(deviceModel.model_name);
      setModelCode(deviceModel.model_code);
      setStorageGb(deviceModel.storage_gb != null ? String(deviceModel.storage_gb) : '');
      setRamGb(deviceModel.ram_gb != null ? String(deviceModel.ram_gb) : '');
      setScreenSize(deviceModel.screen_size_inches != null ? String(deviceModel.screen_size_inches) : '');
      setRetailPrice(String(deviceModel.retail_price_usd));
      setWholesalePrice(String(deviceModel.wholesale_price_usd));
      setMinDepositPct(deviceModel.min_deposit_percentage != null ? String(deviceModel.min_deposit_percentage) : '');
      setMaxTermMonths(deviceModel.max_term_months != null ? String(deviceModel.max_term_months) : '');
    } else {
      setBrand('');
      setModelName('');
      setModelCode('');
      setStorageGb('');
      setRamGb('');
      setScreenSize('');
      setRetailPrice('');
      setWholesalePrice('');
      setMinDepositPct('');
      setMaxTermMonths('');
    }
    setErrors({});
  }, [deviceModel, open]);

  const retail = parseFloat(retailPrice) || 0;
  const wholesale = parseFloat(wholesalePrice) || 0;
  const margin = retail - wholesale;
  const marginPct = retail > 0 ? (margin / retail) * 100 : 0;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!brand.trim()) newErrors.brand = 'Brand is required';
    if (!modelName.trim()) newErrors.modelName = 'Model name is required';
    if (!modelCode.trim()) newErrors.modelCode = 'Model code is required';
    if (isNaN(retail) || retail <= 0) newErrors.retailPrice = 'Valid retail price required';
    if (isNaN(wholesale) || wholesale <= 0) newErrors.wholesalePrice = 'Valid wholesale price required';
    if (retail > 0 && wholesale > 0 && wholesale >= retail) {
      newErrors.wholesalePrice = 'Wholesale must be less than retail';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data: CreateDeviceModelInput = {
        brand,
        model_name: modelName,
        model_code: modelCode,
        storage_gb: storageGb ? parseInt(storageGb) : undefined,
        ram_gb: ramGb ? parseInt(ramGb) : undefined,
        screen_size_inches: screenSize ? parseFloat(screenSize) : undefined,
        retail_price_usd: retail,
        wholesale_price_usd: wholesale,
        min_deposit_percentage: minDepositPct ? parseFloat(minDepositPct) : undefined,
        max_term_months: maxTermMonths ? parseInt(maxTermMonths) : undefined,
      };
      await onSubmit(data);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Device Model' : 'Add Device Model'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-3 gap-4">
          <Input label="Brand" id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} error={errors.brand} placeholder="e.g. Samsung" />
          <Input label="Model Name" id="modelName" value={modelName} onChange={(e) => setModelName(e.target.value)} error={errors.modelName} placeholder="e.g. Galaxy A14" />
          <Input label="Model Code" id="modelCode" value={modelCode} onChange={(e) => setModelCode(e.target.value)} error={errors.modelCode} placeholder="e.g. SAM_A14" disabled={isEditing} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input label="Storage (GB)" id="storageGb" type="number" value={storageGb} onChange={(e) => setStorageGb(e.target.value)} min="0" />
          <Input label="RAM (GB)" id="ramGb" type="number" value={ramGb} onChange={(e) => setRamGb(e.target.value)} min="0" />
          <Input label="Screen Size (inches)" id="screenSize" type="number" value={screenSize} onChange={(e) => setScreenSize(e.target.value)} min="0" step="0.1" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Retail Price (USD)" id="retailPrice" type="number" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} error={errors.retailPrice} min="0" step="0.01" />
          <Input label="Wholesale Price (USD)" id="wholesalePrice" type="number" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} error={errors.wholesalePrice} min="0" step="0.01" />
        </div>

        {retail > 0 && wholesale > 0 && margin > 0 && (
          <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
            Margin: {formatCurrency(margin)} ({marginPct.toFixed(1)}%)
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min Deposit % (override)"
            id="minDepositPct"
            type="number"
            value={minDepositPct}
            onChange={(e) => setMinDepositPct(e.target.value)}
            min="0"
            max="100"
            step="0.1"
            placeholder={productDefaults?.depositPercentage != null ? `Product default: ${productDefaults.depositPercentage}%` : 'Use product default'}
          />
          <Input
            label="Max Tenure (override)"
            id="maxTermMonths"
            type="number"
            value={maxTermMonths}
            onChange={(e) => setMaxTermMonths(e.target.value)}
            min="1"
            placeholder={productDefaults?.maxTermMonths != null ? `Product default: ${productDefaults.maxTermMonths} months` : 'Use product default'}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={submitting}>{isEditing ? 'Update Device Model' : 'Add Device Model'}</Button>
        </div>
      </form>
    </Modal>
  );
}
