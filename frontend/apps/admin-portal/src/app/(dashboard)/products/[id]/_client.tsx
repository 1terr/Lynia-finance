'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProduct, deleteProduct, getProductLoansCount,
  getDeviceModels, linkDeviceModels, unlinkDeviceModel,
  type LinkedDeviceModel,
} from '@/lib/api/products';
import { createFineractProductFromLynia } from '@/lib/api/fineract';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@lynia/utils';
import { ArrowLeft, Pencil, Trash2, Plus, X, Check, Circle, Link2, Smartphone, Database as DatabaseIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouteId } from '@/hooks/use-route-id';
import type { LoanProduct, DeviceModel } from '@/types';

const STATUS_VARIANTS: Record<string, 'green' | 'gray' | 'blue'> = {
  active: 'green',
  inactive: 'gray',
  launching_soon: 'blue',
};

// Extended product type with linked models from the API
interface ProductWithLinks extends LoanProduct {
  linked_device_models?: LinkedDeviceModel[];
  in_stock_device_count?: number;
}

export default function ProductDetailPage() {
  const id = useRouteId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const { data: loansCountData, isFetching: loadingLoansCount } = useQuery({
    queryKey: ['product-loans-count', id],
    queryFn: () => getProductLoansCount(id),
    enabled: deleteOpen,
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id) as Promise<ProductWithLinks | null>,
  });

  // Fetch all device models for linking modal
  const { data: allModelsData } = useQuery({
    queryKey: ['device-models', { limit: 200 }],
    queryFn: () => getDeviceModels({ limit: 200 }),
    enabled: linkModalOpen,
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

  const linkMutation = useMutation({
    mutationFn: (modelIds: string[]) => linkDeviceModels(id, modelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast({ title: 'Device models linked successfully', variant: 'success' });
      setLinkModalOpen(false);
      setSelectedModels([]);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to link device models', description: error.message, variant: 'error' });
    },
  });

  const fineractCreateMutation = useMutation({
    mutationFn: () => createFineractProductFromLynia(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast({ title: `Core banking product created (ID: ${data.fineract_product_id})`, variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create core banking product', description: error.message, variant: 'error' });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (modelId: string) => unlinkDeviceModel(id, modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast({ title: 'Device model unlinked', variant: 'success' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to unlink device model', description: error.message, variant: 'error' });
    },
  });

  function toggleModelSelection(modelId: string) {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  }

  // Filter out already-linked models from the link modal
  const linkedIds = new Set((product?.linked_device_models || []).map((m) => m.device_model_id));
  const availableModels = (allModelsData?.data || []).filter((m: DeviceModel) => !linkedIds.has(m.id) && m.is_active);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Products
        </Button>
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-muted-foreground">Product not found.</p>
        </div>
      </div>
    );
  }

  // Setup checklist items
  const isSmartphone = product.product_category === 'smartphone';
  const linkedModels = product.linked_device_models || [];
  const inStockCount = product.in_stock_device_count || 0;

  const checklistItems = [
    { label: 'Product created', done: true },
    { label: 'Core banking product linked', done: product.fineract_product_id != null },
    ...(isSmartphone ? [
      { label: 'Phone models assigned', done: linkedModels.length > 0 },
      { label: 'Physical devices in stock', done: inStockCount > 0 },
    ] : []),
  ];
  const completedCount = checklistItems.filter((i) => i.done).length;
  const allComplete = completedCount === checklistItems.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{product.product_name}</h1>
            <Badge variant={STATUS_VARIANTS[product.status] || 'gray'}>
              {product.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-sm font-mono text-muted-foreground">{product.product_code}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/products/${id}/edit`)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Setup Checklist */}
      <Card className={`p-4 ${allComplete ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Product Setup {allComplete ? '- Ready' : `- ${completedCount}/${checklistItems.length} complete`}
          </h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${allComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {allComplete ? 'All set' : 'Setup incomplete'}
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          {checklistItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-gray-300" />
              )}
              <span className={item.done ? 'text-green-700' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        {product.fineract_product_id == null && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fineractCreateMutation.mutate()}
              isLoading={fineractCreateMutation.isPending}
            >
              <DatabaseIcon className="mr-1 h-3.5 w-3.5" /> Create in Core Banking
            </Button>
            <span className="ml-2 text-xs text-muted-foreground">
              Auto-creates a matching loan product in core banking.
            </span>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Product Configuration</h2>
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
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {isSmartphone ? 'Smartphone Details' : 'Digital Loan Details'}
          </h2>
          <dl className="space-y-3 text-sm">
            {isSmartphone ? (
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
            <Row
              label="Core Banking Product"
              value={product.fineract_product_id != null ? `Linked (ID: ${product.fineract_product_id})` : 'Not linked'}
            />
          </dl>
        </Card>
      </div>

      {/* Compatible Phone Models (smartphone products only) */}
      {isSmartphone && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Compatible Phone Models</h2>
              <p className="text-sm text-muted-foreground">
                Only these phone models will be available for customers applying under this product.
              </p>
            </div>
            <Button size="sm" onClick={() => setLinkModalOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Models
            </Button>
          </div>

          {linkedModels.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-8 text-center">
              <Smartphone className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-muted-foreground">No phone models linked yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Without linked models, customers will see ALL active models during loan application.
              </p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setLinkModalOpen(true)}>
                <Link2 className="mr-1 h-3.5 w-3.5" /> Link Phone Models
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedModels.map((model) => (
                <div key={model.device_model_id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {model.brand} {model.model_name}
                        {model.storage_gb ? ` (${model.storage_gb}GB)` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{model.model_code}</span>
                        {' \u00b7 '}
                        Retail: {formatCurrency(model.retail_price_usd)}
                        {' \u00b7 '}
                        Stock: <span className={model.available_stock === 0 ? 'text-red-600 font-medium' : ''}>{model.available_stock}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={model.is_active ? 'green' : 'gray'}>
                      {model.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unlinkMutation.mutate(model.device_model_id)}
                      disabled={unlinkMutation.isPending}
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                {linkedModels.length} model{linkedModels.length !== 1 ? 's' : ''} linked
                {' \u00b7 '}
                {inStockCount} device{inStockCount !== 1 ? 's' : ''} in stock
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Link Device Models Modal */}
      <Modal open={linkModalOpen} onClose={() => { setLinkModalOpen(false); setSelectedModels([]); }} title="Link Phone Models" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select phone models to make available under this loan product.
          </p>
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {availableModels.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                All active phone models are already linked to this product.
              </p>
            ) : (
              availableModels.map((model: DeviceModel) => {
                const selected = selectedModels.includes(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModelSelection(model.id)}
                    className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected ? 'border-brand-500 bg-brand-50' : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {model.brand} {model.model_name}
                        {model.storage_gb ? ` (${model.storage_gb}GB)` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Retail: {formatCurrency(model.retail_price_usd)}
                        {' \u00b7 '}
                        Wholesale: {formatCurrency(model.wholesale_price_usd)}
                        {' \u00b7 '}
                        Stock: {model.available_stock}
                      </p>
                    </div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                      selected ? 'border-brand-500 bg-brand-500' : 'border-border'
                    }`}>
                      {selected && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex justify-between items-center border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setLinkModalOpen(false); setSelectedModels([]); }}>
                Cancel
              </Button>
              <Button
                onClick={() => linkMutation.mutate(selectedModels)}
                disabled={selectedModels.length === 0}
                isLoading={linkMutation.isPending}
              >
                Link {selectedModels.length > 0 ? `${selectedModels.length} Model${selectedModels.length !== 1 ? 's' : ''}` : 'Models'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Product" size="sm">
        <div className="space-y-4">
          {loadingLoansCount ? (
            <div className="h-8 animate-pulse rounded bg-muted" />
          ) : loansCountData && loansCountData.active_loans > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 p-3">
              <p className="text-sm font-medium text-red-800">
                This product has {loansCountData.active_loans} active loan{loansCountData.active_loans !== 1 ? 's' : ''}.
              </p>
              <p className="mt-1 text-sm text-red-600">
                You cannot delete a product with active loans. Please resolve all active loans first.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
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
    <div className="flex justify-between border-b border-border pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground capitalize">{value}</dd>
    </div>
  );
}
