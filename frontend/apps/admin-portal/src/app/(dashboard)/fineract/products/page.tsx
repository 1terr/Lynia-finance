'use client';

import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const LoanProductsPage = dynamic(
  () => import('@/components/fineract/loan-products-page'),
  { ssr: false }
);

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'read' }}>
      <LoanProductsPage />
    </ProtectedRoute>
  );
}
