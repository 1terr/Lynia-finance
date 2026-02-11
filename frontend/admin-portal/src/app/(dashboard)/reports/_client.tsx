'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCollectionReport,
  getRevenueReport,
  getDefaultReport,
  getKYCReport,
  getLoanApprovalReport,
  getPortfolioReport,
} from '@/lib/api/reports';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatCurrencyDetailed, formatDate } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Download,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
} from 'lucide-react';

const PIE_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return {
    from: from.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    ),
  ];
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [queryDates, setQueryDates] = useState({ from: defaults.from, to: defaults.to });

  const revenueQuery = useQuery({
    queryKey: ['reports', 'revenue', queryDates.from, queryDates.to],
    queryFn: () => getRevenueReport(queryDates.from, queryDates.to),
  });

  const collectionQuery = useQuery({
    queryKey: ['reports', 'collection', queryDates.from, queryDates.to],
    queryFn: () => getCollectionReport(queryDates.from, queryDates.to),
  });

  const portfolioQuery = useQuery({
    queryKey: ['reports', 'portfolio'],
    queryFn: () => getPortfolioReport(),
  });

  const kycQuery = useQuery({
    queryKey: ['reports', 'kyc'],
    queryFn: () => getKYCReport(),
  });

  const loanApprovalQuery = useQuery({
    queryKey: ['reports', 'loan-approval', queryDates.from, queryDates.to],
    queryFn: () => getLoanApprovalReport(queryDates.from, queryDates.to),
  });

  const defaultQuery = useQuery({
    queryKey: ['reports', 'defaults'],
    queryFn: () => getDefaultReport(),
  });

  function handleGenerate() {
    setQueryDates({ from: dateFrom, to: dateTo });
  }

  function handleExportRevenue() {
    if (revenueQuery.data) {
      downloadCSV(
        revenueQuery.data.map((r) => ({ Month: r.month, Revenue: r.total, Transactions: r.count })),
        'revenue_report'
      );
    }
  }

  function handleExportCollection() {
    if (collectionQuery.data) {
      downloadCSV(
        collectionQuery.data.map((r) => ({
          Method: r.method,
          Count: r.count,
          Total_Amount: r.total_amount,
        })),
        'collection_report'
      );
    }
  }

  function handleExportDefaults() {
    if (defaultQuery.data) {
      downloadCSV(
        defaultQuery.data.map((r) => ({
          Loan_ID: r.loan_id,
          Customer: r.customer_name,
          Phone: r.customer_phone,
          Loan_Amount: r.loan_amount_usd,
          Outstanding: r.outstanding_balance_usd,
          Days_Past_Due: r.days_past_due,
        })),
        'default_report'
      );
    }
  }

  function handleExportPortfolio() {
    if (portfolioQuery.data) {
      const p = portfolioQuery.data;
      downloadCSV(
        [
          { Bucket: 'Current', Outstanding: p.current },
          { Bucket: '1-30 DPD', Outstanding: p.par_30 },
          { Bucket: '31-60 DPD', Outstanding: p.par_60 },
          { Bucket: '61-90 DPD', Outstanding: p.par_90 },
          { Bucket: '90+ DPD', Outstanding: p.par_90_plus },
          { Bucket: 'Total', Outstanding: p.total_outstanding },
        ],
        'portfolio_report'
      );
    }
  }

  const totalRevenue = revenueQuery.data?.reduce((s, r) => s + r.total, 0) || 0;
  const totalTransactions = revenueQuery.data?.reduce((s, r) => s + r.count, 0) || 0;
  const totalCollected = collectionQuery.data?.reduce((s, r) => s + r.total_amount, 0) || 0;

  const portfolio = portfolioQuery.data;
  const portfolioRows = portfolio
    ? [
        {
          bucket: 'Current',
          amount: portfolio.current,
          pct: portfolio.total_outstanding > 0 ? (portfolio.current / portfolio.total_outstanding) * 100 : 0,
          color: 'text-green-700 bg-green-50',
        },
        {
          bucket: '1-30 DPD',
          amount: portfolio.par_30,
          pct: portfolio.total_outstanding > 0 ? (portfolio.par_30 / portfolio.total_outstanding) * 100 : 0,
          color: 'text-yellow-700 bg-yellow-50',
        },
        {
          bucket: '31-60 DPD',
          amount: portfolio.par_60,
          pct: portfolio.total_outstanding > 0 ? (portfolio.par_60 / portfolio.total_outstanding) * 100 : 0,
          color: 'text-orange-700 bg-orange-50',
        },
        {
          bucket: '61-90 DPD',
          amount: portfolio.par_90,
          pct: portfolio.total_outstanding > 0 ? (portfolio.par_90 / portfolio.total_outstanding) * 100 : 0,
          color: 'text-red-600 bg-red-50',
        },
        {
          bucket: '90+ DPD',
          amount: portfolio.par_90_plus,
          pct: portfolio.total_outstanding > 0 ? (portfolio.par_90_plus / portfolio.total_outstanding) * 100 : 0,
          color: 'text-red-800 bg-red-100',
        },
      ]
    : [];

  const kycData = kycQuery.data;
  const loanApproval = loanApprovalQuery.data;
  const approvalRate =
    loanApproval && loanApproval.total > 0
      ? ((loanApproval.approved / loanApproval.total) * 100).toFixed(1)
      : '0.0';
  const rejectionRate =
    loanApproval && loanApproval.total > 0
      ? ((loanApproval.rejected / loanApproval.total) * 100).toFixed(1)
      : '0.0';

  const pieData = portfolio
    ? [
        { name: 'Current', value: portfolio.current },
        { name: '1-30 DPD', value: portfolio.par_30 },
        { name: '31-60 DPD', value: portfolio.par_60 + portfolio.par_90 },
        { name: '90+ DPD', value: portfolio.par_90_plus },
      ].filter((d) => d.value > 0)
    : [];

  const isLoading =
    revenueQuery.isLoading ||
    collectionQuery.isLoading ||
    portfolioQuery.isLoading ||
    kycQuery.isLoading ||
    loanApprovalQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">
            Generate and export financial and operational reports.
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <Button onClick={handleGenerate} className="sm:w-auto">
              <FileText className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Financial Summary Card - Revenue Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <CardTitle>Financial Summary</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportRevenue}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xs font-medium text-green-600">Total Revenue</p>
                  <p className="mt-1 text-xl font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-600">Transactions</p>
                  <p className="mt-1 text-xl font-bold text-blue-700">{totalTransactions.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <p className="text-xs font-medium text-purple-600">Avg per Transaction</p>
                  <p className="mt-1 text-xl font-bold text-purple-700">
                    {totalTransactions > 0 ? formatCurrencyDetailed(totalRevenue / totalTransactions) : '$0.00'}
                  </p>
                </div>
              </div>
              {revenueQuery.data && revenueQuery.data.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueQuery.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => [formatCurrencyDetailed(value), 'Revenue']}
                        labelStyle={{ fontWeight: 600 }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                  No revenue data for the selected period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collection Report Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <CardTitle>Collection Report</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportCollection}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {collectionQuery.data && collectionQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Payment Method
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Count
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {collectionQuery.data.map((item) => (
                        <tr key={item.method}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            <Badge variant="default">{item.method.replace(/_/g, ' ')}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            {item.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            {formatCurrencyDetailed(item.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total Collected</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          {collectionQuery.data.reduce((s, r) => s + r.count, 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          {formatCurrencyDetailed(totalCollected)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                  No collection data for the selected period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portfolio Quality Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle>Portfolio Quality</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPortfolio}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Table */}
                <div>
                  {portfolio && (
                    <>
                      <div className="mb-3 rounded-lg bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-500">Total Outstanding</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {formatCurrency(portfolio.total_outstanding)}
                        </p>
                        <p className="text-xs text-gray-500">{portfolio.total_loans} active loans</p>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                Bucket
                              </th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                Outstanding
                              </th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                % of Portfolio
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {portfolioRows.map((row) => (
                              <tr key={row.bucket}>
                                <td className="px-4 py-2.5 text-sm">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${row.color}`}>
                                    {row.bucket}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-900">
                                  {formatCurrency(row.amount)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-sm text-gray-700">
                                  {row.pct.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Pie Chart */}
                <div>
                  {pieData.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-72 items-center justify-center text-sm text-gray-500">
                      No portfolio data available.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operational Metrics Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                <CardTitle>Operational Metrics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* KYC Stats */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-700">KYC Submissions</h4>
                  {kycData ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Total Submissions</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {kycData.total_submissions.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Approved</span>
                        <Badge variant="status" status="approved">
                          {kycData.approved.toLocaleString()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Rejected</span>
                        <Badge variant="status" status="rejected">
                          {kycData.rejected.toLocaleString()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Pending</span>
                        <Badge variant="status" status="pending">
                          {kycData.pending.toLocaleString()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Avg Processing Time</span>
                        <span className="text-sm font-medium text-gray-900">
                          {kycData.avg_processing_time_hours.toFixed(1)} hours
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No KYC data available.</p>
                  )}
                </div>

                {/* Loan Approval Stats */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-700">Loan Approvals</h4>
                  {loanApproval ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Total Applications</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {loanApproval.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Approved</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="status" status="approved">
                            {loanApproval.approved.toLocaleString()}
                          </Badge>
                          <span className="text-xs text-gray-500">({approvalRate}%)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Rejected</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="status" status="rejected">
                            {loanApproval.rejected.toLocaleString()}
                          </Badge>
                          <span className="text-xs text-gray-500">({rejectionRate}%)</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Pending</span>
                        <Badge variant="status" status="pending">
                          {loanApproval.pending.toLocaleString()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <span className="text-sm text-gray-600">Auto-Approved</span>
                        <span className="text-sm font-medium text-gray-900">
                          {loanApproval.auto_approved.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No loan approval data available.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Defaults Summary */}
          {defaultQuery.data && defaultQuery.data.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle>Defaulted Loans</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportDefaults}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-gray-500">
                  {defaultQuery.data.length} defaulted loan{defaultQuery.data.length !== 1 ? 's' : ''} with{' '}
                  {formatCurrency(defaultQuery.data.reduce((s, r) => s + r.outstanding_balance_usd, 0))} total outstanding.
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Customer
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Loan Amount
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Outstanding
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          Days Past Due
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Maturity Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {defaultQuery.data.slice(0, 10).map((row) => (
                        <tr key={row.loan_id}>
                          <td className="px-4 py-2.5 text-sm">
                            <p className="font-medium text-gray-900">{row.customer_name}</p>
                            <p className="text-xs text-gray-500">{row.customer_phone}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-gray-700">
                            {formatCurrency(row.loan_amount_usd)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-medium text-red-600">
                            {formatCurrency(row.outstanding_balance_usd)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm">
                            <span className="font-medium text-red-600">{row.days_past_due}d</span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-500">
                            {row.maturity_date ? formatDate(row.maturity_date) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {defaultQuery.data.length > 10 && (
                    <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-center text-xs text-gray-500">
                      Showing 10 of {defaultQuery.data.length} defaulted loans. Export CSV for full list.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
