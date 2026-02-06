'use client';

import { CreditCard } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function PaymentsPage() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'payments', action: 'read' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track and manage payment transactions
            </p>
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center py-12">
          <CreditCard className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            Payment tracking will be available here
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
