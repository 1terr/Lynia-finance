'use client';

/**
 * GL Accounting Dashboard (Phase 7 - T017)
 *
 * Displays Fineract General Ledger accounts, journal entries,
 * and trial balance for regulatory reporting (RBZ compliance).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getGLAccounts,
  getJournalEntries,
  getTrialBalance,
  type JournalEntryFilters,
} from '@/lib/api/fineract';
import { formatCurrency, formatDate } from '@lynia/utils';
import { BookOpen, FileText, Calculator } from 'lucide-react';

type TabId = 'accounts' | 'journal' | 'trial-balance';

export default function GLAccountingDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('accounts');
  const [journalFilters, setJournalFilters] = useState<JournalEntryFilters>({
    page: 1,
    limit: 50,
  });

  const { data: accounts } = useQuery({
    queryKey: ['gl-accounts'],
    queryFn: getGLAccounts,
  });

  const { data: journalData } = useQuery({
    queryKey: ['journal-entries', journalFilters],
    queryFn: () => getJournalEntries(journalFilters),
  });

  const { data: trialBalance } = useQuery({
    queryKey: ['trial-balance'],
    queryFn: () => getTrialBalance(),
  });

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'accounts', label: 'GL Accounts', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'journal', label: 'Journal Entries', icon: <FileText className="h-4 w-4" /> },
    { id: 'trial-balance', label: 'Trial Balance', icon: <Calculator className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          General Ledger
        </h1>
        <p className="text-sm text-muted-foreground">
          Fineract accounting entries for RBZ regulatory reporting.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* GL Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(accounts || []).map((acct) => (
                <tr key={acct.id} className="text-foreground">
                  <td className="px-4 py-3 font-mono text-xs font-medium">
                    {acct.glCode}
                  </td>
                  <td className="px-4 py-3 font-medium">{acct.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        acct.type === 'ASSET'
                          ? 'bg-blue-100 text-blue-800'
                          : acct.type === 'LIABILITY'
                            ? 'bg-orange-100 text-orange-800'
                            : acct.type === 'INCOME'
                              ? 'bg-green-100 text-green-800'
                              : acct.type === 'EXPENSE'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-muted text-foreground'
                      }`}
                    >
                      {acct.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {acct.usage}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {acct.description || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Journal Entries Tab */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {/* Date Filters */}
          <div className="flex gap-4">
            <div>
              <label htmlFor="journal-from-date" className="block text-sm font-medium text-foreground">
                From Date
              </label>
              <input
                id="journal-from-date"
                type="date"
                value={journalFilters.fromDate || ''}
                onChange={(e) =>
                  setJournalFilters((f) => ({
                    ...f,
                    fromDate: e.target.value || undefined,
                    page: 1,
                  }))
                }
                className="mt-1 rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="journal-to-date" className="block text-sm font-medium text-foreground">
                To Date
              </label>
              <input
                id="journal-to-date"
                type="date"
                value={journalFilters.toDate || ''}
                onChange={(e) =>
                  setJournalFilters((f) => ({
                    ...f,
                    toDate: e.target.value || undefined,
                    page: 1,
                  }))
                }
                className="mt-1 rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Journal Table */}
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <h2 className="border-b border-border bg-muted px-4 py-3 text-sm font-semibold text-foreground">
              Journal Entries
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Txn ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(journalData?.data || []).map((entry) => (
                  <tr key={entry.id} className="text-foreground">
                    <td className="px-4 py-3">
                      {formatDate(entry.transactionDate)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.glAccountName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {entry.glAccountCode}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.entryType === 'DEBIT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {entry.entryType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {entry.entityType} #{entry.entityId}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {entry.transactionId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trial Balance Tab */}
      {activeTab === 'trial-balance' && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <h2 className="border-b border-border bg-muted px-4 py-3 text-sm font-semibold text-foreground">
            Trial Balance
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(trialBalance || []).map((entry) => (
                <tr key={entry.glAccountId} className="text-foreground">
                  <td className="px-4 py-3 font-mono text-xs font-medium">
                    {entry.glAccountCode}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {entry.glAccountName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.glAccountType === 'ASSET'
                          ? 'bg-blue-100 text-blue-800'
                          : entry.glAccountType === 'INCOME'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-muted text-foreground'
                      }`}
                    >
                      {entry.glAccountType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(entry.totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(entry.totalCredit)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      entry.balance < 0 ? 'text-red-600' : 'text-foreground'
                    }`}
                  >
                    {formatCurrency(Math.abs(entry.balance))}
                    {entry.balance < 0 ? ' CR' : ' DR'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted font-semibold text-foreground">
                <td className="px-4 py-3" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(
                    (trialBalance || []).reduce(
                      (sum, e) => sum + e.totalDebit,
                      0
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(
                    (trialBalance || []).reduce(
                      (sum, e) => sum + e.totalCredit,
                      0
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(
                    Math.abs(
                      (trialBalance || []).reduce(
                        (sum, e) => sum + e.balance,
                        0
                      )
                    )
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
