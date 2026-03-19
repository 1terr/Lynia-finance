'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { LoanProduct, CreateProductInput, ProductCategory, ProductStatus } from '@/types';

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProductInput) => Promise<void>;
  product?: LoanProduct | null;
}

const CATEGORY_OPTIONS = [
  { value: 'smartphone', label: 'Smartphone' },
  { value: 'digital', label: 'Digital' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'launching_soon', label: 'Launching Soon' },
];

const DISBURSEMENT_OPTIONS = ['ecocash', 'onemoney', 'innbucks'] as const;

const PRODUCT_CODE_REGEX = /^[A-Za-z0-9_]{1,50}$/;

interface FormErrors {
  [key: string]: string;
}

export function ProductForm({ open, onClose, onSubmit, product }: ProductFormProps) {
  const isEditing = !!product;
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [category, setCategory] = useState<ProductCategory>('smartphone');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [minTerm, setMinTerm] = useState('');
  const [maxTerm, setMaxTerm] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [depositPct, setDepositPct] = useState('');
  const [minDeposit, setMinDeposit] = useState('');
  const [maxActiveLoans, setMaxActiveLoans] = useState('1');
  const [description, setDescription] = useState('');
  const [requiresOrgVerification, setRequiresOrgVerification] = useState(false);
  const [disbursementMethods, setDisbursementMethods] = useState<string[]>([]);

  useEffect(() => {
    if (product) {
      setCategory(product.product_category);
      setCode(product.product_code);
      setName(product.product_name);
      setStatus(product.status);
      setMinAmount(String(product.min_amount_usd));
      setMaxAmount(String(product.max_amount_usd));
      setMinTerm(String(product.min_term_months));
      setMaxTerm(String(product.max_term_months));
      setMonthlyRate(String(product.interest_rate_monthly));
      setAnnualRate(String(product.interest_rate_annual));
      setDepositPct(String(product.deposit_percentage));
      setMinDeposit(String(product.min_deposit_usd));
      setMaxActiveLoans(String(product.max_active_loans));
      setDescription(product.description || '');
      setRequiresOrgVerification(product.requires_organization_verification);
      setDisbursementMethods(product.allowed_disbursement_methods || []);
    } else {
      resetForm();
    }
  }, [product, open]);

  function resetForm() {
    setCategory('smartphone');
    setCode('');
    setName('');
    setStatus('active');
    setMinAmount('');
    setMaxAmount('');
    setMinTerm('');
    setMaxTerm('');
    setMonthlyRate('');
    setAnnualRate('');
    setDepositPct('10');
    setMinDeposit('0');
    setMaxActiveLoans('1');
    setDescription('');
    setRequiresOrgVerification(false);
    setDisbursementMethods([]);
    setErrors({});
  }

  function handleMonthlyRateChange(value: string) {
    setMonthlyRate(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setAnnualRate(String(Math.round(num * 12 * 100) / 100));
    }
  }

  function handleAnnualRateChange(value: string) {
    setAnnualRate(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setMonthlyRate(String(Math.round((num / 12) * 100) / 100));
    }
  }

  function toggleDisbursement(method: string) {
    setDisbursementMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) newErrors.name = 'Product name is required';
    if (!code.trim()) newErrors.code = 'Product code is required';
    else if (!PRODUCT_CODE_REGEX.test(code)) newErrors.code = 'Code must be 1-50 alphanumeric characters or underscores';

    const minAmt = parseFloat(minAmount);
    const maxAmt = parseFloat(maxAmount);
    if (isNaN(minAmt) || minAmt < 0) newErrors.minAmount = 'Valid min amount required';
    if (isNaN(maxAmt) || maxAmt < 0) newErrors.maxAmount = 'Valid max amount required';
    if (!isNaN(minAmt) && !isNaN(maxAmt) && minAmt >= maxAmt) {
      newErrors.minAmount = 'Min amount must be less than max amount';
    }

    const minT = parseInt(minTerm);
    const maxT = parseInt(maxTerm);
    if (isNaN(minT) || minT < 1) newErrors.minTerm = 'Valid min tenure required';
    if (isNaN(maxT) || maxT < 1) newErrors.maxTerm = 'Valid max tenure required';
    if (!isNaN(minT) && !isNaN(maxT) && minT >= maxT) {
      newErrors.minTerm = 'Min tenure must be less than max tenure';
    }

    const mRate = parseFloat(monthlyRate);
    if (isNaN(mRate) || mRate <= 0) newErrors.monthlyRate = 'Interest rate must be greater than 0';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data: CreateProductInput = {
        product_code: code,
        product_name: name,
        short_name: code.slice(0, 4).toUpperCase(),
        product_type: category === 'smartphone' ? 'asset_financing' : 'digital_credit',
        product_category: category,
        status,
        default_principal: parseFloat(minAmount),
        number_of_repayments: parseInt(minTerm),
        min_amount_usd: parseFloat(minAmount),
        max_amount_usd: parseFloat(maxAmount),
        min_term_months: parseInt(minTerm),
        max_term_months: parseInt(maxTerm),
        interest_rate_monthly: parseFloat(monthlyRate),
        interest_rate_annual: parseFloat(annualRate),
        deposit_percentage: category === 'smartphone' ? parseFloat(depositPct) || 0 : 0,
        min_deposit_usd: category === 'smartphone' ? parseFloat(minDeposit) || 0 : 0,
        requires_device: category === 'smartphone',
        requires_organization_verification: category === 'digital' ? requiresOrgVerification : false,
        allowed_disbursement_methods: category === 'digital' ? disbursementMethods : [],
        max_active_loans: parseInt(maxActiveLoans) || 1,
        description: description || undefined,
      };
      await onSubmit(data);
      onClose();
    } catch (error) {
      toast({
        title: isEditing ? 'Failed to update product' : 'Failed to create product',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Product' : 'Create Product'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category"
            id="category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            disabled={isEditing}
          />
          <Select
            label="Status"
            id="status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductStatus)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Product Name"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="e.g. Smartphone Finance Tier 1"
          />
          <Input
            label="Product Code"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            error={errors.code}
            placeholder="e.g. SMRT_FIN_001"
            disabled={isEditing}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min Amount (USD)"
            id="minAmount"
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            error={errors.minAmount}
            min="0"
            step="0.01"
          />
          <Input
            label="Max Amount (USD)"
            id="maxAmount"
            type="number"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            error={errors.maxAmount}
            min="0"
            step="0.01"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min Tenure (months)"
            id="minTerm"
            type="number"
            value={minTerm}
            onChange={(e) => setMinTerm(e.target.value)}
            error={errors.minTerm}
            min="1"
          />
          <Input
            label="Max Tenure (months)"
            id="maxTerm"
            type="number"
            value={maxTerm}
            onChange={(e) => setMaxTerm(e.target.value)}
            error={errors.maxTerm}
            min="1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Interest Rate / Month (%)"
            id="monthlyRate"
            type="number"
            value={monthlyRate}
            onChange={(e) => handleMonthlyRateChange(e.target.value)}
            error={errors.monthlyRate}
            min="0"
            step="0.01"
          />
          <Input
            label="Interest Rate / Year (%)"
            id="annualRate"
            type="number"
            value={annualRate}
            onChange={(e) => handleAnnualRateChange(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        {category === 'smartphone' && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Deposit Percentage (%)"
              id="depositPct"
              type="number"
              value={depositPct}
              onChange={(e) => setDepositPct(e.target.value)}
              min="0"
              max="100"
              step="0.1"
            />
            <Input
              label="Minimum Deposit (USD)"
              id="minDeposit"
              type="number"
              value={minDeposit}
              onChange={(e) => setMinDeposit(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
        )}

        {category === 'digital' && (
          <>
            <fieldset>
              <legend className="block text-sm font-medium text-foreground mb-2">Disbursement Methods</legend>
              <div className="flex gap-3">
                {DISBURSEMENT_OPTIONS.map((method) => (
                  <label key={method} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={disbursementMethods.includes(method)}
                      onChange={() => toggleDisbursement(method)}
                      className="rounded border-border"
                    />
                    <span className="capitalize">{method}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requiresOrgVerification}
                onChange={(e) => setRequiresOrgVerification(e.target.checked)}
                className="rounded border-border"
              />
              <span>Requires Organization Verification</span>
            </label>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Max Active Loans"
            id="maxActiveLoans"
            type="number"
            value={maxActiveLoans}
            onChange={(e) => setMaxActiveLoans(e.target.value)}
            min="1"
          />
        </div>

        {isEditing && product && (
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            product.fineract_product_id
              ? 'border-green-200 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
              : 'border-amber-200 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
          }`}>
            {product.fineract_product_id ? (
              <>
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>Synced to Fineract (Product #{product.fineract_product_id})</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Not yet synced to Fineract. Saving will attempt auto-sync.</span>
              </>
            )}
          </div>
        )}
        {!isEditing && (
          <p className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
            A corresponding Fineract core banking product will be created automatically on save.
          </p>
        )}

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Product description..."
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            {isEditing ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
