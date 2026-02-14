'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const FineractLoanDetailPage = dynamic(
  () => import('@/components/fineract/fineract-loan-detail-page'),
  { ssr: false }
);

export default function Page() {
  const params = useParams();
  const id = params.id as string;

  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'read' }}>
      <FineractLoanDetailPage loanId={id} />
    </ProtectedRoute>
  );
}
