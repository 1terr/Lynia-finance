'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  getFineractLoanDetail,
  disburseFineractLoan,
  writeOffFineractLoan,
  closeFineractLoan,
  cancelFineractLoan,
} from '@/lib/api/fineract';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatCurrency, formatDate, formatPercent } from '@lynia/utils';
import {
  getFineractStatusDisplay,
  type FineractLoanDetail,
} from '@/types/fineract';
import RepaymentScheduleTable from './repayment-schedule-table';
import RecordPaymentForm from './record-payment-form';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Smartphone,
  Clock,
  DollarSign,
  ChevronRight,
  Ban,
  XOctagon,
} from 'lucide-react';

interface Props {
  loanId: string;
}

type LoanAction = 'disburse' | 'writeoff' | 'close' | 'cancel' | null;

export default function FineractLoanDetailPage({ loanId }: Props) {
  const router = useRouter();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [activeAction, setActiveAction] = useState<LoanAction>(null);
  const canRecordPayment = useAuthStore((s) => s.hasPermission('payments:reconcile'));
  const canApprove = useAuthStore((s) => s.hasPermission('loans:approve'));

  const { data: loan, isLoading, refetch } = useQuery({
    queryKey: ['fineract-loan-detail', loanId],
    queryFn: () => getFineractLoanDetail(loanId),
  });

  const disburseMutation = useMutationWithToast({
    mutationFn: () =>
      disburseFineractLoan(loanId, {
        actualDisbursementDate: new Date().toISOString().split('T')[0],
      }),
    successMessage: 'Loan disbursed successfully',
    errorMessage: 'Disbursement failed',
    invalidateKeys: [['fineract-loan-detail', loanId], ['fineract-loans'], ['fineract-pending-loans']],
    onSuccess: () => setActiveAction(null),
  });

  const writeOffMutation = useMutationWithToast({
    mutationFn: () => writeOffFineractLoan(loanId),
    successMessage: 'Loan written off',
    errorMessage: 'Write-off failed',
    invalidateKeys: [['fineract-loan-detail', loanId], ['fineract-loans']],
    onSuccess: () => setActiveAction(null),
  });

  const closeMutation = useMutationWithToast({
    mutationFn: () => closeFineractLoan(loanId),
    successMessage: 'Loan closed successfully',
    errorMessage: 'Failed to close loan',
    invalidateKeys: [['fineract-loan-detail', loanId], ['fineract-loans']],
    onSuccess: () => setActiveAction(null),
  });

  const cancelMutation = useMutationWithToast({
    mutationFn: () => cancelFineractLoan(loanId),
    successMessage: 'Loan cancelled successfully. Refund will be initiated if deposit was paid.',
    errorMessage: 'Failed to cancel loan',
    invalidateKeys: [['fineract-loan-detail', loanId], ['fineract-loans'], ['fineract-pending-loans']],
    onSuccess: () => setActiveAction(null),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium text-muted-foreground">Loan not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-brand-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const statusDisplay = getFineractStatusDisplay(loan.status.code);
  const isApproved = loan.status.code === 'loanStatusType.approved';
  const isActive = loan.status.code === 'loanStatusType.active';
  const isDefaulted = loan.status.code === 'loanStatusType.defaulted';
  const isCancellable = loan.status.code === 'loanStatusType.approved';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {loan.lyniaCustomerId ? (
                <Link href={`/customers/${loan.lyniaCustomerId}`} className="hover:text-brand-600 transition-colors">
                  {loan.customerName}
                </Link>
              ) : loan.customerName}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusDisplay.bgColor} ${statusDisplay.color}`}
            >
              {statusDisplay.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Fineract Account: {loan.fineractAccountNo} | Product:{' '}
            {loan.productName.replace('Lynia Device Finance - ', '')}
          </p>
        </div>
        <div className="flex gap-2">
          {isApproved && canApprove && (
            <button
              onClick={() => setActiveAction('disburse')}
              disabled={disburseMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {disburseMutation.isPending && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Disburse
            </button>
          )}
          {isActive && canRecordPayment && (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Record Payment
            </button>
          )}
          {isActive && canApprove && (
            <>
              <button
                onClick={() => setActiveAction('writeoff')}
                className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-card px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:bg-red-950 dark:text-red-400"
              >
                <XOctagon className="h-4 w-4" />
                Write Off
              </button>
              <button
                onClick={() => setActiveAction('close')}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                <Ban className="h-4 w-4" />
                Close
              </button>
            </>
          )}
          {isCancellable && canApprove && (
            <button
              onClick={() => setActiveAction('cancel')}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-card px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:bg-red-950 dark:text-red-400"
            >
              <Ban className="h-4 w-4" />
              Cancel Loan
            </button>
          )}
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard
          label="Principal Outstanding"
          amount={loan.principalOutstanding}
          subtitle={`${formatCurrency(loan.principalPaid)} paid of ${formatCurrency(loan.principalDisbursed)}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <BalanceCard
          label="Interest Outstanding"
          amount={loan.interestOutstanding}
          subtitle={`${formatCurrency(loan.interestPaid)} paid of ${formatCurrency(loan.interestCharged)}`}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <BalanceCard
          label="Total Outstanding"
          amount={loan.totalOutstanding}
          subtitle={`${formatCurrency(loan.totalRepayment)} paid of ${formatCurrency(loan.totalExpectedRepayment)}`}
          icon={<DollarSign className="h-5 w-5" />}
          highlight={loan.totalOverdue > 0}
        />
        {loan.totalOverdue > 0 && (
          <BalanceCard
            label="Total Overdue"
            amount={loan.totalOverdue}
            subtitle={`Since ${loan.overdueSinceDate ? formatDate(loan.overdueSinceDate) : 'N/A'}`}
            icon={<Clock className="h-5 w-5" />}
            highlight
          />
        )}
      </div>

      {/* Repayment Progress */}
      {loan.totalExpectedRepayment > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Repayment Progress
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(loan.totalRepayment)} paid
              </span>
              <span className="font-medium text-foreground">
                {((loan.totalRepayment / loan.totalExpectedRepayment) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-brand-600 transition-all"
                style={{
                  width: `${Math.min((loan.totalRepayment / loan.totalExpectedRepayment) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total: {formatCurrency(loan.totalExpectedRepayment)}</span>
              <span>Remaining: {formatCurrency(loan.totalOutstanding)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loan Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Loan Info */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Loan Details
          </h2>
          <dl className="space-y-3">
            <DetailRow label="Principal" value={formatCurrency(loan.principal)} />
            <DetailRow
              label="Interest Rate"
              value={`${loan.interestRatePerPeriod}% per month (${formatPercent(loan.annualInterestRate)} annual)`}
            />
            <DetailRow label="Interest Type" value={loan.interestType} />
            <DetailRow
              label="Repayments"
              value={`${loan.numberOfRepayments} x ${loan.repaymentEvery} ${loan.repaymentFrequency}`}
            />
            <DetailRow
              label="Amortization"
              value={loan.amortizationType}
            />
          </dl>
        </div>

        {/* Timeline */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Loan Timeline
          </h2>
          <div className="space-y-4">
            <TimelineEntry
              label="Submitted"
              date={loan.submittedOnDate}
              done={!!loan.submittedOnDate}
            />
            <TimelineEntry
              label="Approved"
              date={loan.approvedOnDate}
              done={!!loan.approvedOnDate}
            />
            <TimelineEntry
              label="Disbursed"
              date={loan.actualDisbursementDate}
              done={!!loan.actualDisbursementDate}
            />
            <TimelineEntry
              label="Expected Maturity"
              date={loan.expectedMaturityDate}
              done={!!loan.closedOnDate}
            />
            {loan.closedOnDate && (
              <TimelineEntry
                label="Closed"
                date={loan.closedOnDate}
                done
              />
            )}
            {isDefaulted && loan.defaultedAt && (
              <TimelineEntry
                label="Defaulted"
                date={loan.defaultedAt}
                done
              />
            )}
            {loan.cancelledAt && (
              <TimelineEntry
                label="Cancelled"
                date={loan.cancelledAt}
                done
              />
            )}
          </div>
        </div>

        {/* Device Info */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Smartphone className="h-5 w-5" />
            Device
          </h2>
          {loan.deviceBrand ? (
            <dl className="space-y-3">
              <DetailRow
                label="Device"
                value={`${loan.deviceBrand} ${loan.deviceModel}`}
              />
              {loan.deviceImei && (
                <div className="flex items-center justify-between border-b border-border py-2">
                  <dt className="text-sm text-muted-foreground">IMEI</dt>
                  <dd className="text-sm font-medium">
                    <Link href={`/devices?search=${loan.deviceImei}`} className="font-mono text-brand-600 hover:text-brand-700 hover:underline">
                      {loan.deviceImei}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No device assigned</p>
          )}
        </div>
      </div>

      {/* Repayment Schedule */}
      {loan.repaymentSchedule && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Repayment Schedule
          </h2>
          <RepaymentScheduleTable schedule={loan.repaymentSchedule} />
        </div>
      )}

      {/* Transaction History */}
      {loan.transactions && loan.transactions.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Transaction History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4 text-right">Principal</th>
                  <th className="pb-3 pr-4 text-right">Interest</th>
                  <th className="pb-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loan.transactions.map((tx) => (
                  <tr key={tx.id} className="text-foreground">
                    <td className="py-3 pr-4">{formatDate(tx.date)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.type === 'disbursement'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}
                      >
                        {tx.typeLabel}
                      </span>
                      {tx.manuallyReversed && (
                        <span className="ml-1 text-xs text-red-500">
                          (reversed)
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(tx.principalPortion)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(tx.interestPortion)}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatCurrency(tx.outstandingLoanBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <RecordPaymentForm
              lyniaLoanId={loan.lyniaLoanId}
              outstandingBalance={loan.totalOutstanding}
              onSuccess={() => {
                setShowPaymentForm(false);
                refetch();
              }}
              onCancel={() => setShowPaymentForm(false)}
            />
          </div>
        </div>
      )}

      {/* Disburse Confirmation */}
      <ConfirmationDialog
        open={activeAction === 'disburse'}
        onClose={() => setActiveAction(null)}
        onConfirm={() => { disburseMutation.mutateAsync(); }}
        title="Disburse Loan"
        variant="warning"
        confirmLabel="Confirm Disbursement"
        isLoading={disburseMutation.isPending}
        description={
          <div className="space-y-2 text-left">
            <p>
              Disburse {formatCurrency(loan.principal)} to{' '}
              <span className="font-medium text-foreground">{loan.customerName}</span>?
            </p>
            <p className="text-xs">
              This will create a disbursement transaction and GL journal entries in Fineract.
            </p>
          </div>
        }
      />

      {/* Write Off Confirmation */}
      <ConfirmationDialog
        open={activeAction === 'writeoff'}
        onClose={() => setActiveAction(null)}
        onConfirm={() => { writeOffMutation.mutateAsync(); }}
        title="Write Off Loan"
        variant="destructive"
        confirmLabel="Write Off"
        confirmInput="WRITE OFF"
        isLoading={writeOffMutation.isPending}
        description={
          <div className="space-y-2 text-left">
            <p>
              Write off loan for{' '}
              <span className="font-medium text-foreground">{loan.customerName}</span> with{' '}
              <span className="font-medium text-foreground">
                {formatCurrency(loan.totalOutstanding)}
              </span>{' '}
              outstanding?
            </p>
            <p className="text-xs">
              This marks the loan as a loss. The outstanding balance will be moved to a write-off GL account. This action cannot be undone.
            </p>
          </div>
        }
      />

      {/* Close Confirmation */}
      <ConfirmationDialog
        open={activeAction === 'close'}
        onClose={() => setActiveAction(null)}
        onConfirm={() => { closeMutation.mutateAsync(); }}
        title="Close Loan"
        variant="destructive"
        confirmLabel="Close Loan"
        isLoading={closeMutation.isPending}
        description={
          <div className="space-y-2 text-left">
            <p>
              Close loan for{' '}
              <span className="font-medium text-foreground">{loan.customerName}</span>?
            </p>
            {loan.totalOutstanding > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Warning: This loan still has {formatCurrency(loan.totalOutstanding)} outstanding.
              </p>
            )}
            <p className="text-xs">
              This will permanently close the loan in Fineract.
            </p>
          </div>
        }
      />

      {/* Cancel Loan Confirmation */}
      <ConfirmationDialog
        open={activeAction === 'cancel'}
        onClose={() => setActiveAction(null)}
        onConfirm={() => { cancelMutation.mutateAsync(); }}
        title="Cancel Loan"
        variant="destructive"
        confirmLabel="Cancel Loan"
        confirmInput="CANCEL"
        isLoading={cancelMutation.isPending}
        description={
          <div className="space-y-2 text-left">
            <p>
              Are you sure you want to cancel this loan?
            </p>
            <dl className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Loan</dt>
                <dd className="font-medium text-foreground">{loan.fineractAccountNo}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="font-medium text-foreground">{loan.customerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium text-foreground">{formatCurrency(loan.principal)}</dd>
              </div>
            </dl>
            <p className="text-xs text-red-600 dark:text-red-400">
              This action cannot be undone. If a deposit was paid, a refund will be initiated.
            </p>
          </div>
        }
      />
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function BalanceCard({
  label,
  amount,
  subtitle,
  icon,
  highlight,
}: {
  label: string;
  amount: number;
  subtitle: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={highlight ? 'text-red-400' : 'text-muted-foreground'}>
          {icon}
        </span>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${
          highlight ? 'text-red-700 dark:text-red-400' : 'text-foreground'
        }`}
      >
        {formatCurrency(amount)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function TimelineEntry({
  label,
  date,
  done,
}: {
  label: string;
  date: string | null;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full ${
          done
            ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {done ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {date ? formatDate(date) : 'Pending'}
        </p>
      </div>
    </div>
  );
}
