'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getProduct } from '@/lib/api/products';
import { ProductWizard } from '@/components/products/product-wizard';

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-lg border border-border p-8 text-center">
        <p className="text-muted-foreground">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Loan Product</h1>
        <p className="text-sm text-muted-foreground">
          Update product parameters. Changes will be synced to Fineract core banking.
        </p>
      </div>
      <ProductWizard product={product} />
    </div>
  );
}
