'use client';

import { useEffect, useState } from 'react';
import type { SystemConfig } from '@/types/settings';
import { fetchSystemConfig, updateSystemConfig } from '@/lib/api/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, AlertTriangle } from 'lucide-react';

interface ConfigFieldProps {
  label: string;
  description: string;
  value: string | number | boolean;
  type: 'number' | 'text' | 'toggle';
  unit?: string;
  onChange: (val: string | number | boolean) => void;
}

function ConfigField({ label, description, value, type, unit, onChange }: ConfigFieldProps) {
  if (type === 'toggle') {
    return (
      <div className="flex items-center justify-between py-3 border-b last:border-b-0">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-muted'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={String(value)}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          className="w-24 rounded-lg border bg-background px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-ring"
        />
        {unit && <span className="text-xs text-muted-foreground w-8">{unit}</span>}
      </div>
    </div>
  );
}

export function SystemConfiguration() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchSystemConfig().then((c) => { setConfig(c); setLoading(false); });
  }, []);

  const updateField = (key: keyof SystemConfig, value: string | number | boolean) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    await updateSystemConfig(config);
    setSaving(false);
    setDirty(false);
  };

  if (loading || !config) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">System Configuration</h3>
          <p className="text-sm text-muted-foreground">Core platform settings for Lynia Finance</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          <Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {config.maintenance_mode && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Maintenance mode is ON. The platform is currently unavailable to customers.</p>
        </div>
      )}

      {/* Loan Product Settings */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h4 className="text-sm font-semibold mb-1">Loan Products</h4>
        <p className="text-xs text-muted-foreground mb-4">Configure the 3-tier loan product structure</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-lg border p-4">
            <Badge variant="info" className="mb-3">Tier 1 - Entry</Badge>
            <ConfigField label="Loan Amount" description="Maximum amount for Tier 1" value={config.loan_tier1_amount} type="number" unit="USD" onChange={(v) => updateField('loan_tier1_amount', v)} />
            <ConfigField label="Term Length" description="Repayment period" value={config.loan_tier1_term_weeks} type="number" unit="wks" onChange={(v) => updateField('loan_tier1_term_weeks', v)} />
          </div>
          <div className="rounded-lg border p-4">
            <Badge variant="default" className="mb-3">Tier 2 - Standard</Badge>
            <ConfigField label="Loan Amount" description="Maximum amount for Tier 2" value={config.loan_tier2_amount} type="number" unit="USD" onChange={(v) => updateField('loan_tier2_amount', v)} />
            <ConfigField label="Term Length" description="Repayment period" value={config.loan_tier2_term_weeks} type="number" unit="wks" onChange={(v) => updateField('loan_tier2_term_weeks', v)} />
          </div>
          <div className="rounded-lg border p-4">
            <Badge variant="success" className="mb-3">Tier 3 - Premium</Badge>
            <ConfigField label="Loan Amount" description="Maximum amount for Tier 3" value={config.loan_tier3_amount} type="number" unit="USD" onChange={(v) => updateField('loan_tier3_amount', v)} />
            <ConfigField label="Term Length" description="Repayment period" value={config.loan_tier3_term_weeks} type="number" unit="wks" onChange={(v) => updateField('loan_tier3_term_weeks', v)} />
          </div>
        </div>
      </div>

      {/* Interest & Fees */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h4 className="text-sm font-semibold mb-1">Interest & Fees</h4>
        <p className="text-xs text-muted-foreground mb-4">Loan pricing configuration</p>
        <ConfigField label="Interest Rate" description="Annual interest rate applied to all loans" value={config.interest_rate_pct} type="number" unit="%" onChange={(v) => updateField('interest_rate_pct', v)} />
        <ConfigField label="Late Fee" description="Percentage charged on overdue amounts" value={config.late_fee_pct} type="number" unit="%" onChange={(v) => updateField('late_fee_pct', v)} />
        <ConfigField label="Grace Period" description="Days after due date before late fee applies" value={config.grace_period_days} type="number" unit="days" onChange={(v) => updateField('grace_period_days', v)} />
      </div>

      {/* Device Lock Settings */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h4 className="text-sm font-semibold mb-1">Device Lock Settings</h4>
        <p className="text-xs text-muted-foreground mb-4">Remote device lock/unlock configuration</p>
        <ConfigField label="Lock Delay" description="Hours after lock command before device locks" value={config.lock_delay_hours} type="number" unit="hrs" onChange={(v) => updateField('lock_delay_hours', v)} />
        <ConfigField label="Auto Lock After" description="Days overdue before automatic lock trigger" value={config.auto_lock_after_days_overdue} type="number" unit="days" onChange={(v) => updateField('auto_lock_after_days_overdue', v)} />
        <ConfigField label="Auto Unlock on Payment" description="Automatically unlock device when payment is received" value={config.unlock_after_payment} type="toggle" onChange={(v) => updateField('unlock_after_payment', v)} />
      </div>

      {/* KYC Settings */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h4 className="text-sm font-semibold mb-1">KYC Settings</h4>
        <p className="text-xs text-muted-foreground mb-4">Identity verification configuration</p>
        <ConfigField label="Max Retry Attempts" description="Maximum KYC submission retries per customer" value={config.kyc_max_retry_attempts} type="number" onChange={(v) => updateField('kyc_max_retry_attempts', v)} />
        <ConfigField label="Review SLA" description="Target hours to review KYC submissions" value={config.kyc_sla_hours} type="number" unit="hrs" onChange={(v) => updateField('kyc_sla_hours', v)} />
        <ConfigField label="Auto-Approve Threshold" description="Confidence score above which KYC is auto-approved" value={config.kyc_auto_approve_threshold} type="number" unit="%" onChange={(v) => updateField('kyc_auto_approve_threshold', v)} />
      </div>

      {/* General Settings */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h4 className="text-sm font-semibold mb-1">General</h4>
        <p className="text-xs text-muted-foreground mb-4">Platform-wide settings</p>
        <ConfigField label="Currency" description="Base currency for all transactions" value={config.currency} type="text" onChange={(v) => updateField('currency', v)} />
        <ConfigField label="Timezone" description="System timezone" value={config.timezone} type="text" onChange={(v) => updateField('timezone', v)} />
        <ConfigField label="Maintenance Mode" description="Put platform into maintenance mode (customers cannot access)" value={config.maintenance_mode} type="toggle" onChange={(v) => updateField('maintenance_mode', v)} />
      </div>
    </div>
  );
}
