'use client';

import { Smartphone } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function LockUnlockPage() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'update' }}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Device Lock/Unlock</h1>
          <p className="mt-1 text-sm text-gray-500">
            Remotely control device lock status
          </p>
        </div>
        <div className="card flex flex-col items-center justify-center py-12">
          <Smartphone className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            Device lock controls will be available here
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
