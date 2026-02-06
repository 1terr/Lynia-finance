'use client';

import { Banknote } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function LoansPage() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'read' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage loan applications and portfolios
            </p>
          </div>
        </div>
        <div className="card flex flex-col items-center justify-center py-12">
          <Banknote className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            Loan management will be available here
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
