'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { createOrganization, updateOrganization, checkOrgCode } from '@/lib/api/products';
import { cn } from '@lynia/utils';
import { ChevronLeft, ChevronRight, Check, Loader2, X, ArrowLeft } from 'lucide-react';
import type { Organization, CreateOrganizationInput, OrgType, VerificationMethod } from '@/types';

// ─── Props ───

interface OrganizationWizardProps {
  organization?: Organization | null; // null = create mode
}

// ─── Step definitions ───

const STEPS = [
  { id: 1, title: 'Organization Identity', description: 'Code, name, and type' },
  { id: 2, title: 'Verification & Scoring', description: 'Method, trust level, and API config' },
  { id: 3, title: 'Contact Information', description: 'Primary contact details' },
] as const;

const ORG_TYPE_OPTIONS = [
  { value: 'government', label: 'Government' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'ngo', label: 'NGO' },
];

const VERIFICATION_METHOD_OPTIONS = [
  { value: 'excel_upload', label: 'Excel Upload' },
  { value: 'api', label: 'API' },
  { value: 'manual', label: 'Manual' },
];

const ORG_CODE_REGEX = /^[A-Z0-9_]{2,50}$/;

const DEFAULT_TRUST_LEVELS: Record<OrgType, number> = {
  government: 90,
  corporate: 70,
  cooperative: 50,
  ngo: 60,
};

interface FormErrors {
  [key: string]: string;
}

// ─── Helpers ───

function generateOrgCode(type: OrgType, name: string): string {
  const prefixes: Record<OrgType, string> = {
    government: 'GOV',
    corporate: 'ORG',
    cooperative: 'COOP',
    ngo: 'NGO',
  };
  const words = name.trim().split(/\s+/).filter((w) => w.length > 2);
  const initials = words.map((w) => w[0].toUpperCase()).join('').slice(0, 5);
  return `${prefixes[type]}_${initials || 'NEW'}`;
}

// ─── Main Component ───

export function OrganizationWizard({ organization }: OrganizationWizardProps) {
  const isEditing = !!organization;
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Track whether the user has manually edited the org code
  const codeManuallyEdited = useRef(false);

  // ─── Form state ───
  // Step 1: Organization Identity
  const [orgType, setOrgType] = useState<OrgType>('corporate');
  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Step 2: Verification & Scoring
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('excel_upload');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [trustLevel, setTrustLevel] = useState('70');

  // Step 3: Contact Information
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // ─── Org code uniqueness check ───
  const debouncedCode = useDebouncedValue(orgCode, 500);

  const {
    data: codeCheckResult,
    isLoading: isCheckingCode,
    isFetched: codeCheckFetched,
  } = useQuery({
    queryKey: ['check-org-code', debouncedCode],
    queryFn: () => checkOrgCode(debouncedCode),
    enabled: !isEditing && debouncedCode.length >= 2 && ORG_CODE_REGEX.test(debouncedCode),
    staleTime: 30 * 1000,
  });

  const codeAvailable = codeCheckResult?.available ?? false;
  const showCodeStatus = !isEditing && debouncedCode.length >= 2 && ORG_CODE_REGEX.test(debouncedCode);

  // ─── Initialize from existing organization (edit mode) ───
  useEffect(() => {
    if (organization) {
      setOrgType(organization.org_type);
      setOrgName(organization.org_name);
      setOrgCode(organization.org_code);
      setIsActive(organization.is_active);
      setVerificationMethod(organization.verification_method);
      setApiEndpoint(organization.api_endpoint || '');
      setTrustLevel(String(organization.scoring_trust_level));
      setContactName(organization.contact_name || '');
      setContactPhone(organization.contact_phone || '');
      setContactEmail(organization.contact_email || '');
      codeManuallyEdited.current = true; // Don't auto-suggest in edit mode
    }
  }, [organization]);

  // ─── Auto-suggest org code when name or type changes (create mode only) ───
  useEffect(() => {
    if (!isEditing && !codeManuallyEdited.current && orgName.trim()) {
      setOrgCode(generateOrgCode(orgType, orgName));
    }
  }, [orgName, orgType, isEditing]);

  // ─── Auto-set trust level when org type changes (create mode only) ───
  useEffect(() => {
    if (!isEditing) {
      setTrustLevel(String(DEFAULT_TRUST_LEVELS[orgType]));
    }
  }, [orgType, isEditing]);

  // ─── Mark form as dirty on any change ───
  function markDirty() {
    if (!isDirty) setIsDirty(true);
  }

  // ─── Validation ───

  function validateStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!orgCode.trim()) newErrors.orgCode = 'Organization code is required';
      else if (!ORG_CODE_REGEX.test(orgCode)) newErrors.orgCode = 'Must be uppercase alphanumeric with underscores (2-50 chars)';
      else if (!codeAvailable && !isEditing) newErrors.orgCode = 'This code is already taken';
      if (!orgName.trim()) newErrors.orgName = 'Organization name is required';
    }

    if (step === 2) {
      const trust = parseInt(trustLevel);
      if (isNaN(trust) || trust < 0 || trust > 100) newErrors.trustLevel = 'Must be 0-100';
      if (verificationMethod === 'api' && !apiEndpoint.trim()) newErrors.apiEndpoint = 'Required for API verification';
    }

    // Step 3: no required fields

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

  function handleCancel() {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      router.push('/products/organizations');
    }
  }

  // ─── Submission ───

  const createMutation = useMutationWithToast({
    mutationFn: (data: CreateOrganizationInput) => createOrganization(data),
    successMessage: 'Organization created successfully',
    errorMessage: 'Failed to create organization',
    invalidateKeys: [['organizations']],
    onSuccess: () => router.push('/products/organizations'),
  });

  const updateMutation = useMutationWithToast({
    mutationFn: (data: Partial<Organization>) => updateOrganization(organization!.id, data),
    successMessage: 'Organization updated successfully',
    errorMessage: 'Failed to update organization',
    invalidateKeys: [['organizations'], ['organization', organization!.id]],
    onSuccess: () => router.push(`/products/organizations/${organization!.id}`),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    if (!validateStep(3)) return;

    const data: CreateOrganizationInput = {
      org_code: orgCode,
      org_name: orgName,
      org_type: orgType,
      verification_method: verificationMethod,
      api_endpoint: verificationMethod === 'api' ? apiEndpoint : undefined,
      scoring_trust_level: parseInt(trustLevel),
      contact_name: contactName || undefined,
      contact_phone: contactPhone || undefined,
      contact_email: contactEmail || undefined,
      is_active: isActive,
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
      {/* Step indicator — Horizontal pills */}
      <nav className="mb-8">
        <div className="flex gap-2">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => {
                if (step.id < currentStep) setCurrentStep(step.id);
              }}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                step.id === currentStep && 'bg-brand-600 text-white',
                step.id < currentStep && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                step.id > currentStep && 'bg-muted text-muted-foreground',
              )}
            >
              {step.id < currentStep ? <Check className="h-4 w-4" /> : <span>{step.id}</span>}
              <span className="hidden sm:inline">{step.title}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Step content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {/* Step 1: Organization Identity */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Organization Identity</h2>

            <Select
              label="Organization Type"
              id="orgType"
              options={ORG_TYPE_OPTIONS}
              value={orgType}
              onChange={(e) => {
                setOrgType(e.target.value as OrgType);
                markDirty();
              }}
            />

            <Input
              label="Organization Name"
              id="orgName"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                markDirty();
              }}
              error={errors.orgName}
              placeholder="e.g. Zimbabwe Revenue Authority"
            />

            <div>
              <div className="relative">
                <Input
                  label="Organization Code"
                  id="orgCode"
                  value={orgCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setOrgCode(val);
                    codeManuallyEdited.current = true;
                    markDirty();
                  }}
                  error={errors.orgCode}
                  placeholder="e.g. GOV_ZIMRA"
                  disabled={isEditing}
                />
                {showCodeStatus && (
                  <div className="absolute right-3 top-[34px]">
                    {isCheckingCode ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : codeCheckFetched && codeAvailable ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : codeCheckFetched && !codeAvailable ? (
                      <X className="h-4 w-4 text-red-600" />
                    ) : null}
                  </div>
                )}
              </div>
              {!isEditing && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Uppercase letters, numbers, and underscores only (2-50 characters)
                </p>
              )}
            </div>

            {isEditing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => {
                    setIsActive(e.target.checked);
                    markDirty();
                  }}
                  className="rounded border-border"
                />
                <span>Active</span>
              </label>
            )}
          </div>
        )}

        {/* Step 2: Verification & Scoring */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Verification & Scoring</h2>

            <Select
              label="Verification Method"
              id="verificationMethod"
              options={VERIFICATION_METHOD_OPTIONS}
              value={verificationMethod}
              onChange={(e) => {
                setVerificationMethod(e.target.value as VerificationMethod);
                markDirty();
              }}
            />

            {verificationMethod === 'api' && (
              <Input
                label="API Endpoint"
                id="apiEndpoint"
                value={apiEndpoint}
                onChange={(e) => {
                  setApiEndpoint(e.target.value);
                  markDirty();
                }}
                error={errors.apiEndpoint}
                placeholder="https://api.example.com/verify"
              />
            )}

            <div>
              <label htmlFor="trustLevel" className="block text-sm font-medium text-foreground mb-1">
                Scoring Trust Level: <span className="font-bold">{trustLevel}</span>
              </label>
              <input
                id="trustLevel"
                type="range"
                min="0"
                max="100"
                value={trustLevel}
                onChange={(e) => {
                  setTrustLevel(e.target.value);
                  markDirty();
                }}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
              {errors.trustLevel && (
                <p className="mt-1 text-sm text-red-600">{errors.trustLevel}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Contact Information */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Contact Information</h2>
            <p className="text-sm text-muted-foreground">All fields on this step are optional.</p>

            <Input
              label="Contact Name"
              id="contactName"
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                markDirty();
              }}
              placeholder="e.g. John Moyo"
            />

            <Input
              label="Contact Phone"
              id="contactPhone"
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
                markDirty();
              }}
              placeholder="+263..."
            />

            <Input
              label="Contact Email"
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                markDirty();
              }}
              placeholder="contact@example.com"
            />
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
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          {currentStep < 3 ? (
            <Button onClick={goNext}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} isLoading={isSubmitting}>
              {isEditing ? 'Update Organization' : 'Create Organization'}
            </Button>
          )}
        </div>
      </div>

      {/* Exit confirmation dialog */}
      <ConfirmationDialog
        open={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => router.push('/products/organizations')}
        title="Discard changes?"
        description="You have unsaved changes that will be lost."
        variant="warning"
        confirmLabel="Discard"
      />
    </div>
  );
}
