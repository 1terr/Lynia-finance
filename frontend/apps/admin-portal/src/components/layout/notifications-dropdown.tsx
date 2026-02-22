'use client';

import { useRef, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsDropdown({ open, onClose }: NotificationsDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-card shadow-lg"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
      </div>
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <BellOff className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No notifications</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          You&apos;re all caught up. Notifications will appear here when available.
        </p>
      </div>
    </div>
  );
}
