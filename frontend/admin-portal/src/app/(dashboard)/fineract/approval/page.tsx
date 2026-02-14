import dynamic from 'next/dynamic';

const FineractApprovalPage = dynamic(
  () => import('@/components/fineract/fineract-approval-page'),
  { ssr: false }
);

export default function Page() {
  return <FineractApprovalPage />;
}
