'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const OverdueLoansPage = dynamic(
  () => import('@/components/fineract/overdue-loans-page'),
  { ssr: false }
);

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'read' }}>
      <OverdueLoansPage />
    </ProtectedRoute>
  );
}
