'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRange, ReportFilters } from '@/types/reports';
import { DateRangeFilter, getPresetDates } from '@/components/reports/date-range-filter';
import { MetricCard } from '@/components/reports/metric-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoanDisbursementReport } from '@/components/reports/loan-disbursement-report';
import { PaymentCollectionReport } from '@/components/reports/payment-collection-report';
import { KycStatusReport } from '@/components/reports/kyc-status-report';
import { DefaultRateReport } from '@/components/reports/default-rate-report';
import { DeviceManagementReport } from '@/components/reports/device-management-report';
import { CustomerAcquisitionReport } from '@/components/reports/customer-acquisition-report';
import {
  getDefaultReport,
  getKYCReport,
  getLoanApprovalReport,
  getCollectionReport,
} from '@/lib/api/reports';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const escape = (val: unknown) => {
    let str = val === null || val === undefined ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const csvRows = [
    headers.map(escape).join(','),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/[^a-zA-Z0-9_\-]/g, '_')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Summary KPI Bar — lightweight queries for cross-cutting metrics
// ---------------------------------------------------------------------------

function SummaryKPIBar({ dateRange }: { dateRange: DateRange }) {
  const kycQuery = useQuery({
    queryKey: ['reports', 'kyc-summary'],
    queryFn: () => getKYCReport(),
  });

  const loanQuery = useQuery({
    queryKey: ['reports', 'loan-approval-summary', dateRange.from, dateRange.to],
    queryFn: () => getLoanApprovalReport(dateRange.from, dateRange.to),
  });

  const defaultsQuery = useQuery({
    queryKey: ['reports', 'defaults-summary'],
    queryFn: () => getDefaultReport(),
  });

  const collectionQuery = useQuery({
    queryKey: ['reports', 'collection-summary', dateRange.from, dateRange.to],
    queryFn: () => getCollectionReport(dateRange.from, dateRange.to),
  });

  const isLoading =
    kycQuery.isLoading || loanQuery.isLoading || defaultsQuery.isLoading || collectionQuery.isLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }

  const kyc = kycQuery.data;
  const loans = loanQuery.data;
  const defaults = defaultsQuery.data;
  const collections = collectionQuery.data;

  const totalCollected = collections?.reduce((s, r) => s + r.total_amount, 0) ?? 0;
  const kycApprovalRate =
    kyc && kyc.total_submissions > 0
      ? (kyc.approved / kyc.total_submissions) * 100
      : 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Loans Approved"
        value={loans ? loans.approved.toLocaleString() : '0'}
        subtitle="this period"
      />
      <MetricCard
        label="Total Collected"
        value={formatCurrency(totalCollected)}
        subtitle="this period"
      />
      <MetricCard
        label="KYC Approval"
        value={`${kycApprovalRate.toFixed(1)}%`}
        subtitle="approval rate"
      />
      <MetricCard
        label="Active Defaults"
        value={defaults ? defaults.length.toLocaleString() : '0'}
        subtitle="defaulted loans"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Defaulted Loans Table — individual loan-level detail
// ---------------------------------------------------------------------------

function DefaultedLoansTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'defaults-list'],
    queryFn: () => getDefaultReport(),
  });

  const handleExport = () => {
    if (!data) return;
    downloadCSV(
      data.map((r) => ({
        Loan_ID: r.loan_id,
        Customer: r.customer_name,
        Phone: r.customer_phone,
        Loan_Amount: r.loan_amount_usd,
        Outstanding: r.outstanding_balance_usd,
        Days_Past_Due: r.days_past_due,
      })),
      'defaulted_loans_detail'
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No defaulted loans found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <CardTitle className="text-base">Individual Defaulted Loans</CardTitle>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          {data.length} defaulted loan{data.length !== 1 ? 's' : ''} with{' '}
          {formatCurrency(data.reduce((s, r) => s + r.outstanding_balance_usd, 0))} total
          outstanding.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  Loan Amount
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  Outstanding
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  Days Past Due
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Maturity
                </th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row) => (
                <tr
                  key={row.loan_id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{row.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{row.customer_phone}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {formatCurrency(row.loan_amount_usd)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-red-600">
                    {formatCurrency(row.outstanding_balance_usd)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge variant={row.days_past_due > 90 ? 'red' : 'yellow'}>
                      {row.days_past_due}d
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {row.maturity_date ? formatDate(row.maturity_date) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 10 && (
            <div className="border-t bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
              Showing 10 of {data.length} defaulted loans. Export CSV for full list.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const defaultDates = getPresetDates('30d');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: defaultDates.from,
    to: defaultDates.to,
    preset: '30d',
  });

  const filters: ReportFilters = useMemo(() => ({ dateRange }), [dateRange]);

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* Header: Title + Date Range Filter                                 */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations Reports</h1>
          <p className="text-sm text-muted-foreground">
            Real-time operational intelligence across all business functions.
          </p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* ================================================================= */}
      {/* Summary KPI Bar                                                    */}
      {/* ================================================================= */}
      <SummaryKPIBar dateRange={dateRange} />

      {/* ================================================================= */}
      {/* Tab Navigation + Content                                           */}
      {/* ================================================================= */}
      <Tabs defaultValue="disbursements" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
            <TabsTrigger value="disbursements">Disbursements</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="kyc">KYC Pipeline</TabsTrigger>
            <TabsTrigger value="defaults">Defaults & Recovery</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
          </TabsList>
        </div>

        {/* --- Disbursements Tab --- */}
        <TabsContent value="disbursements">
          <LoanDisbursementReport filters={filters} />
        </TabsContent>

        {/* --- Collections Tab --- */}
        <TabsContent value="collections">
          <PaymentCollectionReport filters={filters} />
        </TabsContent>

        {/* --- KYC Pipeline Tab --- */}
        <TabsContent value="kyc">
          <KycStatusReport filters={filters} />
        </TabsContent>

        {/* --- Defaults & Recovery Tab --- */}
        <TabsContent value="defaults">
          <div className="space-y-6">
            <DefaultRateReport filters={filters} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
              <span>Individual defaulted loans below</span>
            </div>
            <DefaultedLoansTable />
          </div>
        </TabsContent>

        {/* --- Devices Tab --- */}
        <TabsContent value="devices">
          <DeviceManagementReport filters={filters} />
        </TabsContent>

        {/* --- Customer Acquisition Tab --- */}
        <TabsContent value="acquisition">
          <CustomerAcquisitionReport filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
