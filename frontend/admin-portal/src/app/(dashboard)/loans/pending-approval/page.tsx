'use client';

import { Banknote } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function PendingApprovalPage() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'update' }}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Approval</h1>
          <p className="mt-1 text-sm text-gray-500">
            Loan applications awaiting approval
          </p>
        </div>
        <div className="card flex flex-col items-center justify-center py-12">
          <Banknote className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            Pending loan approvals will be available here
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
