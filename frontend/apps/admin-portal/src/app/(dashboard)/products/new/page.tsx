'use client';

import { ProductWizard } from '@/components/products/product-wizard';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Loan Product</h1>
        <p className="text-sm text-muted-foreground">
          Configure all Fineract parameters and create the product in core banking.
        </p>
      </div>
      <ProductWizard />
    </div>
  );
}
