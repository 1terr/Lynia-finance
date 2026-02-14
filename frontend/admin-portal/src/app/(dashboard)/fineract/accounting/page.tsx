import dynamic from 'next/dynamic';

const GLAccountingDashboard = dynamic(
  () => import('@/components/fineract/gl-accounting-dashboard'),
  { ssr: false }
);

export default function Page() {
  return <GLAccountingDashboard />;
}
