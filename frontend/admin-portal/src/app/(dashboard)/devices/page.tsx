'use client';

import { Smartphone } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function DevicesPage() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'read' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Device Inventory</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track and manage device stock
            </p>
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center py-12">
          <Smartphone className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            Device inventory will be available here
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
