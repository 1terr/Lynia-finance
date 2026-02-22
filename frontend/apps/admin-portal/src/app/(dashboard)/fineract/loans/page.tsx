'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const FineractLoansPage = dynamic(
  () => import('@/components/fineract/fineract-loans-page'),
  { ssr: false }
);

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'read' }}>
      <FineractLoansPage />
    </ProtectedRoute>
  );
}
