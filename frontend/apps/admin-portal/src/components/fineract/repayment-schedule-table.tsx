'use client';

/**
 * Repayment Schedule Table (Phase 7 - T011)
 *
 * Renders the Fineract-generated repayment schedule with period-level
 * breakdown of principal, interest, fees, and status indicators.
 */

import { formatCurrency, formatDate } from '@lynia/utils';
import type { RepaymentSchedule, RepaymentPeriod } from '@/types/fineract';

interface Props {
  schedule: RepaymentSchedule;
}

export default function RepaymentScheduleTable({ schedule }: Props) {
  const today = new Date().toISOString().split('T')[0];

  function getPeriodStatus(period: RepaymentPeriod): {
    label: string;
    className: string;
  } {
    if (period.complete) {
      return { label: 'Paid', className: 'bg-green-100 text-green-800' };
    }
    if (period.totalOverdue > 0 || period.dueDate < today) {
      return { label: 'Overdue', className: 'bg-red-100 text-red-800' };
    }
    return { label: 'Due', className: 'bg-yellow-100 text-yellow-800' };
  }

  return (
    <div className="space-y-4">
      {/* Schedule Summary */}
      <div className="rounded-md bg-muted p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Schedule Summary
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryItem
            label="Total Expected"
            value={formatCurrency(schedule.totalRepaymentExpected)}
          />
          <SummaryItem
            label="Total Paid"
            value={formatCurrency(schedule.totalRepayment)}
          />
          <SummaryItem
            label="Total Outstanding"
            value={formatCurrency(schedule.totalOutstanding)}
          />
          <SummaryItem
            label="Loan Term"
            value={`${schedule.loanTermInDays} days`}
          />
        </div>
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
              <th className="pb-3 pr-4">#</th>
              <th className="pb-3 pr-4">Due Date</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4 text-right">Principal</th>
              <th className="pb-3 pr-4 text-right">Interest</th>
              <th className="pb-3 pr-4 text-right">Total Due</th>
              <th className="pb-3 pr-4 text-right">Paid</th>
              <th className="pb-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {schedule.periods.map((period) => {
              const status = getPeriodStatus(period);
              const isOverdue =
                !period.complete && period.dueDate < today;

              return (
                <tr
                  key={period.period}
                  className={`${
                    isOverdue ? 'bg-red-50 dark:bg-red-950' : ''
                  } text-foreground`}
                >
                  <td className="py-3 pr-4 font-medium">{period.period}</td>
                  <td className="py-3 pr-4">
                    {formatDate(period.dueDate)}
                    {period.paidDate && (
                      <div className="text-xs text-muted-foreground">
                        Paid {formatDate(period.paidDate)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {formatCurrency(period.principalDue)}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {formatCurrency(period.interestDue)}
                  </td>
                  <td className="py-3 pr-4 text-right font-medium">
                    {formatCurrency(period.totalDue)}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {formatCurrency(period.totalPaid)}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {formatCurrency(period.balanceOfLoan)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
