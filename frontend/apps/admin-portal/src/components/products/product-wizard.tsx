'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGLAccounts, getAccountsForField } from '@/hooks/use-gl-accounts';
import { createProduct, updateProduct, getProductFineractDefaults, getOrganizations, linkOrganizations } from '@/lib/api/products';
import { ChevronLeft, ChevronRight, Check, Loader2, AlertTriangle } from 'lucide-react';
import { FeeSimulationPreview } from '@/components/products/fee-simulation-preview';
import type {
  LoanProduct,
  CreateProductInput,
  ProductCategory,
  ProductStatus,
  GLAccount,
  FineractProductDefaults,
  Organization,
} from '@/types';
import {
  AMORTIZATION_TYPES,
  INTEREST_TYPES,
  FREQUENCY_TYPES,
  INTEREST_CALCULATION_PERIOD_TYPES,
  ACCOUNTING_RULES,
  TRANSACTION_STRATEGIES,
  INTEREST_RECALC_COMPOUNDING_METHODS,
  RESCHEDULE_STRATEGY_METHODS,
  RECALCULATION_FREQUENCY_TYPES,
  PRE_CLOSURE_INTEREST_STRATEGIES,
} from '@/types';

// ─── Props ───

interface ProductWizardProps {
  product?: LoanProduct | null; // null = create mode
}

// ─── Step definitions ───

const STEPS = [
  { id: 1, title: 'Basic Information', description: 'Product identity and currency' },
  { id: 2, title: 'Loan Terms', description: 'Principal, repayment, and interest' },
  { id: 3, title: 'Accounting & Review', description: 'GL mappings and confirmation' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'smartphone', label: 'Smartphone' },
  { value: 'digital', label: 'Digital' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'launching_soon', label: 'Launching Soon' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'ZWL', label: 'ZWL - Zimbabwe Dollar' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
];

const DISBURSEMENT_OPTIONS = ['ecocash', 'onemoney', 'innbucks'] as const;

const PRODUCT_CODE_REGEX = /^[A-Za-z0-9_]{1,50}$/;
const SHORT_NAME_REGEX = /^[A-Za-z0-9]{1,4}$/;

interface FormErrors {
  [key: string]: string;
}

// ─── GL Account Dropdown ───

function GLAccountSelect({
  label,
  field,
  value,
  onChange,
  grouped,
  error,
}: {
  label: string;
  field: string;
  value: number | null;
  onChange: (value: number | null) => void;
  grouped: Record<string, GLAccount[]>;
  error?: string;
}) {
  const accounts = getAccountsForField(grouped, field);
  const options = accounts.map((a) => ({
    value: String(a.id),
    label: `${a.glCode} - ${a.name}`,
  }));

  return (
    <Select
      label={label}
      id={field}
      options={options}
      value={value ? String(value) : ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder="Select account..."
      error={error}
    />
  );
}

// ─── Main Component ───

export function ProductWizard({ product }: ProductWizardProps) {
  const isEditing = !!product;
  const router = useRouter();
  const { toast } = useToast();
  const { grouped, isLoading: loadingGL } = useGLAccounts();

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch defaults for new products
  const { data: defaults } = useQuery({
    queryKey: ['fineract-defaults'],
    queryFn: getProductFineractDefaults,
    enabled: !isEditing,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch active organizations for org verification picker
  const { data: orgsData } = useQuery({
    queryKey: ['organizations', { limit: 100, is_active: true }],
    queryFn: () => getOrganizations({ limit: 100, is_active: true }),
    staleTime: 5 * 60 * 1000,
  });
  const allOrgs: Organization[] = orgsData?.data || [];

  // ─── Form state ───
  // Step 1: Basic Info
  const [category, setCategory] = useState<ProductCategory>('smartphone');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [description, setDescription] = useState('');

  // Step 2: Loan Terms
  const [defaultPrincipal, setDefaultPrincipal] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [numRepayments, setNumRepayments] = useState('');
  const [minTerm, setMinTerm] = useState('');
  const [maxTerm, setMaxTerm] = useState('');
  const [repaymentEvery, setRepaymentEvery] = useState('1');
  const [repaymentFreqType, setRepaymentFreqType] = useState('2');
  const [interestRate, setInterestRate] = useState('');
  const [minInterestRate, setMinInterestRate] = useState('');
  const [maxInterestRate, setMaxInterestRate] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [interestRateFreqType, setInterestRateFreqType] = useState('2');
  const [minCreditScore, setMinCreditScore] = useState('350');
  const [maxCreditScore, setMaxCreditScore] = useState('850');
  const [amortizationType, setAmortizationType] = useState('0');
  const [interestType, setInterestType] = useState('0');
  const [interestCalcPeriod, setInterestCalcPeriod] = useState('1');
  const [txnStrategy, setTxnStrategy] = useState('mifos-standard-strategy');
  const [daysInYearType, setDaysInYearType] = useState('365');
  const [daysInMonthType, setDaysInMonthType] = useState('30');
  const [isInterestRecalcEnabled, setIsInterestRecalcEnabled] = useState(false);
  // Interest recalculation settings (visible only when isInterestRecalcEnabled is true)
  const [recalcCompoundingMethod, setRecalcCompoundingMethod] = useState('0');
  const [rescheduleStrategy, setRescheduleStrategy] = useState('1');
  const [recalcRestFreqType, setRecalcRestFreqType] = useState('1');
  const [recalcRestFreqInterval, setRecalcRestFreqInterval] = useState('1');
  const [recalcCompoundingFreqType, setRecalcCompoundingFreqType] = useState('1');
  const [recalcCompoundingFreqInterval, setRecalcCompoundingFreqInterval] = useState('1');
  const [arrearsOnOriginalSchedule, setArrearsOnOriginalSchedule] = useState(false);
  const [preClosureStrategy, setPreClosureStrategy] = useState('1');
  const [allowCompoundingOnEod, setAllowCompoundingOnEod] = useState(false);
  // Lynia-specific
  const [depositPct, setDepositPct] = useState('10');
  const [minDeposit, setMinDeposit] = useState('0');
  const [maxActiveLoans, setMaxActiveLoans] = useState('1');
  const [requiresOrgVerification, setRequiresOrgVerification] = useState(false);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [disbursementMethods, setDisbursementMethods] = useState<string[]>([]);

  // Fee Configuration (Migration 049)
  const [insuranceFeeType, setInsuranceFeeType] = useState<'none' | 'percentage' | 'flat'>('none');
  const [insuranceFeePercentage, setInsuranceFeePercentage] = useState('0');
  const [insuranceFeeFlatUsd, setInsuranceFeeFlatUsd] = useState('0');
  const [insuranceFeeFrequency, setInsuranceFeeFrequency] = useState<'upfront' | 'monthly'>('upfront');
  const [latePenaltyType, setLatePenaltyType] = useState<'none' | 'percentage' | 'flat'>('none');
  const [latePenaltyPercentage, setLatePenaltyPercentage] = useState('0');
  const [latePenaltyFlatUsd, setLatePenaltyFlatUsd] = useState('0');
  const [latePenaltyGraceDays, setLatePenaltyGraceDays] = useState('3');

  // Step 3: Accounting
  const [accountingRule, setAccountingRule] = useState('3');
  const [glAccounts, setGLAccounts] = useState<Record<string, number | null>>({
    fund_source_account_id: null,
    loan_portfolio_account_id: null,
    transfers_in_suspense_account_id: null,
    interest_on_loan_account_id: null,
    income_from_fee_account_id: null,
    income_from_penalty_account_id: null,
    write_off_account_id: null,
    overpayment_liability_account_id: null,
    receivable_interest_account_id: null,
    receivable_fee_account_id: null,
    receivable_penalty_account_id: null,
    income_from_recovery_account_id: null,
  });

  // Initialize from defaults or existing product
  useEffect(() => {
    if (product) {
      // Edit mode: populate from existing product
      setCategory(product.product_category);
      setStatus(product.status);
      setCode(product.product_code);
      setName(product.product_name);
      setShortName(product.short_name || '');
      setCurrencyCode(product.currency_code || 'USD');
      setDescription(product.description || '');
      setDefaultPrincipal(String(product.default_principal || ''));
      setMinAmount(String(product.min_amount_usd));
      setMaxAmount(String(product.max_amount_usd));
      setNumRepayments(String(product.number_of_repayments || product.max_term_months));
      setMinTerm(String(product.min_term_months));
      setMaxTerm(String(product.max_term_months));
      setRepaymentEvery(String(product.repayment_every || 1));
      setRepaymentFreqType(String(product.repayment_frequency_type ?? 2));
      setInterestRate(String(product.interest_rate_monthly));
      setAnnualRate(String(product.interest_rate_annual));
      setMinInterestRate(product.min_interest_rate != null ? String(product.min_interest_rate) : '');
      setMaxInterestRate(product.max_interest_rate != null ? String(product.max_interest_rate) : '');
      setInterestRateFreqType(String(product.interest_rate_frequency_type ?? 2));
      setAmortizationType(String(product.amortization_type ?? 0));
      setInterestType(String(product.interest_type ?? 0));
      setInterestCalcPeriod(String(product.interest_calculation_period_type ?? 1));
      setTxnStrategy(product.transaction_processing_strategy || 'mifos-standard-strategy');
      setDaysInYearType(String(product.days_in_year_type ?? 365));
      setDaysInMonthType(String(product.days_in_month_type ?? 30));
      setIsInterestRecalcEnabled(product.is_interest_recalculation_enabled ?? false);
      setRecalcCompoundingMethod(String(product.interest_recalculation_compounding_method ?? 0));
      setRescheduleStrategy(String(product.reschedule_strategy_method ?? 1));
      setRecalcRestFreqType(String(product.recalculation_rest_frequency_type ?? 1));
      setRecalcRestFreqInterval(String(product.recalculation_rest_frequency_interval ?? 1));
      setRecalcCompoundingFreqType(String(product.recalculation_compounding_frequency_type ?? 1));
      setRecalcCompoundingFreqInterval(String(product.recalculation_compounding_frequency_interval ?? 1));
      setArrearsOnOriginalSchedule(product.is_arrears_based_on_original_schedule ?? false);
      setPreClosureStrategy(String(product.pre_closure_interest_calculation_strategy ?? 1));
      setAllowCompoundingOnEod(product.allow_compounding_on_eod ?? false);
      setDepositPct(String(product.deposit_percentage));
      setMinDeposit(String(product.min_deposit_usd));
      setMaxActiveLoans(String(product.max_active_loans));
      setRequiresOrgVerification(product.requires_organization_verification);
      setDisbursementMethods(product.allowed_disbursement_methods || []);
      // Fee Configuration (Migration 049)
      setInsuranceFeeType(product.insurance_fee_type || 'none');
      setInsuranceFeePercentage(String(product.insurance_fee_percentage ?? 0));
      setInsuranceFeeFlatUsd(String(product.insurance_fee_flat_usd ?? 0));
      setInsuranceFeeFrequency(product.insurance_fee_frequency || 'upfront');
      setLatePenaltyType(product.late_penalty_type || 'none');
      setLatePenaltyPercentage(String(product.late_penalty_percentage ?? 0));
      setLatePenaltyFlatUsd(String(product.late_penalty_flat_usd ?? 0));
      setLatePenaltyGraceDays(String(product.late_penalty_grace_days ?? 3));
      setAccountingRule(String(product.accounting_rule ?? 3));
      setGLAccounts({
        fund_source_account_id: product.fund_source_account_id ?? null,
        loan_portfolio_account_id: product.loan_portfolio_account_id ?? null,
        transfers_in_suspense_account_id: product.transfers_in_suspense_account_id ?? null,
        interest_on_loan_account_id: product.interest_on_loan_account_id ?? null,
        income_from_fee_account_id: product.income_from_fee_account_id ?? null,
        income_from_penalty_account_id: product.income_from_penalty_account_id ?? null,
        write_off_account_id: product.write_off_account_id ?? null,
        overpayment_liability_account_id: product.overpayment_liability_account_id ?? null,
        receivable_interest_account_id: product.receivable_interest_account_id ?? null,
        receivable_fee_account_id: product.receivable_fee_account_id ?? null,
        receivable_penalty_account_id: product.receivable_penalty_account_id ?? null,
        income_from_recovery_account_id: product.income_from_recovery_account_id ?? null,
      });
    } else if (defaults) {
      // Create mode: populate from Fineract defaults
      setCurrencyCode(defaults.currency_code || 'USD');
      setRepaymentEvery(String(defaults.repayment_every));
      setRepaymentFreqType(String(defaults.repayment_frequency_type));
      setInterestRateFreqType(String(defaults.interest_rate_frequency_type));
      setAmortizationType(String(defaults.amortization_type));
      setInterestType(String(defaults.interest_type));
      setInterestCalcPeriod(String(defaults.interest_calculation_period_type));
      setTxnStrategy(defaults.transaction_processing_strategy);
      setAccountingRule(String(defaults.accounting_rule));
      setGLAccounts({
        fund_source_account_id: defaults.fund_source_account_id ?? null,
        loan_portfolio_account_id: defaults.loan_portfolio_account_id ?? null,
        transfers_in_suspense_account_id: defaults.transfers_in_suspense_account_id ?? null,
        interest_on_loan_account_id: defaults.interest_on_loan_account_id ?? null,
        income_from_fee_account_id: defaults.income_from_fee_account_id ?? null,
        income_from_penalty_account_id: defaults.income_from_penalty_account_id ?? null,
        write_off_account_id: defaults.write_off_account_id ?? null,
        overpayment_liability_account_id: defaults.overpayment_liability_account_id ?? null,
        receivable_interest_account_id: defaults.receivable_interest_account_id ?? null,
        receivable_fee_account_id: defaults.receivable_fee_account_id ?? null,
        receivable_penalty_account_id: defaults.receivable_penalty_account_id ?? null,
        income_from_recovery_account_id: defaults.income_from_recovery_account_id ?? null,
      });
    }
  }, [product, defaults]);

  // Force interestCalculationPeriodType to daily when recalculation is enabled
  useEffect(() => {
    if (isInterestRecalcEnabled && interestCalcPeriod === '1') {
      setInterestCalcPeriod('0');
    }
  }, [isInterestRecalcEnabled, interestCalcPeriod]);

  // ─── Auto-calculate annual rate from monthly ───
  function handleMonthlyRateChange(value: string) {
    setInterestRate(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setAnnualRate(String(Math.round(num * 12 * 100) / 100));
    }
  }

  function handleAnnualRateChange(value: string) {
    setAnnualRate(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setInterestRate(String(Math.round((num / 12) * 100) / 100));
    }
  }

  function toggleDisbursement(method: string) {
    setDisbursementMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }

  // ─── Validation ───

  function validateStep(step: number): boolean {
    const newErrors: FormErrors = {};

    if (step === 1) {
      if (!name.trim()) newErrors.name = 'Product name is required';
      if (!code.trim()) newErrors.code = 'Product code is required';
      else if (!PRODUCT_CODE_REGEX.test(code)) newErrors.code = 'Code must be 1-50 alphanumeric chars or underscores';
      if (!shortName.trim()) newErrors.shortName = 'Short name is required';
      else if (!SHORT_NAME_REGEX.test(shortName)) newErrors.shortName = 'Must be 1-4 alphanumeric characters';
    }

    if (step === 2) {
      const defP = parseFloat(defaultPrincipal);
      const minAmt = parseFloat(minAmount);
      const maxAmt = parseFloat(maxAmount);
      if (isNaN(defP) || defP <= 0) newErrors.defaultPrincipal = 'Default principal is required';
      if (isNaN(minAmt) || minAmt < 0) newErrors.minAmount = 'Valid min amount required';
      if (isNaN(maxAmt) || maxAmt < 0) newErrors.maxAmount = 'Valid max amount required';
      if (!isNaN(minAmt) && !isNaN(maxAmt) && minAmt >= maxAmt) newErrors.minAmount = 'Min must be less than max';
      if (!isNaN(defP) && !isNaN(minAmt) && !isNaN(maxAmt) && (defP < minAmt || defP > maxAmt)) {
        newErrors.defaultPrincipal = 'Default must be between min and max';
      }

      const numRep = parseInt(numRepayments);
      const minT = parseInt(minTerm);
      const maxT = parseInt(maxTerm);
      if (isNaN(numRep) || numRep < 1) newErrors.numRepayments = 'Required';
      if (isNaN(minT) || minT < 1) newErrors.minTerm = 'Valid min tenure required';
      if (isNaN(maxT) || maxT < 1) newErrors.maxTerm = 'Valid max tenure required';
      if (!isNaN(minT) && !isNaN(maxT) && minT >= maxT) newErrors.minTerm = 'Min must be less than max';

      const mRate = parseFloat(interestRate);
      if (isNaN(mRate) || mRate <= 0) newErrors.interestRate = 'Interest rate must be > 0';

      if (category === 'smartphone') {
        const dep = parseFloat(depositPct);
        if (isNaN(dep) || dep <= 0) newErrors.depositPct = 'Deposit % must be > 0 for smartphone products';
      }
    }

    if (step === 3) {
      const acctRule = parseInt(accountingRule);
      if (acctRule > 1) {
        const requiredGL = [
          'fund_source_account_id', 'loan_portfolio_account_id',
          'interest_on_loan_account_id', 'income_from_fee_account_id',
          'income_from_penalty_account_id', 'write_off_account_id',
          'overpayment_liability_account_id', 'transfers_in_suspense_account_id',
          'income_from_recovery_account_id',
        ];
        if (acctRule >= 3) {
          requiredGL.push('receivable_interest_account_id', 'receivable_fee_account_id', 'receivable_penalty_account_id');
        }
        for (const field of requiredGL) {
          if (!glAccounts[field]) {
            newErrors[field] = 'Required for this accounting rule';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function goNext() {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, 3));
    }
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  // ─── Submission ───

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const created = await createProduct(data);
      // Link selected organizations after product creation
      if (selectedOrgIds.length > 0 && created?.id) {
        await linkOrganizations(created.id, selectedOrgIds);
      }
      return created;
    },
    onSuccess: () => {
      toast({ title: 'Product created successfully', description: 'The product has been created in Fineract and saved.', variant: 'success' });
      router.push('/products');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create product', description: error.message, variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LoanProduct>) => updateProduct(product!.id, data),
    onSuccess: () => {
      toast({ title: 'Product updated successfully', variant: 'success' });
      router.push('/products');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update product', description: error.message, variant: 'error' });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    if (!validateStep(3)) return;

    const data: CreateProductInput = {
      product_code: code,
      product_name: name,
      product_type: category === 'smartphone' ? 'asset_financing' : 'digital_credit',
      product_category: category,
      status,
      short_name: shortName.toUpperCase(),
      currency_code: currencyCode,
      description: description || undefined,
      default_principal: parseFloat(defaultPrincipal),
      min_amount_usd: parseFloat(minAmount),
      max_amount_usd: parseFloat(maxAmount),
      number_of_repayments: parseInt(numRepayments),
      min_term_months: parseInt(minTerm),
      max_term_months: parseInt(maxTerm),
      repayment_every: parseInt(repaymentEvery),
      repayment_frequency_type: parseInt(repaymentFreqType),
      interest_rate_monthly: parseFloat(interestRate),
      interest_rate_annual: parseFloat(annualRate),
      min_interest_rate: minInterestRate ? parseFloat(minInterestRate) : undefined,
      max_interest_rate: maxInterestRate ? parseFloat(maxInterestRate) : undefined,
      min_credit_score: minCreditScore ? parseInt(minCreditScore) : 300,
      max_credit_score: maxCreditScore ? parseInt(maxCreditScore) : 850,
      interest_rate_frequency_type: parseInt(interestRateFreqType),
      amortization_type: parseInt(amortizationType),
      interest_type: parseInt(interestType),
      interest_calculation_period_type: parseInt(interestCalcPeriod),
      transaction_processing_strategy: txnStrategy,
      days_in_year_type: parseInt(daysInYearType),
      days_in_month_type: parseInt(daysInMonthType),
      is_interest_recalculation_enabled: isInterestRecalcEnabled,
      ...(isInterestRecalcEnabled ? {
        interest_recalculation_compounding_method: parseInt(recalcCompoundingMethod),
        reschedule_strategy_method: parseInt(rescheduleStrategy),
        recalculation_rest_frequency_type: parseInt(recalcRestFreqType),
        recalculation_rest_frequency_interval: parseInt(recalcRestFreqInterval),
        recalculation_compounding_frequency_type: parseInt(recalcCompoundingFreqType),
        recalculation_compounding_frequency_interval: parseInt(recalcCompoundingFreqInterval),
        is_arrears_based_on_original_schedule: arrearsOnOriginalSchedule,
        pre_closure_interest_calculation_strategy: parseInt(preClosureStrategy),
        allow_compounding_on_eod: allowCompoundingOnEod,
        interest_calculation_period_type: 0, // Force daily when recalculation is enabled
      } : {}),
      accounting_rule: parseInt(accountingRule),
      deposit_percentage: category === 'smartphone' ? parseFloat(depositPct) || 0 : 0,
      min_deposit_usd: category === 'smartphone' ? parseFloat(minDeposit) || 0 : 0,
      requires_device: category === 'smartphone',
      requires_organization_verification: category === 'digital' ? requiresOrgVerification : false,
      allowed_disbursement_methods: category === 'digital' ? disbursementMethods : [],
      max_active_loans: parseInt(maxActiveLoans) || 1,
      // Fee Configuration (Migration 049)
      insurance_fee_type: insuranceFeeType,
      insurance_fee_percentage: insuranceFeeType === 'percentage' ? parseFloat(insuranceFeePercentage) || 0 : 0,
      insurance_fee_flat_usd: insuranceFeeType === 'flat' ? parseFloat(insuranceFeeFlatUsd) || 0 : 0,
      insurance_fee_frequency: insuranceFeeType !== 'none' ? insuranceFeeFrequency : 'upfront',
      late_penalty_type: latePenaltyType,
      late_penalty_percentage: latePenaltyType === 'percentage' ? parseFloat(latePenaltyPercentage) || 0 : 0,
      late_penalty_flat_usd: latePenaltyType === 'flat' ? parseFloat(latePenaltyFlatUsd) || 0 : 0,
      late_penalty_grace_days: parseInt(latePenaltyGraceDays) || 3,
      ...glAccounts,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  // ─── Render ───

  return (
    <div className="mx-auto max-w-4xl">
      {/* Step indicator */}
      <nav className="mb-8">
        <ol className="flex items-center gap-2">
          {STEPS.map((step, index) => (
            <li key={step.id} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  step.id === currentStep
                    ? 'bg-brand-600 text-white'
                    : step.id < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.id < currentStep ? <Check className="h-4 w-4" /> : step.id}
              </button>
              <div className="hidden sm:block">
                <p className={`text-sm font-medium ${step.id === currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`mx-2 h-px w-8 sm:w-16 ${step.id < currentStep ? 'bg-green-500' : 'bg-border'}`} />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Basic Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <Select label="Category" id="category" options={CATEGORY_OPTIONS} value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)} disabled={isEditing} />
              <Select label="Status" id="status" options={STATUS_OPTIONS} value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="Product Name" id="name" value={name} onChange={(e) => setName(e.target.value)}
                error={errors.name} placeholder="e.g. Smartphone Finance Tier 1" />
              <Input label="Product Code" id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                error={errors.code} placeholder="e.g. SMRT_FIN_001" disabled={isEditing} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="Short Name (4 chars max)" id="shortName" value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 4))}
                error={errors.shortName} placeholder="e.g. LT1E" maxLength={4} />
              <Select label="Currency" id="currency" options={CURRENCY_OPTIONS} value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)} />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3} className="block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Product description..." />
            </div>
          </div>
        )}

        {/* Step 2: Loan Terms */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Loan Terms</h2>

            {/* Principal */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Principal Amount (USD)</legend>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Default" id="defaultPrincipal" type="number" value={defaultPrincipal}
                  onChange={(e) => setDefaultPrincipal(e.target.value)} error={errors.defaultPrincipal} min="0" step="0.01" />
                <Input label="Minimum" id="minAmount" type="number" value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)} error={errors.minAmount} min="0" step="0.01" />
                <Input label="Maximum" id="maxAmount" type="number" value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)} error={errors.maxAmount} min="0" step="0.01" />
              </div>
            </fieldset>

            {/* Repayments */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Repayment Schedule</legend>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Default # of Repayments" id="numRepayments" type="number" value={numRepayments}
                  onChange={(e) => setNumRepayments(e.target.value)} error={errors.numRepayments} min="1" />
                <Input label="Min Tenure" id="minTerm" type="number" value={minTerm}
                  onChange={(e) => setMinTerm(e.target.value)} error={errors.minTerm} min="1" />
                <Input label="Max Tenure" id="maxTerm" type="number" value={maxTerm}
                  onChange={(e) => setMaxTerm(e.target.value)} error={errors.maxTerm} min="1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Repayment Every" id="repaymentEvery" type="number" value={repaymentEvery}
                  onChange={(e) => setRepaymentEvery(e.target.value)} min="1" />
                <Select label="Frequency" id="repaymentFreqType"
                  options={FREQUENCY_TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                  value={repaymentFreqType} onChange={(e) => setRepaymentFreqType(e.target.value)} />
              </div>
            </fieldset>

            {/* Interest */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Interest Rate</legend>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Rate / Period (%)" id="interestRate" type="number" value={interestRate}
                  onChange={(e) => handleMonthlyRateChange(e.target.value)} error={errors.interestRate} min="0" step="0.01" />
                <Input label="Annual Rate (%) (auto-calculated)" id="annualRate" type="number" value={annualRate}
                  onChange={(e) => handleAnnualRateChange(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Min Rate" id="minInterestRate" type="number" value={minInterestRate}
                  onChange={(e) => setMinInterestRate(e.target.value)} min="0" step="0.01" placeholder="Optional" />
                <Input label="Max Rate" id="maxInterestRate" type="number" value={maxInterestRate}
                  onChange={(e) => setMaxInterestRate(e.target.value)} min="0" step="0.01" placeholder="Optional" />
                <Select label="Rate Frequency" id="interestRateFreqType"
                  options={[{ value: '2', label: 'Per Month' }, { value: '3', label: 'Per Year' }]}
                  value={interestRateFreqType} onChange={(e) => setInterestRateFreqType(e.target.value)} />
              </div>
            </fieldset>

            {/* Credit Score Eligibility */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Credit Score Eligibility</legend>
              <p className="text-xs text-muted-foreground">
                Define the credit score range (300-850) for customer eligibility. Products with overlapping ranges allow flexible matching.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Min Score" id="minCreditScore" type="number" value={minCreditScore}
                  onChange={(e) => setMinCreditScore(e.target.value)} min="300" max="850" step="1" />
                <Input label="Max Score" id="maxCreditScore" type="number" value={maxCreditScore}
                  onChange={(e) => setMaxCreditScore(e.target.value)} min="300" max="850" step="1" />
              </div>
            </fieldset>

            {/* Fineract calculation settings */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Calculation Settings</legend>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Amortization Type" id="amortizationType"
                  options={AMORTIZATION_TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                  value={amortizationType} onChange={(e) => setAmortizationType(e.target.value)} />
                <Select label="Interest Type" id="interestType"
                  options={INTEREST_TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                  value={interestType} onChange={(e) => setInterestType(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Interest Calculation Period" id="interestCalcPeriod"
                  options={INTEREST_CALCULATION_PERIOD_TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                  value={interestCalcPeriod} onChange={(e) => setInterestCalcPeriod(e.target.value)}
                  disabled={isInterestRecalcEnabled} />
                <Select label="Transaction Processing Strategy" id="txnStrategy"
                  options={TRANSACTION_STRATEGIES.map((t) => ({ value: t.value, label: t.label }))}
                  value={txnStrategy} onChange={(e) => setTxnStrategy(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Select label="Days in Year" id="daysInYearType"
                  options={[
                    { value: '365', label: '365 Days' },
                    { value: '360', label: '360 Days' },
                    { value: '364', label: '364 Days' },
                    { value: '1', label: 'Actual' },
                  ]}
                  value={daysInYearType} onChange={(e) => setDaysInYearType(e.target.value)} />
                <Select label="Days in Month" id="daysInMonthType"
                  options={[
                    { value: '30', label: '30 Days' },
                    { value: '1', label: 'Actual' },
                  ]}
                  value={daysInMonthType} onChange={(e) => setDaysInMonthType(e.target.value)} />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isInterestRecalcEnabled}
                      onChange={(e) => setIsInterestRecalcEnabled(e.target.checked)} className="rounded border-border" />
                    <span>Interest Recalculation</span>
                  </label>
                </div>
              </div>
              {isInterestRecalcEnabled && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Interest Calculation Period has been forced to &quot;Daily&quot; (required when recalculation is enabled).
                </p>
              )}
            </fieldset>

            {/* Interest Recalculation Settings (conditional) */}
            {isInterestRecalcEnabled && (
              <fieldset className="space-y-3 rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-4">
                <legend className="text-sm font-medium text-foreground px-2">Interest Recalculation Settings</legend>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Compounding Method" id="recalcCompoundingMethod"
                    options={INTEREST_RECALC_COMPOUNDING_METHODS.map((t) => ({ value: String(t.value), label: t.label }))}
                    value={recalcCompoundingMethod}
                    onChange={(e) => setRecalcCompoundingMethod(e.target.value)} />
                  <Select label="Reschedule Strategy" id="rescheduleStrategy"
                    options={RESCHEDULE_STRATEGY_METHODS.map((t) => ({ value: String(t.value), label: t.label }))}
                    value={rescheduleStrategy}
                    onChange={(e) => setRescheduleStrategy(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Rest Frequency Type" id="recalcRestFreqType"
                    options={RECALCULATION_FREQUENCY_TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                    value={recalcRestFreqType}
                    onChange={(e) => setRecalcRestFreqType(e.target.value)} />
                  <Input label="Rest Frequency Interval" id="recalcRestFreqInterval" type="number"
                    value={recalcRestFreqInterval}
                    onChange={(e) => setRecalcRestFreqInterval(e.target.value)} min="1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Compounding Frequency Type" id="recalcCompoundingFreqType"
                    options={RECALCULATION_FREQUENCY_TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                    value={recalcCompoundingFreqType}
                    onChange={(e) => setRecalcCompoundingFreqType(e.target.value)} />
                  <Input label="Compounding Frequency Interval" id="recalcCompoundingFreqInterval" type="number"
                    value={recalcCompoundingFreqInterval}
                    onChange={(e) => setRecalcCompoundingFreqInterval(e.target.value)} min="1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Pre-Closure Interest Strategy" id="preClosureStrategy"
                    options={PRE_CLOSURE_INTEREST_STRATEGIES.map((t) => ({ value: String(t.value), label: t.label }))}
                    value={preClosureStrategy}
                    onChange={(e) => setPreClosureStrategy(e.target.value)} />
                  <div className="space-y-2 flex flex-col justify-end pb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={arrearsOnOriginalSchedule}
                        onChange={(e) => setArrearsOnOriginalSchedule(e.target.checked)} className="rounded border-border" />
                      <span>Arrears Based on Original Schedule</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={allowCompoundingOnEod}
                        onChange={(e) => setAllowCompoundingOnEod(e.target.checked)} className="rounded border-border" />
                      <span>Allow Compounding on End of Day</span>
                    </label>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Lynia-specific section */}
            <fieldset className="space-y-3 rounded-md border border-border p-4">
              <legend className="text-sm font-medium text-foreground px-2">Lynia-Specific Settings</legend>

              {category === 'smartphone' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Deposit Percentage (%)" id="depositPct" type="number" value={depositPct}
                    onChange={(e) => setDepositPct(e.target.value)} error={errors.depositPct} min="0" max="100" step="0.1" />
                  <Input label="Minimum Deposit (USD)" id="minDeposit" type="number" value={minDeposit}
                    onChange={(e) => setMinDeposit(e.target.value)} min="0" step="0.01" />
                </div>
              )}

              {category === 'digital' && (
                <>
                  <div>
                    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                    <label className="block text-sm font-medium text-foreground mb-2">Disbursement Methods</label>
                    <div className="flex gap-3">
                      {DISBURSEMENT_OPTIONS.map((method) => (
                        <label key={method} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={disbursementMethods.includes(method)}
                            onChange={() => toggleDisbursement(method)} className="rounded border-border" />
                          <span className="capitalize">{method}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={requiresOrgVerification}
                      onChange={(e) => {
                        setRequiresOrgVerification(e.target.checked);
                        if (!e.target.checked) setSelectedOrgIds([]);
                      }} className="rounded border-border" />
                    <span>Requires Organization Verification</span>
                  </label>

                  {requiresOrgVerification && allOrgs.length > 0 && (
                    <div className="ml-6 space-y-2">
                      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                      <label className="block text-sm font-medium text-foreground">Eligible Organizations</label>
                      <p className="text-xs text-muted-foreground">
                        Select which organizations&apos; members can apply. Leave empty to allow all verified members.
                      </p>
                      <div className="max-h-48 overflow-y-auto rounded-md border border-border p-1 space-y-1">
                        {allOrgs.map((org) => {
                          const selected = selectedOrgIds.includes(org.id);
                          return (
                            <button
                              key={org.id}
                              type="button"
                              onClick={() => setSelectedOrgIds((prev) =>
                                prev.includes(org.id) ? prev.filter((id) => id !== org.id) : [...prev, org.id]
                              )}
                              className={`w-full flex items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ${
                                selected ? 'bg-brand-50 border border-brand-200' : 'hover:bg-accent'
                              }`}
                            >
                              <div>
                                <span className="font-medium">{org.org_name}</span>
                                <span className="ml-2 text-xs text-muted-foreground capitalize">({org.org_type})</span>
                              </div>
                              <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                                selected ? 'border-brand-500 bg-brand-500' : 'border-border'
                              }`}>
                                {selected && <Check className="h-3 w-3 text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedOrgIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {selectedOrgIds.length} organization{selectedOrgIds.length !== 1 ? 's' : ''} selected
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <Input label="Max Active Loans" id="maxActiveLoans" type="number" value={maxActiveLoans}
                onChange={(e) => setMaxActiveLoans(e.target.value)} min="1" />
            </fieldset>

            {/* Insurance Premium */}
            <fieldset className="space-y-3 rounded-md border border-border p-4">
              <legend className="text-sm font-medium text-foreground px-2">Insurance Premium</legend>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Fee Type" id="insuranceFeeType"
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'percentage', label: 'Percentage of Principal' },
                    { value: 'flat', label: 'Flat Amount (USD)' },
                  ]}
                  value={insuranceFeeType}
                  onChange={(e) => setInsuranceFeeType(e.target.value as 'none' | 'percentage' | 'flat')} />
                {insuranceFeeType !== 'none' && (
                  <Select label="Frequency" id="insuranceFeeFrequency"
                    options={[
                      { value: 'upfront', label: 'Upfront (one-time)' },
                      { value: 'monthly', label: 'Monthly' },
                    ]}
                    value={insuranceFeeFrequency}
                    onChange={(e) => setInsuranceFeeFrequency(e.target.value as 'upfront' | 'monthly')} />
                )}
              </div>
              {insuranceFeeType === 'percentage' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Percentage (%)" id="insuranceFeePercentage" type="number" value={insuranceFeePercentage}
                    onChange={(e) => setInsuranceFeePercentage(e.target.value)} min="0" max="20" step="0.1" />
                </div>
              )}
              {insuranceFeeType === 'flat' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Flat Amount (USD)" id="insuranceFeeFlatUsd" type="number" value={insuranceFeeFlatUsd}
                    onChange={(e) => setInsuranceFeeFlatUsd(e.target.value)} min="0" step="0.01" />
                </div>
              )}
            </fieldset>

            {/* Late Payment Penalty */}
            <fieldset className="space-y-3 rounded-md border border-border p-4">
              <legend className="text-sm font-medium text-foreground px-2">Late Payment Penalty</legend>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Penalty Type" id="latePenaltyType"
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'percentage', label: 'Percentage of Overdue Amount' },
                    { value: 'flat', label: 'Flat Amount (USD)' },
                  ]}
                  value={latePenaltyType}
                  onChange={(e) => setLatePenaltyType(e.target.value as 'none' | 'percentage' | 'flat')} />
                <Input label="Grace Days" id="latePenaltyGraceDays" type="number" value={latePenaltyGraceDays}
                  onChange={(e) => setLatePenaltyGraceDays(e.target.value)} min="0" max="30" />
              </div>
              <p className="text-xs text-muted-foreground">Days after due date before penalty applies</p>
              {latePenaltyType === 'percentage' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Percentage (%)" id="latePenaltyPercentage" type="number" value={latePenaltyPercentage}
                    onChange={(e) => setLatePenaltyPercentage(e.target.value)} min="0" max="10" step="0.1" />
                </div>
              )}
              {latePenaltyType === 'flat' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Flat Amount (USD)" id="latePenaltyFlatUsd" type="number" value={latePenaltyFlatUsd}
                    onChange={(e) => setLatePenaltyFlatUsd(e.target.value)} min="0" step="0.01" />
                </div>
              )}
            </fieldset>

            {/* Fee Simulation Preview */}
            {(parseFloat(minAmount) > 0 || parseFloat(maxAmount) > 0) && parseFloat(maxTerm) > 0 && (
              <FeeSimulationPreview
                minAmount={parseFloat(minAmount) || 0}
                maxAmount={parseFloat(maxAmount) || 0}
                annualRate={parseFloat(annualRate) || 0}
                termMonths={parseFloat(maxTerm) || 0}
                insuranceFeeType={insuranceFeeType}
                insuranceFeePercentage={parseFloat(insuranceFeePercentage) || 0}
                insuranceFeeFlatUsd={parseFloat(insuranceFeeFlatUsd) || 0}
                insuranceFeeFrequency={insuranceFeeFrequency}
              />
            )}
          </div>
        )}

        {/* Step 3: Accounting & Review */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Accounting & GL Mappings</h2>

            <Select label="Accounting Rule" id="accountingRule"
              options={ACCOUNTING_RULES.map((r) => ({ value: String(r.value), label: r.label }))}
              value={accountingRule} onChange={(e) => setAccountingRule(e.target.value)} />

            {parseInt(accountingRule) > 1 && (
              <>
                {loadingGL ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading GL accounts from Fineract...
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-foreground">Required Account Mappings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <GLAccountSelect label="Fund Source (Asset)" field="fund_source_account_id"
                        value={glAccounts.fund_source_account_id} grouped={grouped} error={errors.fund_source_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, fund_source_account_id: v }))} />
                      <GLAccountSelect label="Loan Portfolio (Asset)" field="loan_portfolio_account_id"
                        value={glAccounts.loan_portfolio_account_id} grouped={grouped} error={errors.loan_portfolio_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, loan_portfolio_account_id: v }))} />
                      <GLAccountSelect label="Interest on Loans (Income)" field="interest_on_loan_account_id"
                        value={glAccounts.interest_on_loan_account_id} grouped={grouped} error={errors.interest_on_loan_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, interest_on_loan_account_id: v }))} />
                      <GLAccountSelect label="Income from Fees (Income)" field="income_from_fee_account_id"
                        value={glAccounts.income_from_fee_account_id} grouped={grouped} error={errors.income_from_fee_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, income_from_fee_account_id: v }))} />
                      <GLAccountSelect label="Income from Penalties (Income)" field="income_from_penalty_account_id"
                        value={glAccounts.income_from_penalty_account_id} grouped={grouped} error={errors.income_from_penalty_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, income_from_penalty_account_id: v }))} />
                      <GLAccountSelect label="Write-Off Expense (Expense)" field="write_off_account_id"
                        value={glAccounts.write_off_account_id} grouped={grouped} error={errors.write_off_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, write_off_account_id: v }))} />
                      <GLAccountSelect label="Overpayment Liability (Liability)" field="overpayment_liability_account_id"
                        value={glAccounts.overpayment_liability_account_id} grouped={grouped} error={errors.overpayment_liability_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, overpayment_liability_account_id: v }))} />
                      <GLAccountSelect label="Transfers in Suspense (Liability)" field="transfers_in_suspense_account_id"
                        value={glAccounts.transfers_in_suspense_account_id} grouped={grouped} error={errors.transfers_in_suspense_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, transfers_in_suspense_account_id: v }))} />
                      <GLAccountSelect label="Income from Recovery (Income)" field="income_from_recovery_account_id"
                        value={glAccounts.income_from_recovery_account_id} grouped={grouped} error={errors.income_from_recovery_account_id}
                        onChange={(v) => setGLAccounts((prev) => ({ ...prev, income_from_recovery_account_id: v }))} />
                    </div>

                    {parseInt(accountingRule) >= 3 && (
                      <>
                        <h3 className="text-sm font-medium text-foreground mt-4">Accrual Receivable Accounts</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <GLAccountSelect label="Receivable Interest (Asset)" field="receivable_interest_account_id"
                            value={glAccounts.receivable_interest_account_id} grouped={grouped} error={errors.receivable_interest_account_id}
                            onChange={(v) => setGLAccounts((prev) => ({ ...prev, receivable_interest_account_id: v }))} />
                          <GLAccountSelect label="Receivable Fees (Asset)" field="receivable_fee_account_id"
                            value={glAccounts.receivable_fee_account_id} grouped={grouped} error={errors.receivable_fee_account_id}
                            onChange={(v) => setGLAccounts((prev) => ({ ...prev, receivable_fee_account_id: v }))} />
                          <GLAccountSelect label="Receivable Penalties (Asset)" field="receivable_penalty_account_id"
                            value={glAccounts.receivable_penalty_account_id} grouped={grouped} error={errors.receivable_penalty_account_id}
                            onChange={(v) => setGLAccounts((prev) => ({ ...prev, receivable_penalty_account_id: v }))} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Review Summary */}
            <div className="mt-6 rounded-md border border-border bg-muted/50 p-4">
              <h3 className="text-sm font-semibold mb-3">Review Summary</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-muted-foreground">Product Name</dt><dd className="font-medium">{name || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Short Name</dt><dd className="font-medium">{shortName || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Category</dt><dd className="font-medium capitalize">{category}</dd></div>
                <div><dt className="text-muted-foreground">Currency</dt><dd className="font-medium">{currencyCode}</dd></div>
                <div><dt className="text-muted-foreground">Principal</dt><dd className="font-medium">{minAmount} — {maxAmount} (default: {defaultPrincipal})</dd></div>
                <div><dt className="text-muted-foreground">Repayments</dt><dd className="font-medium">{minTerm} — {maxTerm} (default: {numRepayments})</dd></div>
                <div><dt className="text-muted-foreground">Interest Rate</dt><dd className="font-medium">{interestRate}% per {parseInt(interestRateFreqType) === 2 ? 'month' : 'year'}</dd></div>
                <div><dt className="text-muted-foreground">Amortization</dt><dd className="font-medium">{AMORTIZATION_TYPES.find(t => t.value === parseInt(amortizationType))?.label}</dd></div>
                <div><dt className="text-muted-foreground">Interest Type</dt><dd className="font-medium">{INTEREST_TYPES.find(t => t.value === parseInt(interestType))?.label}</dd></div>
                <div><dt className="text-muted-foreground">Accounting</dt><dd className="font-medium">{ACCOUNTING_RULES.find(r => r.value === parseInt(accountingRule))?.label}</dd></div>
                <div><dt className="text-muted-foreground">Interest Recalculation</dt><dd className="font-medium">{isInterestRecalcEnabled ? 'Enabled' : 'Disabled'}</dd></div>
                {isInterestRecalcEnabled && (
                  <>
                    <div><dt className="text-muted-foreground">Compounding Method</dt><dd className="font-medium">{INTEREST_RECALC_COMPOUNDING_METHODS.find(t => t.value === parseInt(recalcCompoundingMethod))?.label}</dd></div>
                    <div><dt className="text-muted-foreground">Reschedule Strategy</dt><dd className="font-medium">{RESCHEDULE_STRATEGY_METHODS.find(t => t.value === parseInt(rescheduleStrategy))?.label}</dd></div>
                  </>
                )}
              </dl>
            </div>

            {!isEditing && (
              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>This will create the product in Fineract core banking first, then save to Lynia. If Fineract is unreachable, the product will not be created.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex justify-between">
        <div>
          {currentStep > 1 && (
            <Button variant="secondary" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push('/products')}>
            Cancel
          </Button>
          {currentStep < 3 ? (
            <Button onClick={goNext}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} isLoading={isSubmitting}>
              {isEditing ? 'Update Product' : 'Create in Fineract & Save'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
