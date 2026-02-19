'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/Button';
import type { Organization, CreateOrganizationInput, OrgType, VerificationMethod } from '@/types';

interface OrganizationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateOrganizationInput) => Promise<void>;
  organization?: Organization | null;
}

const ORG_TYPE_OPTIONS = [
  { value: 'government', label: 'Government' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'ngo', label: 'NGO' },
];

const VERIFICATION_OPTIONS = [
  { value: 'excel_upload', label: 'Excel Upload' },
  { value: 'api', label: 'API' },
  { value: 'manual', label: 'Manual' },
];

const DEFAULT_TRUST_LEVELS: Record<OrgType, number> = {
  government: 90,
  corporate: 70,
  cooperative: 50,
  ngo: 60,
};

export function OrganizationForm({ open, onClose, onSubmit, organization }: OrganizationFormProps) {
  const isEditing = !!organization;
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [orgCode, setOrgCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('government');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('excel_upload');
  const [trustLevel, setTrustLevel] = useState('90');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');

  useEffect(() => {
    if (organization) {
      setOrgCode(organization.org_code);
      setOrgName(organization.org_name);
      setOrgType(organization.org_type);
      setVerificationMethod(organization.verification_method);
      setTrustLevel(String(organization.scoring_trust_level));
      setContactPerson(organization.contact_person || '');
      setContactPhone(organization.contact_phone || '');
      setContactEmail(organization.contact_email || '');
      setApiEndpoint(organization.api_endpoint || '');
    } else {
      setOrgCode('');
      setOrgName('');
      setOrgType('government');
      setVerificationMethod('excel_upload');
      setTrustLevel('90');
      setContactPerson('');
      setContactPhone('');
      setContactEmail('');
      setApiEndpoint('');
    }
    setErrors({});
  }, [organization, open]);

  function handleOrgTypeChange(type: OrgType) {
    setOrgType(type);
    if (!isEditing) {
      setTrustLevel(String(DEFAULT_TRUST_LEVELS[type]));
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!orgCode.trim()) newErrors.orgCode = 'Organization code is required';
    if (!orgName.trim()) newErrors.orgName = 'Organization name is required';
    const trust = parseInt(trustLevel);
    if (isNaN(trust) || trust < 0 || trust > 100) newErrors.trustLevel = 'Trust level must be 0-100';
    if (verificationMethod === 'api' && !apiEndpoint.trim()) {
      newErrors.apiEndpoint = 'API endpoint required for API verification';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data: CreateOrganizationInput = {
        org_code: orgCode,
        org_name: orgName,
        org_type: orgType,
        verification_method: verificationMethod,
        scoring_trust_level: parseInt(trustLevel),
        contact_person: contactPerson || undefined,
        contact_phone: contactPhone || undefined,
        contact_email: contactEmail || undefined,
        api_endpoint: verificationMethod === 'api' ? apiEndpoint : undefined,
      };
      await onSubmit(data);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Organization' : 'Add Organization'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Organization Code" id="orgCode" value={orgCode} onChange={(e) => setOrgCode(e.target.value)} error={errors.orgCode} placeholder="e.g. GOV_CSC" disabled={isEditing} />
          <Input label="Organization Name" id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} error={errors.orgName} placeholder="e.g. Civil Service Commission" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Organization Type" id="orgType" options={ORG_TYPE_OPTIONS} value={orgType} onChange={(e) => handleOrgTypeChange(e.target.value as OrgType)} />
          <Select label="Verification Method" id="verificationMethod" options={VERIFICATION_OPTIONS} value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value as VerificationMethod)} />
        </div>

        <div>
          <label htmlFor="trustLevel" className="block text-sm font-medium text-gray-700 mb-1">
            Trust Level: {trustLevel}
          </label>
          <input
            id="trustLevel"
            type="range"
            min="0"
            max="100"
            value={trustLevel}
            onChange={(e) => setTrustLevel(e.target.value)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          {errors.trustLevel && <p className="text-sm text-red-600 mt-1">{errors.trustLevel}</p>}
        </div>

        {verificationMethod === 'api' && (
          <Input label="API Endpoint" id="apiEndpoint" value={apiEndpoint} onChange={(e) => setApiEndpoint(e.target.value)} error={errors.apiEndpoint} placeholder="https://api.example.com/verify" />
        )}

        <div className="grid grid-cols-3 gap-4">
          <Input label="Contact Person" id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <Input label="Contact Phone" id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+263..." />
          <Input label="Contact Email" id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={submitting}>{isEditing ? 'Update Organization' : 'Add Organization'}</Button>
        </div>
      </form>
    </Modal>
  );
}
