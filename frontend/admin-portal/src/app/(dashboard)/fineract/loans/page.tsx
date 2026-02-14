import dynamic from 'next/dynamic';

const FineractLoansPage = dynamic(
  () => import('@/components/fineract/fineract-loans-page'),
  { ssr: false }
);

export default function Page() {
  return <FineractLoansPage />;
}
