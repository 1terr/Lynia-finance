'use client';

import { Users } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function CustomersPage() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'customers', action: 'read' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage customer profiles and applications
            </p>
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            Customer management will be available here
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
