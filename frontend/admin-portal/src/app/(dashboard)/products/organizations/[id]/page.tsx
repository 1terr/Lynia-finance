import dynamic from 'next/dynamic';

const ClientPage = dynamic(() => import('./_client'), { ssr: false });

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <ClientPage />;
}
