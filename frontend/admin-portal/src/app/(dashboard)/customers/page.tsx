'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { SearchBar } from '@/components/shared/SearchBar';
import { fetchCustomers, type CustomerListParams } from '@/lib/api/customers';
import Link from 'next/link';

export default function CustomersPage() {
  const [params, setParams] = useState<CustomerListParams>({
    page: 1,
    limit: 25,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', params],
    queryFn: () => fetchCustomers(params),
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
        <div className="flex gap-3">
          <Link
            href="/dashboard/customers/kyc-review"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            KYC Review Queue
          </Link>
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            Export Customers
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Search by name, phone, or ID..."
            onSearch={(query) =>
              setParams({ ...params, search: query, page: 1 })
            }
          />
        </div>
        <CustomerFilters
          filters={params}
          onChange={(newFilters) =>
            setParams({ ...params, ...newFilters, page: 1 })
          }
        />
      </div>

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
