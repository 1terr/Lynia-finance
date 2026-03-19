'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  getCustomerById,
  getCustomerLoans,
  getCustomerPayments,
  getCustomerCreditScore,
  getCustomerKYC,
  updateCustomerStatus,
  addCustomerNote,
} from '@/lib/api/customers';
import { useAuth } from '@/lib/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
import { useRouteId } from '@/hooks/use-route-id';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
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
  const id = useRouteId();
  const router = useRouter();
  const { user } = useAuth();
  const [showBlockDialog, setShowBlockDialog] = useState(false);

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

  const blockMutation = useMutationWithToast({
    mutationFn: () => updateCustomerStatus(id, 'blocked', user!.id),
    successMessage: 'Customer has been blocked',
    errorMessage: 'Failed to block customer',
    invalidateKeys: [['customer', id], ['customers']],
    onSuccess: () => setShowBlockDialog(false),
  });

  const unblockMutation = useMutationWithToast({
    mutationFn: () => updateCustomerStatus(id, 'active', user!.id),
    successMessage: 'Customer has been unblocked',
    errorMessage: 'Failed to unblock customer',
    invalidateKeys: [['customer', id], ['customers']],
  });

  const addNoteMutation = useMutationWithToast<
    { id: string; customer_id: string; note_type: string; note_text: string; created_by: string; created_at: string },
    { noteType: string; noteText: string }
  >({
    mutationFn: ({ noteType, noteText }) => addCustomerNote(id, noteType, noteText, user!.id),
    successMessage: 'Note added successfully',
    errorMessage: 'Failed to add note',
    invalidateKeys: [['customer', id]],
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
        <p className="text-lg text-muted-foreground">Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/customers')}>
          Back to Customers
        </Button>
      </div>
    );
  }

  const customerName = customer.full_name
    || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    || 'Unnamed Customer';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.push('/customers')} className="mt-1 rounded-md p-1 hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{customerName}</h1>
            <Badge variant="status" status={customer.status}>{customer.status}</Badge>
            <Badge variant="status" status={customer.kyc_status}>KYC: {customer.kyc_status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{customer.id}</p>
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
                onClick={() => setShowBlockDialog(true)}
                disabled={blockMutation.isPending}
              >
                <Ban className="mr-1.5 h-4 w-4" />
                Block
              </Button>
            )}
          </div>
        )}

        <ConfirmationDialog
          open={showBlockDialog}
          onClose={() => setShowBlockDialog(false)}
          onConfirm={() => blockMutation.mutate()}
          title="Block Customer"
          description={
            <>
              Are you sure you want to block <strong>{customerName}</strong>? This will prevent them from accessing loans, making payments, and using all Lynia services. This action can be reversed later.
            </>
          }
          variant="destructive"
          confirmLabel="Block Customer"
          cancelLabel="Cancel"
          isLoading={blockMutation.isPending}
        />
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">{customer.phone_number}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{customer.email || 'Not provided'}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Employment</p>
              <p className="text-sm font-medium capitalize">
                {customer.employment_status?.replace(/_/g, ' ') || 'Unknown'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Monthly Income</p>
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
                <p className="text-4xl font-bold text-foreground">{creditScore.scaled_score}</p>
                <p className="text-sm text-muted-foreground">{creditScore.tier} - {creditScore.decision}</p>
                <p className="text-xs text-muted-foreground">Limit: {formatCurrency(creditScore.credit_limit)}</p>
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
                    <span className="w-28 text-xs text-muted-foreground">{component.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-brand-500"
                        style={{ width: `${(component.value / component.max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-xs text-right text-muted-foreground">
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
                          <span className="text-sm text-muted-foreground">
                            Submitted {formatDateTime(submission.created_at)}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
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
            <div className="py-8 text-center text-sm text-muted-foreground">No KYC submissions</div>
          )}
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardContent className="p-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Full Name', customerName],
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
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground capitalize">{value}</dd>
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
