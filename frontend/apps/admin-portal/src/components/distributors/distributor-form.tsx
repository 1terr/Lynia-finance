'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { Distributor, CreateDistributorInput, DistributorStatus } from '@/types';

interface DistributorFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDistributorInput) => Promise<void>;
  initialData?: Partial<Distributor>;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function DistributorForm({ open, onClose, onSubmit, initialData }: DistributorFormProps) {
  const isEditing = !!initialData;
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Business Info
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [status, setStatus] = useState<DistributorStatus>('active');

  // Contact
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  // Address
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');

  // Payment
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [ecocashNumber, setEcocashNumber] = useState('');
  const [onemoneyNumber, setOnemoneyNumber] = useState('');

  useEffect(() => {
    if (initialData) {
      setBusinessName(initialData.business_name || '');
      setContactPerson(initialData.name || '');
      setStatus(initialData.status || 'active');
      setPhoneNumber(initialData.phone_number || '');
      setEmail(initialData.email || '');
      setAddressLine1(initialData.address || '');
      setCity(initialData.city || '');
      setProvince(initialData.province || '');
      setBankName(initialData.bank_name || '');
      setAccountNumber(initialData.account_number || '');
      setAccountName('');
      setEcocashNumber(initialData.mobile_money_number || '');
      setOnemoneyNumber('');
    } else {
      setBusinessName('');
      setContactPerson('');
      setStatus('active');
      setPhoneNumber('');
      setEmail('');
      setAddressLine1('');
      setCity('');
      setProvince('');
      setBankName('');
      setAccountNumber('');
      setAccountName('');
      setEcocashNumber('');
      setOnemoneyNumber('');
    }
    setErrors({});
  }, [initialData, open]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!contactPerson.trim()) newErrors.contactPerson = 'Contact person is required';
    if (!phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data: CreateDistributorInput = {
        business_name: businessName,
        contact_person: contactPerson,
        phone_number: phoneNumber,
        email: email || undefined,
        address_line1: addressLine1 || undefined,
        city: city || undefined,
        province: province || undefined,
        bank_name: bankName || undefined,
        account_number: accountNumber || undefined,
        account_name: accountName || undefined,
        ecocash_number: ecocashNumber || undefined,
        onemoney_number: onemoneyNumber || undefined,
        status: status,
      };
      await onSubmit(data);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Distributor' : 'Add Distributor'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Cognito account creation notice */}
        {!isEditing && (
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Account Creation</p>
              <p className="text-sm text-blue-600">
                A login account will be automatically created for this distributor.
                Temporary credentials will be sent to their email and phone number.
              </p>
            </div>
          </div>
        )}

        {/* Business Info */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Business Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Business Name"
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              error={errors.businessName}
              placeholder="e.g. Harare Mobile Solutions"
            />
            <Input
              label="Contact Person"
              id="contactPerson"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              error={errors.contactPerson}
              placeholder="e.g. John Moyo"
            />
          </div>
          <div className="mt-4">
            <Select
              label="Status"
              id="status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => setStatus(e.target.value as DistributorStatus)}
            />
          </div>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              error={errors.phoneNumber}
              placeholder="+263..."
            />
            <Input
              label="Email"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Address</h3>
          <div className="space-y-4">
            <Input
              label="Address Line 1"
              id="addressLine1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Street address"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Harare"
              />
              <Input
                label="Province"
                id="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="e.g. Harare Metropolitan"
              />
            </div>
          </div>
        </div>

        {/* Payment */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Details</h3>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Bank Name"
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. CBZ Bank"
            />
            <Input
              label="Account Number"
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
            <Input
              label="Account Name"
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input
              label="EcoCash Number"
              id="ecocashNumber"
              value={ecocashNumber}
              onChange={(e) => setEcocashNumber(e.target.value)}
              placeholder="+263..."
            />
            <Input
              label="OneMoney Number"
              id="onemoneyNumber"
              value={onemoneyNumber}
              onChange={(e) => setOnemoneyNumber(e.target.value)}
              placeholder="+263..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={submitting}>
            {submitting
              ? (isEditing ? 'Updating...' : 'Creating...')
              : (isEditing ? 'Update Distributor' : 'Add Distributor')
            }
          </Button>
        </div>
      </form>
    </Modal>
  );
}
