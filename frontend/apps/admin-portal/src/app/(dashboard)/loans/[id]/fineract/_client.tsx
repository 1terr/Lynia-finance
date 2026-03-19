'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useRouteId } from '@/hooks/use-route-id';

const FineractLoanDetailPage = dynamic(
  () => import('@/components/fineract/fineract-loan-detail-page'),
  { ssr: false }
);

export default function FineractLoanDetailClient() {
  const id = useRouteId();

  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'read' }}>
      <FineractLoanDetailPage loanId={id} />
    </ProtectedRoute>
  );
}
