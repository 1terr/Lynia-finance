import dynamic from 'next/dynamic';

const LoanProductsPage = dynamic(
  () => import('@/components/fineract/loan-products-page'),
  { ssr: false }
);

export default function Page() {
  return <LoanProductsPage />;
}
