'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/lib/api/products';
import { ProductCard } from '@/components/products/product-card';
import { ProductForm } from '@/components/products/product-form';
import { ProductStats } from '@/components/products/product-stats';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/modal';
import { Plus } from 'lucide-react';
import type { LoanProduct, CreateProductInput, ProductCategory } from '@/types';

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LoanProduct | null>(null);

  const { data: smartphoneData, isLoading: loadingSmartphone } = useQuery({
    queryKey: ['products', 'smartphone'],
    queryFn: () => getProducts({ category: 'smartphone', limit: 100 }),
  });

  const { data: digitalData, isLoading: loadingDigital } = useQuery({
    queryKey: ['products', 'digital'],
    queryFn: () => getProducts({ category: 'digital', limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProductInput) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LoanProduct> }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    },
  });

  function handleEdit(product: LoanProduct) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function handleCreate() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  async function handleFormSubmit(data: CreateProductInput) {
    if (editingProduct) {
      await updateMutation.mutateAsync({ id: editingProduct.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  }

  function getStats(category: ProductCategory) {
    const data = category === 'smartphone' ? smartphoneData : digitalData;
    const products = data?.data || [];
    const active = products.filter((p) => p.status === 'active').length;
    const avgRate = products.length > 0
      ? products.reduce((sum, p) => sum + p.interest_rate_monthly, 0) / products.length
      : 0;
    return { activeProducts: active, totalLoans: 0, totalVolume: 0, avgInterestRate: avgRate };
  }

  function renderProductGrid(products: LoanProduct[], loading: boolean) {
    if (loading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg border bg-gray-100" />
          ))}
        </div>
      );
    }

    if (products.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">No products found. Create your first product to get started.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={handleEdit}
            onViewDetails={(p) => router.push(`/products/${p.id}`)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage loan products, device models, and organizations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/products/device-models')}>
            Device Models
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.push('/products/organizations')}>
            Organizations
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-1 h-4 w-4" /> Create Product
          </Button>
        </div>
      </div>

      <Tabs defaultValue="smartphone">
        <TabsList>
          <TabsTrigger value="smartphone">Smartphone Loans</TabsTrigger>
          <TabsTrigger value="digital">Digital Loans</TabsTrigger>
        </TabsList>

        <TabsContent value="smartphone">
          <div className="space-y-6">
            <ProductStats {...getStats('smartphone')} />
            {renderProductGrid(smartphoneData?.data || [], loadingSmartphone)}
          </div>
        </TabsContent>

        <TabsContent value="digital">
          <div className="space-y-6">
            <ProductStats {...getStats('digital')} />
            {renderProductGrid(digitalData?.data || [], loadingDigital)}
          </div>
        </TabsContent>
      </Tabs>

      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        product={editingProduct}
      />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Product" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-medium">{deleteTarget?.product_name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
