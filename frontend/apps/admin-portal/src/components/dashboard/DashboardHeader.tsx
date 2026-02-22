'use client';

import { Bell } from 'lucide-react';

export function DashboardHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lynia Finance</h1>
          <p className="text-xs text-gray-500">Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-500">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
              <span className="text-xs font-semibold text-primary-700">AD</span>
            </div>
            <span className="text-sm font-medium text-gray-700">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
