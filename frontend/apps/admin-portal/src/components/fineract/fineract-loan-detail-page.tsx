'use client';

/**
 * Fineract Loan Detail Page (Phase 7 - T007)
 *
 * Displays comprehensive loan detail with Fineract balances,
 * repayment schedule, transaction history, and loan timeline.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getFineractLoanDetail } from '@/lib/api/fineract';
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
} from 'lucide-react';

interface Props {
  loanId: string;
}

export default function FineractLoanDetailPage({ loanId }: Props) {
  const router = useRouter();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const canRecordPayment = useAuthStore((s) => s.hasPermission('payments:reconcile'));

  const { data: loan, isLoading, refetch } = useQuery({
    queryKey: ['fineract-loan-detail', loanId],
    queryFn: () => getFineractLoanDetail(loanId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-lg font-medium text-gray-600">Loan not found</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {loan.customerName}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusDisplay.bgColor} ${statusDisplay.color}`}
            >
              {statusDisplay.label}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Fineract Account: {loan.fineractAccountNo} | Product:{' '}
            {loan.productName.replace('Lynia Device Finance - ', '')}
          </p>
        </div>
        {loan.status.code === 'loanStatusType.active' && canRecordPayment && (
          <button
            onClick={() => setShowPaymentForm(true)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Record Payment
          </button>
        )}
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
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Repayment Progress
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {formatCurrency(loan.totalRepayment)} paid
              </span>
              <span className="font-medium">
                {((loan.totalRepayment / loan.totalExpectedRepayment) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200">
              <div
                className="h-3 rounded-full bg-brand-600 transition-all"
                style={{
                  width: `${Math.min((loan.totalRepayment / loan.totalExpectedRepayment) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Total: {formatCurrency(loan.totalExpectedRepayment)}</span>
              <span>Remaining: {formatCurrency(loan.totalOutstanding)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loan Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Loan Info */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
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
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
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
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
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
                <DetailRow label="IMEI" value={loan.deviceImei} />
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No device assigned</p>
          )}
        </div>
      </div>

      {/* Repayment Schedule */}
      {loan.repaymentSchedule && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Repayment Schedule
          </h2>
          <RepaymentScheduleTable schedule={loan.repaymentSchedule} />
        </div>
      )}

      {/* Transaction History */}
      {loan.transactions && loan.transactions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Transaction History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4 text-right">Principal</th>
                  <th className="pb-3 pr-4 text-right">Interest</th>
                  <th className="pb-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loan.transactions.map((tx) => (
                  <tr key={tx.id} className="text-gray-700">
                    <td className="py-3 pr-4">{formatDate(tx.date)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.type === 'disbursement'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
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
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
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
          ? 'border-red-200 bg-red-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={highlight ? 'text-red-400' : 'text-gray-400'}>
          {icon}
        </span>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${
          highlight ? 'text-red-700' : 'text-gray-900'
        }`}
      >
        {formatCurrency(amount)}
      </p>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
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
            ? 'bg-green-100 text-green-600'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {done ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">
          {date ? formatDate(date) : 'Pending'}
        </p>
      </div>
    </div>
  );
}
