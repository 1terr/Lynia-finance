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

type LoanAction = 'disburse' | 'writeoff' | 'close' | null;

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Loan not found</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
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
                className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700"
              >
                <XOctagon className="h-4 w-4" />
                Write Off
              </button>
              <button
                onClick={() => setActiveAction('close')}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Ban className="h-4 w-4" />
                Close
              </button>
            </>
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
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Repayment Progress
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {formatCurrency(loan.totalRepayment)} paid
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {((loan.totalRepayment / loan.totalExpectedRepayment) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-3 rounded-full bg-brand-600 transition-all"
                style={{
                  width: `${Math.min((loan.totalRepayment / loan.totalExpectedRepayment) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Total: {formatCurrency(loan.totalExpectedRepayment)}</span>
              <span>Remaining: {formatCurrency(loan.totalOutstanding)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loan Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Loan Info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
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
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
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
          </div>
        </div>

        {/* Device Info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
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
                <div className="flex items-center justify-between border-b border-gray-100 py-2 dark:border-gray-700">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">IMEI</dt>
                  <dd className="text-sm font-medium">
                    <Link href={`/devices?search=${loan.deviceImei}`} className="font-mono text-brand-600 hover:text-brand-700 hover:underline">
                      {loan.deviceImei}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No device assigned</p>
          )}
        </div>
      </div>

      {/* Repayment Schedule */}
      {loan.repaymentSchedule && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Repayment Schedule
          </h2>
          <RepaymentScheduleTable schedule={loan.repaymentSchedule} />
        </div>
      )}

      {/* Transaction History */}
      {loan.transactions && loan.transactions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Transaction History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4 text-right">Principal</th>
                  <th className="pb-3 pr-4 text-right">Interest</th>
                  <th className="pb-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loan.transactions.map((tx) => (
                  <tr key={tx.id} className="text-gray-700 dark:text-gray-300">
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
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
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
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <span className={highlight ? 'text-red-400' : 'text-gray-400'}>
          {icon}
        </span>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${
          highlight ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {formatCurrency(amount)}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</dd>
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
            : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
        }`}
      >
        {done ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {date ? formatDate(date) : 'Pending'}
        </p>
      </div>
    </div>
  );
}
