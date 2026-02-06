'use client';

import type { DeviceCondition, ConditionRating } from '@/types/distributor';
import { ACCESSORY_OPTIONS } from '@/types/distributor';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Monitor, Battery, Box, Headphones } from 'lucide-react';

interface Props {
  condition: DeviceCondition;
  onUpdate: (c: DeviceCondition) => void;
}

const CONDITION_RATINGS: { value: ConditionRating; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'bg-green-500' },
  { value: 'good', label: 'Good', color: 'bg-blue-500' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-500' },
  { value: 'poor', label: 'Poor', color: 'bg-red-500' },
];

function RatingPicker({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  value: ConditionRating;
  onChange: (v: ConditionRating) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex gap-1.5">
        {CONDITION_RATINGS.map((r) => (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-[10px] font-medium border-2 transition-all',
              value === r.value
                ? `${r.color} text-white border-transparent`
                : 'border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoolToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2.5 transition-colors w-full',
        value
          ? 'border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
          : 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800',
      )}
    >
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
      )}
      <span className="text-xs font-medium flex-1 text-left">{label}</span>
      <span
        className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded',
          value ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900' : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900',
        )}
      >
        {value ? 'PASS' : 'FAIL'}
      </span>
    </button>
  );
}

export function StepDeviceCondition({ condition, onUpdate }: Props) {
  const set = <K extends keyof DeviceCondition>(key: K, val: DeviceCondition[K]) =>
    onUpdate({ ...condition, [key]: val });

  const toggleAccessory = (acc: string) => {
    const list = condition.accessories_included.includes(acc)
      ? condition.accessories_included.filter((a) => a !== acc)
      : [...condition.accessories_included, acc];
    set('accessories_included', list);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Inspect the device and record its condition before handover.
      </p>

      {/* Physical condition */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Physical Condition
        </h3>
        <RatingPicker
          label="Screen Condition"
          icon={Monitor}
          value={condition.screen_condition}
          onChange={(v) => set('screen_condition', v)}
        />
        <RatingPicker
          label="Body Condition"
          icon={Box}
          value={condition.body_condition}
          onChange={(v) => set('body_condition', v)}
        />
      </div>

      {/* Functionality checks */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Functionality Checks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <BoolToggle label="Powers On" value={condition.powers_on} onChange={(v) => set('powers_on', v)} />
          <BoolToggle label="Touch Responsive" value={condition.touch_responsive} onChange={(v) => set('touch_responsive', v)} />
          <BoolToggle label="Buttons Work" value={condition.buttons_functional} onChange={(v) => set('buttons_functional', v)} />
          <BoolToggle label="Ports Work" value={condition.ports_functional} onChange={(v) => set('ports_functional', v)} />
          <BoolToggle label="Cameras Work" value={condition.cameras_functional} onChange={(v) => set('cameras_functional', v)} />
          <BoolToggle label="Wi-Fi Works" value={condition.wifi_works} onChange={(v) => set('wifi_works', v)} />
          <BoolToggle label="Cellular Works" value={condition.cellular_works} onChange={(v) => set('cellular_works', v)} />
          <BoolToggle label="Calls Work" value={condition.calls_work} onChange={(v) => set('calls_work', v)} />
        </div>
      </div>

      {/* Accessories */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Headphones className="h-3.5 w-3.5" /> Accessories Included
        </h3>
        <div className="flex flex-wrap gap-2">
          {ACCESSORY_OPTIONS.map((acc) => (
            <button
              key={acc}
              onClick={() => toggleAccessory(acc)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize',
                condition.accessories_included.includes(acc)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40',
              )}
            >
              {acc.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Additional Notes (optional)
        </label>
        <textarea
          value={condition.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Any additional observations about the device..."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          rows={3}
        />
      </div>

      {/* Summary */}
      {!condition.powers_on && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
          <p className="text-xs text-red-700 dark:text-red-400 font-medium">
            Device must power on to proceed with handover.
          </p>
        </div>
      )}
    </div>
  );
}
