'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const GLAccountingDashboard = dynamic(
  () => import('@/components/fineract/gl-accounting-dashboard'),
  { ssr: false }
);

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'payments', action: 'read' }}>
      <GLAccountingDashboard />
    </ProtectedRoute>
  );
}
