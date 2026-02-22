'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency } from '@lynia/utils';
import type { Loan } from '@/types/database';

interface CustomerLoansProps {
  loans: Loan[];
  detailed?: boolean;
}

const loanStatusMap: Record<string, { variant: 'green' | 'yellow' | 'blue' | 'red' | 'gray' | 'purple'; label: string }> = {
  active: { variant: 'green', label: 'Active' },
  pending_approval: { variant: 'yellow', label: 'Pending' },
  approved: { variant: 'blue', label: 'Approved' },
  disbursed: { variant: 'blue', label: 'Disbursed' },
  paid: { variant: 'green', label: 'Paid Off' },
  defaulted: { variant: 'red', label: 'Defaulted' },
  rejected: { variant: 'red', label: 'Rejected' },
  written_off: { variant: 'gray', label: 'Written Off' },
  draft: { variant: 'gray', label: 'Draft' },
  submitted: { variant: 'yellow', label: 'Submitted' },
};

export function CustomerLoans({ loans, detailed = false }: CustomerLoansProps) {
  if (!loans || loans.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Loan History</h2>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">No loans found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-gray-900">
        Loan History ({loans.length})
      </h2>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Loan ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Principal
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Monthly
              </th>
              {detailed && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Outstanding
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Missed
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loans.map((loan) => {
              const statusInfo = loanStatusMap[loan.status] || loanStatusMap.draft;
              return (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-primary-600">
                    {loan.id.slice(0, 8)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {formatCurrency(loan.principal)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {formatCurrency(loan.monthly_payment)}
                  </td>
                  {detailed && (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(loan.outstanding_principal + loan.outstanding_interest)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(loan.total_paid)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span
                          className={
                            loan.missed_payments > 0
                              ? 'font-medium text-red-600'
                              : 'text-gray-900'
                          }
                        >
                          {loan.missed_payments}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDate(loan.created_at)}
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
