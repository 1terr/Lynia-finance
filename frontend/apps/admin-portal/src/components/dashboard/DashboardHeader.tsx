'use client';

import { Bell } from 'lucide-react';

export function DashboardHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lynia Finance</h1>
          <p className="text-xs text-muted-foreground">Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <button aria-label="Notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
              <span className="text-xs font-semibold text-primary-700">AD</span>
            </div>
            <span className="text-sm font-medium text-foreground">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
