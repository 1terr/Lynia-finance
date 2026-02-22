'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const FineractApprovalPage = dynamic(
  () => import('@/components/fineract/fineract-approval-page'),
  { ssr: false }
);

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'approve' }}>
      <FineractApprovalPage />
    </ProtectedRoute>
  );
}
