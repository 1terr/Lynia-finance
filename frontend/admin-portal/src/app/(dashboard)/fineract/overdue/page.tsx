import dynamic from 'next/dynamic';

const OverdueLoansPage = dynamic(
  () => import('@/components/fineract/overdue-loans-page'),
  { ssr: false }
);

export default function Page() {
  return <OverdueLoansPage />;
}
