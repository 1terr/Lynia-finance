'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { CustomerWithRelations } from '@/types/database';

const kycStatusMap: Record<string, { variant: 'green' | 'yellow' | 'blue' | 'red' | 'gray'; label: string }> = {
  approved: { variant: 'green', label: 'Verified' },
  pending: { variant: 'yellow', label: 'Pending' },
  in_review: { variant: 'blue', label: 'In Review' },
  rejected: { variant: 'red', label: 'Rejected' },
  expired: { variant: 'gray', label: 'Expired' },
};

const tierColors: Record<number, 'blue' | 'purple' | 'gold'> = {
  1: 'blue',
  2: 'purple',
  3: 'gold',
};

interface CustomerHeaderProps {
  customer: CustomerWithRelations;
  onBlock?: () => void;
  onUnblock?: () => void;
}

export function CustomerHeader({ customer, onBlock, onUnblock }: CustomerHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const kycInfo = kycStatusMap[customer.kyc_status] || kycStatusMap.pending;

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
            <span className="text-2xl font-bold text-primary-600">
              {customer.first_name?.[0]}
              {customer.last_name?.[0]}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-gray-500">Customer ID: {customer.id}</p>
            <div className="mt-2 flex items-center gap-3">
              <Badge variant={kycInfo.variant}>{kycInfo.label}</Badge>
              <Badge variant={tierColors[customer.credit_tier] || 'gray'}>
                Tier {customer.credit_tier}
              </Badge>
              {customer.status === 'blocked' && (
                <Badge variant="red">Blocked</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-white shadow-lg">
                <div className="p-1">
                  <a
                    href={`/dashboard/customers/${customer.id}/edit`}
                    className="block w-full rounded-md px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Edit Profile
                  </a>
                  {customer.status === 'blocked' ? (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onUnblock?.();
                      }}
                      className="block w-full rounded-md px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50"
                    >
                      Unblock Customer
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onBlock?.();
                      }}
                      className="block w-full rounded-md px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Block Customer
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <p className="text-sm text-gray-500">Phone</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {customer.phone_number}
          </p>
        </div>
        {customer.whatsapp_number && (
          <div>
            <p className="text-sm text-gray-500">WhatsApp</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {customer.whatsapp_number}
            </p>
          </div>
        )}
        {customer.email && (
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {customer.email}
            </p>
          </div>
        )}
        {customer.national_id && (
          <div>
            <p className="text-sm text-gray-500">National ID</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {customer.national_id}
            </p>
          </div>
        )}
        <div>
          <p className="text-sm text-gray-500">Member Since</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {formatDate(customer.created_at)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Last Active</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {customer.last_active_at
              ? formatDate(customer.last_active_at)
              : 'Never'}
          </p>
        </div>
      </div>
    </div>
  );
}
