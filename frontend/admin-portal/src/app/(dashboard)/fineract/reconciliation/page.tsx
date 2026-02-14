'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const ReconciliationDashboard = dynamic(
  () => import('@/components/fineract/reconciliation-dashboard'),
  { ssr: false }
);

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'payments', action: 'reconcile' }}>
      <ReconciliationDashboard />
    </ProtectedRoute>
  );
}
