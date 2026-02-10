import dynamic from 'next/dynamic';

const ClientPage = dynamic(() => import('./_client'), { ssr: false });

export default function Page() {
  return <ClientPage />;
}
