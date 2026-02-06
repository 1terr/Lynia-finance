'use client';

import { Shield } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function KycReviewPage() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'kyc', action: 'read' }}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Review Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve customer KYC submissions
          </p>
        </div>
        <div className="card flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">
            KYC review queue will be available here
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
