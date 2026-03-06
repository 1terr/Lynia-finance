'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@lynia/utils';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';

type ConfirmationVariant = 'destructive' | 'warning' | 'info';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  /** If set, user must type this string to enable the confirm button */
  confirmInput?: string;
  isLoading?: boolean;
}

const variantConfig: Record<ConfirmationVariant, {
  icon: typeof AlertTriangle;
  iconClass: string;
  bgClass: string;
  confirmVariant: 'danger' | 'primary';
}> = {
  destructive: {
    icon: AlertCircle,
    iconClass: 'text-red-600',
    bgClass: 'bg-red-50 dark:bg-red-950',
    confirmVariant: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50 dark:bg-yellow-950',
    confirmVariant: 'primary',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-600',
    bgClass: 'bg-blue-50 dark:bg-blue-950',
    confirmVariant: 'primary',
  },
};

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  confirmInput,
  isLoading = false,
}: ConfirmationDialogProps) {
  const [typedInput, setTypedInput] = useState('');
  const config = variantConfig[variant];
  const Icon = config.icon;

  const isConfirmEnabled = confirmInput
    ? typedInput === confirmInput
    : true;

  const handleConfirm = async () => {
    await onConfirm();
    setTypedInput('');
  };

  const handleClose = () => {
    if (isLoading) return;
    setTypedInput('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', config.bgClass)}>
          <Icon className={cn('h-6 w-6', config.iconClass)} />
        </div>

        <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>

        <div className="mt-2 text-sm text-muted-foreground">
          {description}
        </div>

        {confirmInput && (
          <div className="mt-4 w-full">
            <p className="mb-2 text-xs text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">{confirmInput}</span> to confirm
            </p>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={confirmInput}
              disabled={isLoading}
              autoFocus
            />
          </div>
        )}

        <div className="mt-6 flex w-full gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={config.confirmVariant}
            className="flex-1"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
