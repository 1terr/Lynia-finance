import dynamic from 'next/dynamic';

const ClientPage = dynamic(() => import('../customers/kyc-review/_client'), { ssr: false });

export default function Page() {
  return <ClientPage />;
}
