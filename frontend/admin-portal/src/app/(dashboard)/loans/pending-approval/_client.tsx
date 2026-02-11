'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getPendingLoans, approveLoan, rejectLoan, type LoanWithCustomer } from '@/lib/api/loans';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { formatCurrency, formatDate, truncateId } from '@/lib/utils';
import {
  Banknote,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Smartphone,
} from 'lucide-react';

export default function PendingApprovalPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [approveModal, setApproveModal] = useState<LoanWithCustomer | null>(null);
  const [rejectModal, setRejectModal] = useState<LoanWithCustomer | null>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-loans', page],
    queryFn: () => getPendingLoans(page),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!approveModal || !user) throw new Error('Missing context');
      return approveLoan(approveModal.id, user.id, approveNotes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-loans'] });
      setApproveModal(null);
      setApproveNotes('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!rejectModal || !user) throw new Error('Missing context');
      return rejectLoan(rejectModal.id, user.id, rejectReason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-loans'] });
      setRejectModal(null);
      setRejectReason('');
    },
  });

  return (
    <ProtectedRoute requiredPermission={{ resource: 'loans', action: 'update' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/loans" className="text-sm text-gray-500 hover:text-gray-700">
                Loans
              </Link>
              <span className="text-gray-300">/</span>
              <span className="text-sm text-gray-700">Pending Approval</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Pending Approval</h1>
            <p className="mt-1 text-sm text-gray-500">
              Loan applications awaiting approval
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                {data.total} pending
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <Banknote className="mx-auto h-12 w-12 text-green-300" />
            <p className="mt-4 text-lg font-medium text-gray-500">All caught up!</p>
            <p className="mt-1 text-sm text-gray-400">No loan applications pending approval.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.data.map((loan) => {
              const customer = Array.isArray(loan.customer) ? loan.customer[0] : loan.customer;
              const device = Array.isArray(loan.device) ? loan.device[0] : loan.device;
              return (
                <div key={loan.id} className="rounded-lg bg-white p-6 shadow">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <Link
                            href={`/customers/${customer?.id || loan.customer_id}`}
                            className="text-base font-semibold text-gray-900 hover:text-brand-600"
                          >
                            {customer ? `${(customer as Record<string, string>).first_name} ${(customer as Record<string, string>).last_name}` : 'Unknown Customer'}
                          </Link>
                          <p className="text-sm text-gray-500">
                            {customer ? (customer as Record<string, string>).phone_number : ''}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-md bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">Loan Amount</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(loan.loan_amount_usd || 0)}
                          </p>
                        </div>
                        <div className="rounded-md bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">Term</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {loan.loan_term_months || 0} months
                          </p>
                        </div>
                        <div className="rounded-md bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">Monthly Payment</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(loan.monthly_installment_usd || 0)}
                          </p>
                        </div>
                        <div className="rounded-md bg-gray-50 p-3">
                          <p className="text-xs text-gray-500">Credit Score</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {(loan as Record<string, unknown>).credit_score_at_application as string || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm">
                        {device && (
                          <span className="flex items-center gap-1 text-gray-600">
                            <Smartphone className="h-3.5 w-3.5" />
                            {(device as Record<string, string>).manufacturer} {(device as Record<string, string>).model}
                          </span>
                        )}
                        <span className="text-gray-400">
                          Applied: {formatDate(loan.created_at)}
                        </span>
                        <span className="text-gray-400">
                          ID: {truncateId(loan.id)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-row gap-2 lg:flex-col">
                      <Link href={`/loans/${loan.id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => setApproveModal(loan)}
                      >
                        <CheckCircle className="mr-1.5 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRejectModal(loan)}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data && data.total_pages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            total={data.total}
            pageSize={data.limit}
            onPageChange={setPage}
          />
        )}

        {/* Approve Modal */}
        <Modal
          open={!!approveModal}
          onClose={() => { setApproveModal(null); setApproveNotes(''); }}
          title="Approve Loan Application"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Approve loan of <strong>{formatCurrency(approveModal?.loan_amount_usd || 0)}</strong> for this customer?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Optional approval notes..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setApproveModal(null); setApproveNotes(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? 'Approving...' : 'Confirm Approval'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Reject Modal */}
        <Modal
          open={!!rejectModal}
          onClose={() => { setRejectModal(null); setRejectReason(''); }}
          title="Reject Loan Application"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reject loan of <strong>{formatCurrency(rejectModal?.loan_amount_usd || 0)}</strong>?
              The customer will be notified.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Rejection Reason *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="e.g., Insufficient credit score, incomplete KYC..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejectModal(null); setRejectReason(''); }}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => rejectMutation.mutate()}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ProtectedRoute>
  );
}
