# Customer Management Dashboard

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.8 Admin Dashboard Design
**Task ID**: P1-T042
**Priority**: High
**Estimated Duration**: 8 hours

---

## 1. Overview

The Customer Management Dashboard provides admin users with comprehensive tools to view, search, and manage customer profiles, KYC submissions, credit scoring, and customer communication history. It includes specialized interfaces for KYC manual review, customer support interactions, and customer timeline tracking.

**Key Features**:
- Customer list with advanced filtering and search
- Individual customer profile with complete timeline
- KYC manual review interface
- Credit score management and adjustments
- Customer communication history
- Document verification tools
- Customer support notes and actions

---

## 2. Customer List View

### 2.1 Customer List Page

```typescript
// app/(dashboard)/customers/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { SearchBar } from '@/components/shared/SearchBar';

interface CustomerListParams {
  search?: string;
  status?: 'active' | 'inactive' | 'blocked';
  kyc_status?: 'pending' | 'verified' | 'rejected';
  credit_tier?: 1 | 2 | 3;
  has_active_loan?: boolean;
  page: number;
  limit: number;
}

export default function CustomersPage() {
  const [params, setParams] = useState<CustomerListParams>({
    page: 1,
    limit: 25
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', params],
    queryFn: () => fetchCustomers(params)
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-2 text-gray-600">
            Manage customer profiles and KYC verification
          </p>
        </div>

        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Export Customers
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Search by name, phone, or ID..."
            onSearch={(query) => setParams({ ...params, search: query, page: 1 })}
          />
        </div>

        <CustomerFilters
          filters={params}
          onChange={(newFilters) => setParams({ ...params, ...newFilters, page: 1 })}
        />
      </div>

      {/* Customer Table */}
      <CustomerTable
        customers={data?.customers || []}
        total={data?.total || 0}
        page={params.page}
        limit={params.limit}
        isLoading={isLoading}
        onPageChange={(page) => setParams({ ...params, page })}
      />
    </div>
  );
}

async function fetchCustomers(params: CustomerListParams) {
  let query = supabase
    .from('customers')
    .select('*, kyc_submissions(*), loans(count)', { count: 'exact' })
    .order('created_at', { ascending: false });

  // Apply filters
  if (params.search) {
    query = query.or(`
      first_name.ilike.%${params.search}%,
      last_name.ilike.%${params.search}%,
      phone_number.ilike.%${params.search}%,
      whatsapp_number.ilike.%${params.search}%
    `);
  }

  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.kyc_status) {
    query = query.eq('kyc_status', params.kyc_status);
  }

  if (params.credit_tier) {
    query = query.eq('credit_tier', params.credit_tier);
  }

  if (params.has_active_loan !== undefined) {
    if (params.has_active_loan) {
      query = query.gt('loans.count', 0);
    } else {
      query = query.eq('loans.count', 0);
    }
  }

  // Pagination
  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    customers: data,
    total: count || 0
  };
}
```

### 2.2 Customer Table Component

```typescript
// components/customers/CustomerTable.tsx
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface CustomerTableProps {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export function CustomerTable({
  customers,
  total,
  page,
  limit,
  isLoading,
  onPageChange
}: CustomerTableProps) {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              KYC Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Credit Tier
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Loans
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Joined
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {customer.first_name?.[0]}{customer.last_name?.[0]}
                    </span>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {customer.first_name} {customer.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {customer.id.slice(0, 8)}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{customer.whatsapp_number}</div>
                {customer.email && (
                  <div className="text-sm text-gray-500">{customer.email}</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <KYCStatusBadge status={customer.kyc_status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <CreditTierBadge tier={customer.credit_tier} limit={customer.credit_limit_usd} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {customer.loans?.length || 0} active
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(customer.created_at)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  className="text-blue-600 hover:text-blue-900"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="text-sm text-gray-700">
          Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} customers
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page * limit >= total}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function KYCStatusBadge({ status }: { status: string }) {
  const variants = {
    verified: { color: 'green', label: 'Verified' },
    pending: { color: 'yellow', label: 'Pending' },
    pending_review: { color: 'blue', label: 'In Review' },
    rejected: { color: 'red', label: 'Rejected' },
    not_started: { color: 'gray', label: 'Not Started' }
  };

  const variant = variants[status] || variants.not_started;

  return (
    <Badge variant={variant.color}>
      {variant.label}
    </Badge>
  );
}

function CreditTierBadge({ tier, limit }: { tier: number; limit: number }) {
  const colors = {
    1: 'blue',
    2: 'purple',
    3: 'gold'
  };

  return (
    <div>
      <Badge variant={colors[tier]}>Tier {tier}</Badge>
      <div className="text-xs text-gray-500 mt-1">${limit} limit</div>
    </div>
  );
}
```

---

## 3. Customer Profile / Detail View

### 3.1 Customer Profile Page

```typescript
// app/(dashboard)/customers/[id]/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { CustomerHeader } from '@/components/customers/CustomerHeader';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerLoans } from '@/components/customers/CustomerLoans';
import { CustomerDocuments } from '@/components/customers/CustomerDocuments';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();

  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      *,
      kyc_submissions(*),
      loans(*),
      payments(*),
      credit_score_history(*),
      customer_notes(*)
    `)
    .eq('id', params.id)
    .single();

  if (error || !customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <CustomerHeader customer={customer} />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <CustomerOverview customer={customer} />
              <CustomerLoans loans={customer.loans} />
            </div>
            <div className="space-y-6">
              <CreditScoreCard customer={customer} />
              <CustomerStats customer={customer} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="loans">
          <CustomerLoans loans={customer.loans} detailed />
        </TabsContent>

        <TabsContent value="payments">
          <CustomerPayments payments={customer.payments} />
        </TabsContent>

        <TabsContent value="documents">
          <CustomerDocuments customerId={customer.id} kycSubmissions={customer.kyc_submissions} />
        </TabsContent>

        <TabsContent value="timeline">
          <CustomerTimeline customerId={customer.id} />
        </TabsContent>

        <TabsContent value="notes">
          <CustomerNotes customerId={customer.id} notes={customer.customer_notes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 3.2 Customer Header Component

```typescript
// components/customers/CustomerHeader.tsx
'use client';

import { useState } from 'react';
import { Menu } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';

export function CustomerHeader({ customer }: { customer: Customer }) {
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlockCustomer = async () => {
    if (!confirm('Are you sure you want to block this customer?')) return;

    setIsBlocking(true);
    try {
      await fetch(`/api/customers/${customer.id}/block`, { method: 'POST' });
      window.location.reload();
    } catch (error) {
      alert('Failed to block customer');
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-600">
              {customer.first_name?.[0]}{customer.last_name?.[0]}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-gray-500">Customer ID: {customer.id}</p>
            <div className="mt-2 flex items-center gap-3">
              <KYCStatusBadge status={customer.kyc_status} />
              <CreditTierBadge tier={customer.credit_tier} limit={customer.credit_limit_usd} />
              {customer.status === 'blocked' && (
                <Badge variant="red">Blocked</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="p-2 hover:bg-gray-100 rounded-lg">
            <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
          </Menu.Button>

          <Menu.Items className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border">
            <div className="p-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${active ? 'bg-gray-100' : ''} w-full text-left px-4 py-2 text-sm`}
                    onClick={() => window.location.href = `/dashboard/customers/${customer.id}/edit`}
                  >
                    Edit Profile
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${active ? 'bg-gray-100' : ''} w-full text-left px-4 py-2 text-sm`}
                    onClick={() => window.location.href = `/dashboard/customers/${customer.id}/adjust-credit`}
                  >
                    Adjust Credit Limit
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${active ? 'bg-red-50' : ''} w-full text-left px-4 py-2 text-sm text-red-600`}
                    onClick={handleBlockCustomer}
                    disabled={isBlocking}
                  >
                    {customer.status === 'blocked' ? 'Unblock Customer' : 'Block Customer'}
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Menu>
      </div>

      {/* Contact Information */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500">WhatsApp</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{customer.whatsapp_number}</p>
        </div>
        {customer.phone_number && (
          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{customer.phone_number}</p>
          </div>
        )}
        {customer.email && (
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{customer.email}</p>
          </div>
        )}
        {customer.national_id_number && (
          <div>
            <p className="text-sm text-gray-500">National ID</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{customer.national_id_number}</p>
          </div>
        )}
        <div>
          <p className="text-sm text-gray-500">Member Since</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(customer.created_at)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Last Active</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {customer.last_active_at ? formatDate(customer.last_active_at) : 'Never'}
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. KYC Manual Review Interface

### 4.1 KYC Review Queue

```typescript
// app/(dashboard)/customers/kyc-review/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { KYCReviewCard } from '@/components/customers/KYCReviewCard';

export default function KYCReviewPage() {
  const { data: pendingKYC, isLoading } = useQuery({
    queryKey: ['kyc-pending-review'],
    queryFn: async () => {
      const { data } = await supabase
        .from('kyc_submissions')
        .select('*, customers(*), kyc_manual_reviews(*)')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: true })
        .limit(50);

      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">KYC Manual Review</h1>
          <p className="mt-2 text-gray-600">
            Review and approve customer identity verification
          </p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {pendingKYC?.length || 0}
          </div>
          <div className="text-sm text-gray-500">Pending Reviews</div>
        </div>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : pendingKYC?.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No pending KYC submissions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {pendingKYC?.map((submission) => (
            <KYCReviewCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4.2 KYC Review Card Component

```typescript
// components/customers/KYCReviewCard.tsx
'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import Image from 'next/image';

export function KYCReviewCard({ submission }: { submission: KYCSubmission & { customers: Customer } }) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this KYC submission?')) return;

    setIsReviewing(true);
    try {
      await fetch(`/api/kyc/${submission.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Manually approved by admin' })
      });

      window.location.reload();
    } catch (error) {
      alert('Failed to approve KYC');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason) {
      alert('Please provide a rejection reason');
      return;
    }

    setIsReviewing(true);
    try {
      await fetch(`/api/kyc/${submission.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason })
      });

      window.location.reload();
    } catch (error) {
      alert('Failed to reject KYC');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {submission.customers.first_name} {submission.customers.last_name}
          </h3>
          <p className="text-sm text-gray-500">
            Submitted {formatDate(submission.created_at)}
          </p>
        </div>

        {submission.smile_identity_result && (
          <div className="text-right">
            <div className="text-sm text-gray-500">Smile ID Confidence</div>
            <div className={`text-2xl font-bold ${
              submission.smile_identity_result.confidence >= 85 ? 'text-green-600' :
              submission.smile_identity_result.confidence >= 50 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {submission.smile_identity_result.confidence}%
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* National ID Front */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">National ID (Front)</p>
          <div
            className="relative aspect-[1.6/1] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90"
            onClick={() => setShowImageModal(submission.id_document_front_url)}
          >
            <Image
              src={submission.id_document_front_url}
              alt="National ID Front"
              fill
              className="object-cover"
            />
          </div>
        </div>

        {/* National ID Back */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">National ID (Back)</p>
          <div
            className="relative aspect-[1.6/1] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90"
            onClick={() => setShowImageModal(submission.id_document_back_url)}
          >
            <Image
              src={submission.id_document_back_url}
              alt="National ID Back"
              fill
              className="object-cover"
            />
          </div>
        </div>

        {/* Selfie */}
        <div className="col-span-2">
          <p className="text-sm font-medium text-gray-700 mb-2">Live Selfie</p>
          <div
            className="relative aspect-[3/2] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 max-w-md"
            onClick={() => setShowImageModal(submission.selfie_image_url)}
          >
            <Image
              src={submission.selfie_image_url}
              alt="Selfie"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* Extracted Information */}
      <div className="mt-6 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-500">ID Number</p>
          <p className="mt-1 font-medium">{submission.id_number}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Full Name</p>
          <p className="mt-1 font-medium">
            {submission.extracted_first_name} {submission.extracted_last_name}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Date of Birth</p>
          <p className="mt-1 font-medium">{formatDate(submission.extracted_date_of_birth)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Address</p>
          <p className="mt-1 font-medium text-sm">{submission.extracted_address}</p>
        </div>
      </div>

      {/* Smile Identity Results */}
      {submission.smile_identity_result && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-900">Smile Identity Analysis</p>
          <div className="mt-2 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-blue-600">Face Match</p>
              <p className="font-medium">{submission.smile_identity_result.face_match ? '✓ Pass' : '✗ Fail'}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Liveness Check</p>
              <p className="font-medium">{submission.smile_identity_result.liveness_check ? '✓ Pass' : '✗ Fail'}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600">ID Validation</p>
              <p className="font-medium">{submission.smile_identity_result.id_validation ? '✓ Pass' : '✗ Fail'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Input */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">
          Rejection Reason (if rejecting)
        </label>
        <textarea
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          rows={2}
          placeholder="Provide detailed reason for rejection..."
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleApprove}
          disabled={isReviewing}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Approve KYC
        </button>
        <button
          onClick={handleReject}
          disabled={isReviewing || !rejectionReason}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          Reject KYC
        </button>
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <Dialog open={!!showImageModal} onClose={() => setShowImageModal(null)}>
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="relative max-w-4xl w-full">
              <Image
                src={showImageModal}
                alt="Document"
                width={1200}
                height={800}
                className="rounded-lg"
              />
              <button
                onClick={() => setShowImageModal(null)}
                className="absolute top-4 right-4 px-4 py-2 bg-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
```

---

## 5. Customer Timeline

### 5.1 Timeline Component

```typescript
// components/customers/CustomerTimeline.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  created_at: Date;
  created_by?: string;
}

export function CustomerTimeline({ customerId }: { customerId: string }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['customer-timeline', customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_timeline')
        .select('*, admin_users(first_name, last_name)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(100);

      return data as TimelineEvent[];
    }
  });

  if (isLoading) return <div>Loading timeline...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Customer Timeline</h2>

      <div className="space-y-6">
        {events?.map((event, index) => (
          <TimelineItem key={event.id} event={event} isLast={index === events.length - 1} />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const eventConfig = getEventConfig(event.event_type);

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
      )}

      <div className="flex gap-4">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${eventConfig.bgColor} flex items-center justify-center z-10`}>
          {eventConfig.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{eventConfig.title}</p>
              <p className="text-sm text-gray-500">{eventConfig.description(event.event_data)}</p>
            </div>
            <time className="text-xs text-gray-400">{formatDate(event.created_at)}</time>
          </div>

          {event.created_by && (
            <p className="mt-1 text-xs text-gray-400">
              by {event.created_by}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function getEventConfig(eventType: string) {
  const configs = {
    customer_created: {
      title: 'Customer Created',
      description: () => 'Customer account was created',
      icon: '👤',
      bgColor: 'bg-blue-100'
    },
    kyc_submitted: {
      title: 'KYC Submitted',
      description: () => 'Submitted KYC documents for verification',
      icon: '📄',
      bgColor: 'bg-purple-100'
    },
    kyc_approved: {
      title: 'KYC Approved',
      description: () => 'Identity verification approved',
      icon: '✓',
      bgColor: 'bg-green-100'
    },
    loan_applied: {
      title: 'Loan Application',
      description: (data) => `Applied for ${data.device_name}`,
      icon: '📱',
      bgColor: 'bg-blue-100'
    },
    loan_approved: {
      title: 'Loan Approved',
      description: (data) => `Loan approved for $${data.amount}`,
      icon: '✓',
      bgColor: 'bg-green-100'
    },
    payment_made: {
      title: 'Payment Received',
      description: (data) => `Paid $${data.amount}`,
      icon: '💰',
      bgColor: 'bg-green-100'
    },
    payment_missed: {
      title: 'Payment Missed',
      description: (data) => `Missed payment of $${data.amount}`,
      icon: '⚠️',
      bgColor: 'bg-yellow-100'
    },
    device_locked: {
      title: 'Device Locked',
      description: (data) => `Device locked due to ${data.reason}`,
      icon: '🔒',
      bgColor: 'bg-red-100'
    }
  };

  return configs[eventType] || {
    title: eventType,
    description: () => '',
    icon: '•',
    bgColor: 'bg-gray-100'
  };
}
```

---

## 6. Database Schema

### 6.1 Customer Timeline Table

```sql
CREATE TABLE customer_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id)
);

-- Indexes
CREATE INDEX idx_customer_timeline_customer_id ON customer_timeline(customer_id);
CREATE INDEX idx_customer_timeline_event_type ON customer_timeline(event_type);
CREATE INDEX idx_customer_timeline_created_at ON customer_timeline(created_at DESC);
```

### 6.2 Customer Notes Table

```sql
CREATE TABLE customer_notes (
  note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  note_type VARCHAR(50) CHECK (note_type IN ('general', 'support', 'collections', 'fraud_alert')),
  note_text TEXT NOT NULL,

  is_important BOOLEAN DEFAULT FALSE,
  is_internal BOOLEAN DEFAULT TRUE, -- Not visible to customer

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES admin_users(id),

  updated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES admin_users(id)
);

-- Indexes
CREATE INDEX idx_customer_notes_customer_id ON customer_notes(customer_id);
CREATE INDEX idx_customer_notes_type ON customer_notes(note_type);
CREATE INDEX idx_customer_notes_created_at ON customer_notes(created_at DESC);
```

---

## 7. Summary

This customer management dashboard provides comprehensive tools for managing customer profiles and KYC verification:

**Customer List**: Advanced filtering, search, and pagination for customer discovery
**Customer Profile**: Complete 360-degree view with tabs for loans, payments, documents, timeline
**KYC Manual Review**: Dedicated interface for reviewing pending KYC submissions with image zoom and Smile Identity results
**Customer Timeline**: Chronological view of all customer events and interactions
**Credit Management**: Tools to adjust credit limits and tiers
**Customer Notes**: Internal note-taking for support and collections teams

**Key Features**:
- Real-time updates via Supabase Realtime
- Role-based permissions for different admin types
- Document verification with image zoom
- Customer action history tracking
- Support for blocking/unblocking customers
- Comprehensive customer search and filtering

**Implementation Priority**: High (required for customer support and KYC operations)
**Implementation Complexity**: Medium-High (requires Next.js, React Query, image handling)
**Business Impact**: High (enables all customer operations)

**Related Tasks**:
- P1-T041: Admin Dashboard Overview & Architecture
- P1-T043: Loan & Payment Management Dashboard
- P1-T044: Device Inventory Dashboard
- P1-T045: Reports & Analytics Dashboard

**Next Steps**:
1. Build customer list page with filters
2. Create customer profile detail view
3. Implement KYC review interface
4. Build customer timeline component
5. Add customer notes system
6. Implement customer blocking/unblocking
7. Create credit limit adjustment workflow
