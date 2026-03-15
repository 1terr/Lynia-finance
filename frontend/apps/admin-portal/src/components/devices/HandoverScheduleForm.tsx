'use client';

import React, { useState } from 'react';

interface HandoverScheduleFormProps {
  onSubmit: (data: {
    loan_id: string;
    customer_id: string;
    device_id: string;
    distributor_id: string;
    scheduled_date: string;
    scheduled_time: string;
    notes?: string;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function HandoverScheduleForm({ onSubmit, onCancel, isLoading }: HandoverScheduleFormProps) {
  const [formData, setFormData] = useState({
    loan_id: '',
    customer_id: '',
    device_id: '',
    distributor_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = formData.loan_id && formData.customer_id && formData.device_id &&
    formData.distributor_id && formData.scheduled_date && formData.scheduled_time;

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-border p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Schedule Device Handover</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Loan ID</label>
          <input
            type="text"
            value={formData.loan_id}
            onChange={(e) => handleChange('loan_id', e.target.value)}
            placeholder="Enter loan ID"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Customer ID</label>
          <input
            type="text"
            value={formData.customer_id}
            onChange={(e) => handleChange('customer_id', e.target.value)}
            placeholder="Enter customer ID"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Device ID</label>
          <input
            type="text"
            value={formData.device_id}
            onChange={(e) => handleChange('device_id', e.target.value)}
            placeholder="Enter device ID"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Distributor ID</label>
          <input
            type="text"
            value={formData.distributor_id}
            onChange={(e) => handleChange('distributor_id', e.target.value)}
            placeholder="Enter distributor ID"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Scheduled Date</label>
          <input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => handleChange('scheduled_date', e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Scheduled Time</label>
          <input
            type="time"
            value={formData.scheduled_time}
            onChange={(e) => handleChange('scheduled_time', e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes..."
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          rows={2}
          maxLength={1000}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          Schedule Handover
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-card text-foreground text-sm rounded-md border border-border hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
