'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@lynia/utils';
import { Pencil, Eye, Smartphone } from 'lucide-react';
import type { LoanProduct } from '@/types';

interface ProductCardProps {
  product: LoanProduct;
  onEdit: (product: LoanProduct) => void;
  onViewDetails: (product: LoanProduct) => void;
}

const STATUS_VARIANTS: Record<string, 'green' | 'gray' | 'blue'> = {
  active: 'green',
  inactive: 'gray',
  launching_soon: 'blue',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  launching_soon: 'Launching Soon',
};

export function ProductCard({ product, onEdit, onViewDetails }: ProductCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{product.product_name}</h3>
            <Badge variant={STATUS_VARIANTS[product.status] || 'gray'}>
              {STATUS_LABELS[product.status] || product.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs font-mono text-muted-foreground">{product.product_code}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Amount Range</p>
          <p className="font-medium">{formatCurrency(product.min_amount_usd)} - {formatCurrency(product.max_amount_usd)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Interest Rate</p>
          <p className="font-medium">{product.interest_rate_monthly}%/mo ({product.interest_rate_annual}%/yr)</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tenure</p>
          <p className="font-medium">{product.min_term_months} - {product.max_term_months} months</p>
        </div>
        {product.product_category === 'smartphone' && (
          <div>
            <p className="text-muted-foreground">Deposit</p>
            <p className="font-medium">{product.deposit_percentage}%</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {product.requires_device && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs text-blue-700">
            <Smartphone className="h-3 w-3" /> Requires Device
          </span>
        )}
        {product.requires_organization_verification && (
          <span className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
            Requires Org Verification
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" onClick={() => onEdit(product)}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onViewDetails(product)}>
          <Eye className="mr-1 h-3.5 w-3.5" /> View Details
        </Button>
      </div>
    </Card>
  );
}
