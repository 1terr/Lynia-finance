import dynamic from 'next/dynamic';

const ReconciliationDashboard = dynamic(
  () => import('@/components/fineract/reconciliation-dashboard'),
  { ssr: false }
);

export default function Page() {
  return <ReconciliationDashboard />;
}
