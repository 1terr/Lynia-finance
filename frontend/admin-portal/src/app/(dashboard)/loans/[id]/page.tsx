import { redirect } from 'next/navigation';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page({ params }: { params: { id: string } }) {
  redirect(`/loans/${params.id}/fineract`);
}
