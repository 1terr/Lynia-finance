'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createDevice, bulkImportDevices, type CreateDeviceRequest, type BulkImportResult } from '@/lib/api/devices';
import { getDeviceModels } from '@/lib/api/products';
import type { DeviceModel } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Upload, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import Link from 'next/link';

type Tab = 'single' | 'bulk';

export default function AddDevicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('single');

  // Single device form state
  const [form, setForm] = useState<CreateDeviceRequest>({
    imei: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    device_type: 'smartphone',
    storage_gb: undefined,
    color: '',
    condition: 'new',
    purchase_price_usd: undefined,
    retail_price_usd: undefined,
    device_model_id: '',
    location: 'Warehouse',
  });

  // Bulk import state
  const [csvText, setCsvText] = useState('');
  const [bulkLocation, setBulkLocation] = useState('Warehouse');
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [parsedDevices, setParsedDevices] = useState<{ device: CreateDeviceRequest; errors: string[]; row: number }[]>([]);

  const { data: deviceModels } = useQuery({
    queryKey: ['device-models-select'],
    queryFn: () => getDeviceModels({ is_active: true, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDeviceRequest) => createDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      toast({ title: 'Device added successfully', variant: 'success' });
      router.push('/devices');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add device', description: error.message, variant: 'error' });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (devices: CreateDeviceRequest[]) =>
      bulkImportDevices({ devices, default_location: bulkLocation }),
    onSuccess: (result) => {
      setBulkResult(result);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      toast({ title: `Bulk import completed: ${result.inserted} inserted`, variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Bulk import failed', description: error.message, variant: 'error' });
    },
  });

  function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  function parseCSVData() {
    const lines = csvText.trim().split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      toast({ title: 'CSV must have a header row and at least one data row', variant: 'error' });
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const parsed: { device: CreateDeviceRequest; errors: string[]; row: number }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => { record[h] = values[idx] || ''; });

      const errors: string[] = [];
      const imei = record.imei || '';
      if (!imei) errors.push('Missing IMEI');
      else if (!/^\d{15}$/.test(imei)) errors.push('IMEI must be 15 digits');
      if (!record.manufacturer && !record.brand) errors.push('Missing manufacturer');
      if (!record.model) errors.push('Missing model');

      parsed.push({
        device: {
          imei,
          manufacturer: record.manufacturer || record.brand || '',
          model: record.model || '',
          serial_number: record.serial_number || undefined,
          storage_gb: record.storage_gb ? parseInt(record.storage_gb) : undefined,
          color: record.color || undefined,
          condition: (record.condition as CreateDeviceRequest['condition']) || 'new',
          purchase_price_usd: record.purchase_price_usd ? parseFloat(record.purchase_price_usd) : undefined,
          retail_price_usd: record.retail_price_usd ? parseFloat(record.retail_price_usd) : undefined,
        },
        errors,
        row: i + 1,
      });
    }

    setParsedDevices(parsed);
    setShowPreview(true);
  }

  function handlePreviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    parseCSVData();
  }

  function handleConfirmImport() {
    const validDevices = parsedDevices.filter((p) => p.errors.length === 0).map((p) => p.device);
    if (validDevices.length === 0) {
      toast({ title: 'No valid devices to import', variant: 'error' });
      return;
    }
    bulkMutation.mutate(validDevices);
    setShowPreview(false);
  }

  function handleModelSelect(modelId: string) {
    const selected = deviceModels?.data?.find((m: DeviceModel) => m.id === modelId);
    if (selected) {
      const model = selected;
      setForm((f) => ({
        ...f,
        device_model_id: modelId,
        manufacturer: model.brand as string || f.manufacturer,
        model: model.model_name as string || f.model,
        storage_gb: model.storage_gb as number || f.storage_gb,
        retail_price_usd: model.retail_price_usd as number || f.retail_price_usd,
      }));
    } else {
      setForm((f) => ({ ...f, device_model_id: '' }));
    }
  }

  const inputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/devices" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Devices</h1>
          <p className="text-sm text-gray-500">Register new devices into inventory</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('single')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'single'
              ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Plus className="h-4 w-4" />
          Single Device
        </button>
        <button
          onClick={() => setTab('bulk')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'bulk'
              ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Upload className="h-4 w-4" />
          Bulk Import
        </button>
      </div>

      {/* Single Device Form */}
      {tab === 'single' && (
        <Card>
          <CardHeader>
            <CardTitle>Register Single Device</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSingleSubmit} className="space-y-6">
              {/* Device Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Device Model (from catalog)
                </label>
                <select
                  value={form.device_model_id || ''}
                  onChange={(e) => handleModelSelect(e.target.value)}
                  className={inputClass + ' mt-1'}
                >
                  <option value="">-- Select from catalog (optional) --</option>
                  {(deviceModels?.data ?? []).map((m: DeviceModel) => (
                    <option key={m.id} value={m.id}>
                      {m.brand} {m.model_name} ({m.storage_gb}GB) - ${m.retail_price_usd}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Selecting a catalog model auto-fills brand, model, storage, and price
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* IMEI */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    IMEI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.imei}
                    onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
                    placeholder="15-digit IMEI"
                    required
                    maxLength={15}
                    pattern="\d{15}"
                    className={inputClass + ' mt-1 font-mono'}
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Serial Number</label>
                  <input
                    type="text"
                    value={form.serial_number || ''}
                    onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                    placeholder="Optional"
                    className={inputClass + ' mt-1'}
                  />
                </div>

                {/* Manufacturer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Manufacturer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.manufacturer}
                    onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                    placeholder="e.g. Samsung, Apple, Xiaomi"
                    required
                    className={inputClass + ' mt-1'}
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Model <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. Galaxy A14, iPhone SE"
                    required
                    className={inputClass + ' mt-1'}
                  />
                </div>

                {/* Storage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Storage (GB)</label>
                  <input
                    type="number"
                    value={form.storage_gb || ''}
                    onChange={(e) => setForm((f) => ({ ...f, storage_gb: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="e.g. 64, 128"
                    className={inputClass + ' mt-1'}
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Color</label>
                  <input
                    type="text"
                    value={form.color || ''}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    placeholder="e.g. Black, White"
                    className={inputClass + ' mt-1'}
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Condition</label>
                  <select
                    value={form.condition}
                    onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as CreateDeviceRequest['condition'] }))}
                    className={inputClass + ' mt-1'}
                  >
                    <option value="new">New</option>
                    <option value="grade_a">Grade A (Like New)</option>
                    <option value="grade_b">Grade B (Good)</option>
                    <option value="grade_c">Grade C (Fair)</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={form.location || ''}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Warehouse, Harare Office"
                    className={inputClass + ' mt-1'}
                  />
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Purchase Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.purchase_price_usd || ''}
                    onChange={(e) => setForm((f) => ({ ...f, purchase_price_usd: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="Cost price"
                    className={inputClass + ' mt-1'}
                  />
                </div>

                {/* Retail Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Retail Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.retail_price_usd || ''}
                    onChange={(e) => setForm((f) => ({ ...f, retail_price_usd: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="Selling price"
                    className={inputClass + ' mt-1'}
                  />
                </div>
              </div>

              {createMutation.isError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {(createMutation.error as Error).message || 'Failed to create device'}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => router.push('/devices')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Registering...' : 'Register Device'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bulk Import */}
      {tab === 'bulk' && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Import Devices</CardTitle>
          </CardHeader>
          <CardContent>
            {bulkResult ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Import Complete</p>
                    <div className="mt-2 flex gap-4 text-sm text-green-700">
                      <span>{bulkResult.inserted} inserted</span>
                      <span>{bulkResult.skipped} skipped (duplicates)</span>
                      <span>{bulkResult.errors} errors</span>
                    </div>
                  </div>
                </div>

                {bulkResult.error_details.length > 0 && (
                  <div className="rounded-lg bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-800">Errors:</p>
                    <ul className="mt-2 space-y-1 text-sm text-red-700">
                      {bulkResult.error_details.map((e, i) => (
                        <li key={i}>IMEI {e.imei}: {e.error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setBulkResult(null); setCsvText(''); }}>
                    Import More
                  </Button>
                  <Button onClick={() => router.push('/devices')}>
                    View Devices
                  </Button>
                </div>
              </div>
            ) : showPreview ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900">
                    Preview: {parsedDevices.length} rows — {parsedDevices.filter((p) => p.errors.length === 0).length} valid, {parsedDevices.filter((p) => p.errors.length > 0).length} with errors
                  </h3>
                </div>
                <div className="max-h-80 overflow-auto rounded-md border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">IMEI</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Brand</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Model</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Condition</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Price</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedDevices.map((p, i) => (
                        <tr key={i} className={p.errors.length > 0 ? 'bg-red-50' : ''}>
                          <td className="px-3 py-1.5 text-gray-500">{p.row}</td>
                          <td className="px-3 py-1.5 font-mono">{p.device.imei || '—'}</td>
                          <td className="px-3 py-1.5">{p.device.manufacturer || '—'}</td>
                          <td className="px-3 py-1.5">{p.device.model || '—'}</td>
                          <td className="px-3 py-1.5 capitalize">{p.device.condition || '—'}</td>
                          <td className="px-3 py-1.5">{p.device.retail_price_usd ? `$${p.device.retail_price_usd}` : '—'}</td>
                          <td className="px-3 py-1.5">
                            {p.errors.length > 0 ? (
                              <span className="text-red-600">{p.errors.join(', ')}</span>
                            ) : (
                              <span className="text-green-600">Valid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Back to Edit
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={bulkMutation.isPending || parsedDevices.filter((p) => p.errors.length === 0).length === 0}
                  >
                    {bulkMutation.isPending ? 'Importing...' : `Import ${parsedDevices.filter((p) => p.errors.length === 0).length} Devices`}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePreviewSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Location</label>
                  <input
                    type="text"
                    value={bulkLocation}
                    onChange={(e) => setBulkLocation(e.target.value)}
                    className={inputClass + ' mt-1 max-w-xs'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    CSV Data <span className="text-red-500">*</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Required columns: imei, manufacturer, model. Optional: serial_number, storage_gb, color, condition, purchase_price_usd, retail_price_usd
                  </p>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={12}
                    required
                    placeholder={`imei,manufacturer,model,storage_gb,color,condition,retail_price_usd\n123456789012345,Samsung,Galaxy A14,64,Black,new,150.00\n123456789012346,Samsung,Galaxy A14,64,White,new,150.00`}
                    className={inputClass + ' mt-2 font-mono text-xs'}
                  />
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-700">
                    Maximum 500 devices per import. Duplicate IMEIs will be skipped.
                  </p>
                </div>

                {bulkMutation.isError && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {(bulkMutation.error as Error).message || 'Import failed'}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" type="button" onClick={() => router.push('/devices')}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={bulkMutation.isPending}>
                    <Eye className="mr-1.5 h-4 w-4" />
                    Preview Import
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
