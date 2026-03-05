'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProduct, updateProduct, deleteProduct, getProductLoansCount } from '@/lib/api/products';
import { ProductForm } from '@/components/products/product-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@lynia/utils';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { LoanProduct, CreateProductInput } from '@/types';

const STATUS_VARIANTS: Record<string, 'green' | 'gray' | 'blue'> = {
  active: 'green',
  inactive: 'gray',
  launching_soon: 'blue',
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: loansCountData, isFetching: loadingLoansCount } = useQuery({
    queryKey: ['product-loans-count', id],
    queryFn: () => getProductLoansCount(id),
    enabled: deleteOpen,
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LoanProduct>) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product updated successfully', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update product', description: error.message, variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product deleted successfully', variant: 'success' });
      router.push('/products');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete product', description: error.message, variant: 'error' });
    },
  });

  async function handleUpdate(data: CreateProductInput) {
    await updateMutation.mutateAsync(data);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-96 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Products
        </Button>
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-gray-500">Product not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{product.product_name}</h1>
            <Badge variant={STATUS_VARIANTS[product.status] || 'gray'}>
              {product.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-sm font-mono text-gray-500">{product.product_code}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Configuration</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Product Type" value={product.product_type.replace(/_/g, ' ')} />
            <Row label="Category" value={product.product_category} />
            <Row label="Amount Range" value={`${formatCurrency(product.min_amount_usd)} - ${formatCurrency(product.max_amount_usd)}`} />
            <Row label="Tenure Range" value={`${product.min_term_months} - ${product.max_term_months} months`} />
            <Row label="Monthly Interest Rate" value={`${product.interest_rate_monthly}%`} />
            <Row label="Annual Interest Rate" value={`${product.interest_rate_annual}%`} />
            <Row label="Max Active Loans" value={String(product.max_active_loans)} />
            {product.description && <Row label="Description" value={product.description} />}
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {product.product_category === 'smartphone' ? 'Smartphone Details' : 'Digital Loan Details'}
          </h2>
          <dl className="space-y-3 text-sm">
            {product.product_category === 'smartphone' ? (
              <>
                <Row label="Deposit Percentage" value={`${product.deposit_percentage}%`} />
                <Row label="Minimum Deposit" value={formatCurrency(product.min_deposit_usd)} />
                <Row label="Requires Device" value={product.requires_device ? 'Yes' : 'No'} />
              </>
            ) : (
              <>
                <Row label="Requires Org Verification" value={product.requires_organization_verification ? 'Yes' : 'No'} />
                <Row label="Deposit" value="0% (No deposit)" />
                <Row label="Disbursement Methods" value={
                  product.allowed_disbursement_methods.length > 0
                    ? product.allowed_disbursement_methods.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')
                    : 'None configured'
                } />
              </>
            )}
            <Row label="Display Order" value={String(product.display_order)} />
            {product.fineract_product_id != null && (
              <Row label="Fineract Product ID" value={String(product.fineract_product_id)} />
            )}
          </dl>
        </Card>
      </div>

      <ProductForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        product={product}
      />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Product" size="sm">
        <div className="space-y-4">
          {loadingLoansCount ? (
            <div className="h-8 animate-pulse rounded bg-gray-100" />
          ) : loansCountData && loansCountData.active_loans > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">
                This product has {loansCountData.active_loans} active loan{loansCountData.active_loans !== 1 ? 's' : ''}.
              </p>
              <p className="mt-1 text-sm text-red-600">
                You cannot delete a product with active loans. Please resolve all active loans first.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-medium">{product.product_name}</span>?
              This action cannot be undone.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              disabled={loadingLoansCount || (loansCountData?.active_loans ?? 0) > 0}
              onClick={() => deleteMutation.mutate()}
            >
              Delete Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 capitalize">{value}</dd>
    </div>
  );
}
