'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomerById,
  getCustomerLoans,
  getCustomerPayments,
  getCustomerCreditScore,
  getCustomerKYC,
  updateCustomerStatus,
} from '@/lib/api/customers';
import { useAuth } from '@/lib/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/data-table';
import { formatCurrency, formatCurrencyDetailed, formatDate, formatDateTime, formatPercent } from '@lynia/utils';
import type { Loan, Payment, CreditScore } from '@/types';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  ShieldCheck,
  Ban,
  Unlock,
} from 'lucide-react';
import Link from 'next/link';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomerById(id),
    enabled: !!id,
  });

  const { data: loans } = useQuery({
    queryKey: ['customer-loans', id],
    queryFn: () => getCustomerLoans(id),
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ['customer-payments', id],
    queryFn: () => getCustomerPayments(id),
    enabled: !!id,
  });

  const { data: creditScore } = useQuery({
    queryKey: ['customer-credit', id],
    queryFn: () => getCustomerCreditScore(id),
    enabled: !!id,
  });

  const { data: kycSubmissions } = useQuery({
    queryKey: ['customer-kyc', id],
    queryFn: () => getCustomerKYC(id),
    enabled: !!id,
  });

  const blockMutation = useMutation({
    mutationFn: () => updateCustomerStatus(id, 'blocked', user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', id] }),
  });

  const unblockMutation = useMutation({
    mutationFn: () => updateCustomerStatus(id, 'active', user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', id] }),
  });

  const canWrite = user && hasPermission(user.role, 'customers:write');

  const loanColumns: Column<Loan>[] = [
    {
      key: 'id',
      header: 'Loan ID',
      render: (row) => (
        <Link href={`/loans/${row.id}`} className="font-mono text-xs text-brand-600 hover:underline">
          {row.id.slice(0, 8)}...
        </Link>
      ),
    },
    {
      key: 'loan_amount_usd',
      header: 'Amount',
      render: (row) => formatCurrency(row.loan_amount_usd),
    },
    {
      key: 'outstanding_balance_usd',
      header: 'Outstanding',
      render: (row) => formatCurrency(row.outstanding_balance_usd),
    },
    {
      key: 'loan_status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.loan_status}>
          {row.loan_status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => formatDate(row.created_at),
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'payment_date',
      header: 'Date',
      render: (row) => formatDate(row.payment_date),
    },
    {
      key: 'payment_amount_usd',
      header: 'Amount',
      render: (row) => formatCurrencyDetailed(row.payment_amount_usd),
    },
    {
      key: 'payment_type',
      header: 'Type',
      render: (row) => <span className="capitalize">{row.payment_type.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (row) => <span className="capitalize">{row.payment_method.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'payment_status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.payment_status}>{row.payment_status}</Badge>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-gray-500">Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/customers')}>
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.push('/customers')} className="mt-1 rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{customer.full_name}</h1>
            <Badge variant="status" status={customer.status}>{customer.status}</Badge>
            <Badge variant="status" status={customer.kyc_status}>KYC: {customer.kyc_status}</Badge>
          </div>
          <p className="text-sm text-gray-500 font-mono">{customer.id}</p>
        </div>
        {canWrite && (
          <div>
            {customer.status === 'blocked' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unblockMutation.mutate()}
                disabled={unblockMutation.isPending}
              >
                <Unlock className="mr-1.5 h-4 w-4" />
                Unblock
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => blockMutation.mutate()}
                disabled={blockMutation.isPending}
              >
                <Ban className="mr-1.5 h-4 w-4" />
                Block
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm font-medium">{customer.phone_number}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium">{customer.email || 'Not provided'}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Employment</p>
              <p className="text-sm font-medium capitalize">
                {customer.employment_status?.replace(/_/g, ' ') || 'Unknown'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Monthly Income</p>
              <p className="text-sm font-medium">
                {customer.monthly_income_usd ? formatCurrency(customer.monthly_income_usd) : 'Unknown'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Credit Score Card */}
      {creditScore && (
        <Card>
          <CardHeader>
            <CardTitle>Credit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900">{creditScore.scaled_score}</p>
                <p className="text-sm text-gray-500">{creditScore.tier} - {creditScore.decision}</p>
                <p className="text-xs text-gray-400">Limit: {formatCurrency(creditScore.credit_limit)}</p>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { label: 'Affordability', value: creditScore.components.affordability, max: 300 },
                  { label: 'Repayment', value: creditScore.components.repayment_willingness, max: 250 },
                  { label: 'Mobile Money', value: creditScore.components.mobile_money, max: 200 },
                  { label: 'External Credit', value: creditScore.components.external_credit, max: 150 },
                  { label: 'KYC Verification', value: creditScore.components.kyc_verification, max: 100 },
                ].map((component) => (
                  <div key={component.label} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-gray-500">{component.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-brand-500"
                        style={{ width: `${(component.value / component.max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-xs text-right text-gray-600">
                      {component.value}/{component.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">Loans ({loans?.length || 0})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments?.length || 0})</TabsTrigger>
          <TabsTrigger value="kyc">KYC ({kycSubmissions?.length || 0})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="loans">
          <DataTable
            columns={loanColumns}
            data={loans || []}
            keyExtractor={(row) => row.id}
            emptyMessage="No loans found"
          />
        </TabsContent>

        <TabsContent value="payments">
          <DataTable
            columns={paymentColumns}
            data={payments || []}
            keyExtractor={(row) => row.id}
            emptyMessage="No payments found"
          />
        </TabsContent>

        <TabsContent value="kyc">
          {kycSubmissions && kycSubmissions.length > 0 ? (
            <div className="space-y-4">
              {kycSubmissions.map((submission) => (
                <Card key={submission.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="status" status={submission.status}>
                            {submission.status.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Submitted {formatDateTime(submission.created_at)}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          {submission.extracted_first_name && (
                            <p>Name: {submission.extracted_first_name} {submission.extracted_last_name}</p>
                          )}
                          {submission.extracted_date_of_birth && (
                            <p>DOB: {formatDate(submission.extracted_date_of_birth)}</p>
                          )}
                        </div>
                      </div>
                      <ShieldCheck className={`h-8 w-8 ${
                        submission.status === 'approved' ? 'text-green-500' :
                        submission.status === 'rejected' ? 'text-red-500' : 'text-yellow-500'
                      }`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">No KYC submissions</div>
          )}
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardContent className="p-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Full Name', customer.full_name],
                  ['Phone', customer.phone_number],
                  ['Email', customer.email || 'N/A'],
                  ['Date of Birth', customer.date_of_birth ? formatDate(customer.date_of_birth) : 'N/A'],
                  ['Address', customer.physical_address || 'N/A'],
                  ['Employment', customer.employment_status?.replace(/_/g, ' ') || 'N/A'],
                  ['Monthly Income', customer.monthly_income_usd ? formatCurrency(customer.monthly_income_usd) : 'N/A'],
                  ['Risk Level', customer.risk_level || 'N/A'],
                  ['Joined', formatDateTime(customer.created_at)],
                  ['Last Updated', formatDateTime(customer.updated_at)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-gray-500">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900 capitalize">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
