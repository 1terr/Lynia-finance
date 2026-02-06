'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchCustomerById, blockCustomer, unblockCustomer } from '@/lib/api/customers';
import { CustomerHeader } from '@/components/customers/CustomerHeader';
import { CustomerOverview } from '@/components/customers/CustomerOverview';
import { CustomerLoans } from '@/components/customers/CustomerLoans';
import { CustomerPayments } from '@/components/customers/CustomerPayments';
import { CustomerDocuments } from '@/components/customers/CustomerDocuments';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerNotes } from '@/components/customers/CustomerNotes';
import { CreditScoreCard } from '@/components/customers/CreditScoreCard';
import { CreditScoreChart } from '@/components/customers/CreditScoreChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;
  const queryClient = useQueryClient();

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => fetchCustomerById(customerId),
  });

  const blockMutation = useMutation({
    mutationFn: () => {
      const reason = prompt('Enter reason for blocking this customer:');
      if (!reason) throw new Error('Cancelled');
      return blockCustomer(customerId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => unblockCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading customer...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="text-red-500">Customer not found</p>
        <Link
          href="/dashboard/customers"
          className="mt-2 text-sm text-primary-600 hover:underline"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          className="mr-1 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Customers
      </Link>

      <CustomerHeader
        customer={customer}
        onBlock={() => blockMutation.mutate()}
        onUnblock={() => unblockMutation.mutate()}
      />

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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <CustomerOverview customer={customer} />
              <CreditScoreChart customerId={customer.id} />
              <CustomerLoans loans={customer.loans || []} />
            </div>
            <div className="space-y-6">
              <CreditScoreCard customer={customer} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="loans">
          <CustomerLoans loans={customer.loans || []} detailed />
        </TabsContent>

        <TabsContent value="payments">
          <CustomerPayments payments={customer.payments || []} />
        </TabsContent>

        <TabsContent value="documents">
          <CustomerDocuments
            customerId={customer.id}
            kycSubmissions={customer.kyc_submissions || []}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <CustomerTimeline customerId={customer.id} />
        </TabsContent>

        <TabsContent value="notes">
          <CustomerNotes
            customerId={customer.id}
            notes={customer.customer_notes || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
