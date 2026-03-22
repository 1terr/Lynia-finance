'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@lynia/utils';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  FileSpreadsheet,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { fetchAPI } from '@/lib/api/client';
import { getValidSession } from '@lynia/auth';
import dynamic from 'next/dynamic';

const WhatsAppFunnel = dynamic(
  () => import('@/components/analytics/whatsapp-funnel'),
  { ssr: false }
);

async function fetchInvestorData(endpoint: string, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchAPI<any>(`/api/v1/investor/${endpoint}${query}`);
}

const PAR_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#991b1b'];
const TIER_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4'];

type Tab = 'portfolio' | 'vintage' | 'borrowing-base' | 'financials' | 'covenants' | 'whatsapp-funnel';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const { data: freshnessData } = useQuery({
    queryKey: ['investor', 'data-freshness'],
    queryFn: () => fetchInvestorData('data-freshness'),
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['investor'] });
    setLastRefreshed(new Date());
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'portfolio', label: 'Portfolio', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'vintage', label: 'Vintage', icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'borrowing-base', label: 'Borrowing Base', icon: <DollarSign className="h-4 w-4" /> },
    { key: 'financials', label: 'Financials', icon: <PieChartIcon className="h-4 w-4" /> },
    { key: 'covenants', label: 'Covenants', icon: <Shield className="h-4 w-4" /> },
    { key: 'whatsapp-funnel', label: 'WhatsApp Funnel', icon: <MessageSquare className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics & BI</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Real-time investor-grade portfolio analytics
            </p>
            {freshnessData?.latest_snapshot_date && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Data as of: {new Date(freshnessData.latest_snapshot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadLoanTape()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Loan Tape (CSV)
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'portfolio' && <PortfolioTab />}
      {activeTab === 'vintage' && <VintageTab />}
      {activeTab === 'borrowing-base' && <BorrowingBaseTab />}
      {activeTab === 'financials' && <FinancialsTab />}
      {activeTab === 'covenants' && <CovenantsTab />}
      {activeTab === 'whatsapp-funnel' && <WhatsAppFunnel />}
    </div>
  );
}

function PortfolioTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['investor', 'portfolio'],
    queryFn: () => fetchInvestorData('portfolio'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.portfolio_size) return <NoDataMessage />;

  const portfolio = data.portfolio_size;
  const par = data.portfolio_at_risk;
  const npl = data.non_performing;
  const tiers = data.tier_distribution;
  const trend = data.trend_30d || [];

  const parChartData = [
    { name: 'PAR 7', amount: par.par_7.amount, pct: (par.par_7.pct * 100).toFixed(1) },
    { name: 'PAR 30', amount: par.par_30.amount, pct: (par.par_30.pct * 100).toFixed(1) },
    { name: 'PAR 60', amount: par.par_60.amount, pct: (par.par_60.pct * 100).toFixed(1) },
    { name: 'PAR 90', amount: par.par_90.amount, pct: (par.par_90.pct * 100).toFixed(1) },
  ];

  const tierData = [
    { name: 'Tier 1', value: tiers.tier_1.count, color: TIER_COLORS[0] },
    { name: 'Tier 2', value: tiers.tier_2.count, color: TIER_COLORS[1] },
    { name: 'Tier 3', value: tiers.tier_3.count, color: TIER_COLORS[2] },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Outstanding"
          value={formatCurrency(portfolio.total_outstanding)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Active Loans"
          value={portfolio.active_loans.toLocaleString()}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          title="NPL Ratio"
          value={`${(npl.npl_ratio * 100).toFixed(2)}%`}
          icon={npl.npl_ratio > 0.05 ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Shield className="h-4 w-4 text-green-500" />}
          variant={npl.npl_ratio > 0.05 ? 'destructive' : 'default'}
        />
        <MetricCard
          title="Avg DPD"
          value={portfolio.avg_days_past_due.toFixed(1)}
          subtitle="days"
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* PAR Buckets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio at Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={parChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]}>
                  {parChartData.map((_, i) => (
                    <Cell key={i} fill={PAR_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={tierData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label>
                  {tierData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 30-Day Trend */}
      {trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">30-Day Outstanding Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Line type="monotone" dataKey="outstanding" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="collections" stroke="#22c55e" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VintageTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['investor', 'vintages'],
    queryFn: () => fetchInvestorData('vintages'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.vintages || Object.keys(data.vintages).length === 0) return <NoDataMessage />;

  const vintages = data.vintages as Record<string, {
    cohort_size: number;
    cohort_principal: number;
    performance: Array<{ months_on_book: number; default_rate: number; loss_rate: number }>;
  }>;

  // Build chart data: one line per vintage
  const maxMob = Math.max(...Object.values(vintages).flatMap(v => v.performance.map(p => p.months_on_book)));
  const chartData = Array.from({ length: maxMob + 1 }, (_, mob) => {
    const point: Record<string, unknown> = { mob };
    for (const [period, vintage] of Object.entries(vintages)) {
      const perf = vintage.performance.find(p => p.months_on_book === mob);
      point[period] = perf ? (perf.default_rate * 100).toFixed(2) : null;
    }
    return point;
  });

  const vintagePeriods = Object.keys(vintages).slice(-6); // Last 6 vintages
  const lineColors = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cumulative Default Rate by Vintage</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mob" label={{ value: 'Months on Book', position: 'bottom' }} />
              <YAxis label={{ value: 'Default Rate (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {vintagePeriods.map((period, i) => (
                <Line
                  key={period}
                  type="monotone"
                  dataKey={period}
                  stroke={lineColors[i % lineColors.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Vintage Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vintage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Vintage</th>
                  <th className="text-right py-2 px-3">Loans</th>
                  <th className="text-right py-2 px-3">Principal</th>
                  <th className="text-right py-2 px-3">Latest Default Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(vintages).map(([period, v]) => {
                  const latestPerf = v.performance[v.performance.length - 1];
                  return (
                    <tr key={period} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{period}</td>
                      <td className="text-right py-2 px-3">{v.cohort_size}</td>
                      <td className="text-right py-2 px-3">{formatCurrency(v.cohort_principal)}</td>
                      <td className="text-right py-2 px-3">
                        <Badge variant={latestPerf?.default_rate > 0.05 ? 'destructive' : 'secondary'}>
                          {((latestPerf?.default_rate || 0) * 100).toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BorrowingBaseTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['investor', 'borrowing-base'],
    queryFn: () => fetchInvestorData('borrowing-base'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.receivables) return <NoDataMessage />;

  const rec = data.receivables;
  const conc = data.concentration;
  const bb = data.borrowing_base;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <MetricCard title="Total Receivables" value={formatCurrency(rec.total)} icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard title="Eligible Receivables" value={formatCurrency(rec.eligible)} subtitle={`${(rec.eligibility_rate * 100).toFixed(1)}% eligible`} icon={<Shield className="h-4 w-4 text-green-500" />} />
        <MetricCard title="Available Borrowing Base" value={formatCurrency(bb.available)} subtitle={`${(bb.advance_rate * 100).toFixed(0)}% advance rate`} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Ineligibility Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <IneligibilityRow label="DPD 30+" amount={data.ineligibility_breakdown.dpd_30_plus} total={rec.ineligible} />
              <IneligibilityRow label="Written Off" amount={data.ineligibility_breakdown.written_off} total={rec.ineligible} />
              <IneligibilityRow label="Restructured" amount={data.ineligibility_breakdown.restructured} total={rec.ineligible} />
              <IneligibilityRow label="KYC Incomplete" amount={data.ineligibility_breakdown.kyc_incomplete} total={rec.ineligible} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Concentration Limits</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ConcentrationRow label="Single Borrower" pct={conc.single_borrower.pct_of_portfolio} limit={0.05} />
              <ConcentrationRow label="Top 10 Borrowers" pct={conc.top_10.pct_of_portfolio} limit={0.30} />
              <ConcentrationRow label={`Province (${conc.geography.largest_province})`} pct={conc.geography.pct_of_portfolio} limit={0.40} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinancialsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['investor', 'financials'],
    queryFn: () => fetchInvestorData('financials'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.latest_month) return <NoDataMessage />;

  const latest = data.latest_month;
  const trend = data.monthly_trend || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={formatCurrency(latest.total_revenue)} subtitle={latest.month} icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard title="Net Yield" value={`${(latest.net_yield_pct * 100).toFixed(2)}%`} icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard title="Collection Rate" value={`${(latest.collection_rate * 100).toFixed(1)}%`} icon={<BarChart3 className="h-4 w-4" />} />
        <MetricCard title="Repeat Borrowers" value={`${(latest.repeat_borrower_rate * 100).toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {trend.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Revenue & Collections</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collections" fill="#22c55e" name="Collections" radius={[4, 4, 0, 0]} />
                <Bar dataKey="write_offs" fill="#ef4444" name="Write-offs" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CovenantsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['investor', 'covenant-compliance'],
    queryFn: () => fetchInvestorData('covenant-compliance'),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.tests) return <NoDataMessage />;

  const tests = data.tests as Array<{
    covenant: string;
    description: string;
    threshold: number;
    actual: number;
    unit: string;
    status: 'pass' | 'fail';
    headroom: number;
  }>;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <MetricCard
          title="Overall Status"
          value={data.overall_status === 'compliant' ? 'Compliant' : 'Breach'}
          variant={data.overall_status === 'compliant' ? 'default' : 'destructive'}
          icon={data.overall_status === 'compliant' ? <Shield className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
        />
        <MetricCard title="Tests Passed" value={`${data.summary.passed}/${data.summary.total_tests}`} icon={<Shield className="h-4 w-4" />} />
        <MetricCard title="Compliance Rate" value={`${(data.summary.compliance_rate * 100).toFixed(0)}%`} icon={<BarChart3 className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Covenant Tests</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tests.map((test) => (
              <div key={test.covenant} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={test.status === 'pass' ? 'secondary' : 'destructive'}>
                      {test.status.toUpperCase()}
                    </Badge>
                    <span className="font-medium text-sm">{test.covenant.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{test.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">
                    {test.unit === 'percentage' ? `${(test.actual * 100).toFixed(2)}%` : test.actual.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Limit: {test.unit === 'percentage' ? `${(test.threshold * 100).toFixed(1)}%` : test.threshold}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Shared Components

function MetricCard({ title, value, subtitle, icon, variant }: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive';
}) {
  return (
    <Card className={variant === 'destructive' ? 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 dark:bg-red-950' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          {icon}
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function IneligibilityRow({ label, amount, total }: { label: string; amount: number; total: number }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium">{formatCurrency(amount)}</span>
        <span className="text-xs text-muted-foreground ml-2">({pct.toFixed(0)}%)</span>
      </div>
    </div>
  );
}

function ConcentrationRow({ label, pct, limit }: { label: string; pct: number; limit: number }) {
  const isBreached = pct > limit;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant={isBreached ? 'destructive' : 'secondary'}>
          {(pct * 100).toFixed(1)}%
        </Badge>
        <span className="text-xs text-muted-foreground">/ {(limit * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-4">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-6 w-16 bg-muted rounded animate-pulse mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NoDataMessage() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">No Data Available</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Data warehouse is being populated in real-time. Data will appear as loans and payments are processed.
        </p>
      </CardContent>
    </Card>
  );
}

async function downloadLoanTape() {
  const session = await getValidSession();
  if (!session) return;
  const token = session.getIdToken().getJwtToken();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  try {
    const res = await fetch(`${apiBase}/api/v1/investor/loan-tape?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `loan-tape-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    alert('Failed to download loan tape. Please try again.');
  }
}
