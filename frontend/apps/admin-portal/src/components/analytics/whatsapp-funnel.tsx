'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { fetchAPI } from '@/lib/api/client';

interface FunnelStep {
  state: string;
  count: number;
  drop_off_rate: number;
  avg_time_seconds: number | null;
}

interface FunnelData {
  total_sessions: number;
  completed: number;
  abandoned: number;
  active: number;
  completion_rate: number;
  avg_duration_seconds: number | null;
  funnel: FunnelStep[];
  top_drop_off_states: Array<{
    state: string;
    drop_off_rate: number;
    count: number;
  }>;
}

/** Human-readable labels for onboarding states */
const STATE_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  phone_validation: 'Phone Validation',
  personal_info_name: 'Name',
  personal_info_dob: 'Date of Birth',
  personal_info_gender: 'Gender',
  personal_info_location: 'Location',
  employment_type: 'Employment Type',
  employment_income: 'Income',
  employment_debts: 'Debts',
  employment_household: 'Household',
  product_selection: 'Product Selection',
  org_verification: 'Org Verification',
  digital_product_selection: 'Digital Product',
  kyc_id_upload: 'ID Upload',
  kyc_selfie_upload: 'Selfie Upload',
  kyc_processing: 'KYC Processing',
  credit_scoring: 'Credit Scoring',
  device_selection: 'Device Selection',
  amount_selection: 'Amount Selection',
  term_selection: 'Term Selection',
  loan_summary: 'Loan Summary',
  loan_offer: 'Loan Offer',
  disbursement_method_selection: 'Disbursement Method',
  terms_acceptance: 'Terms Acceptance',
  completed: 'Completed',
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** Color gradient from green to red based on position in funnel */
function getFunnelColor(index: number, total: number): string {
  const ratio = total > 1 ? index / (total - 1) : 0;
  // Green (120) -> Yellow (60) -> Red (0)
  const hue = Math.round(120 * (1 - ratio));
  return `hsl(${hue}, 70%, 50%)`;
}

export default function WhatsAppFunnel() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productCategory, setProductCategory] = useState('');

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set('start_date', startDate);
  if (endDate) queryParams.set('end_date', endDate);
  if (productCategory) queryParams.set('product_category', productCategory);
  const queryString = queryParams.toString();

  const { data, isLoading, error } = useQuery<FunnelData>({
    queryKey: ['whatsapp-funnel', startDate, endDate, productCategory],
    queryFn: () =>
      fetchAPI<FunnelData>(
        `/admin/analytics/whatsapp-funnel${queryString ? `?${queryString}` : ''}`
      ),
    refetchInterval: 60_000,
  });

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Failed to Load Funnel Data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter funnel to only show states with data
  const activeFunnel = data?.funnel?.filter(s => s.count > 0) || [];

  const chartData = activeFunnel.map((step, i) => ({
    name: STATE_LABELS[step.state] || step.state,
    count: step.count,
    dropOff: step.drop_off_rate,
    fill: getFunnelColor(i, activeFunnel.length),
  }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="funnel-start-date" className="text-xs text-muted-foreground block mb-1">Start Date</label>
              <input
                id="funnel-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-background"
              />
            </div>
            <div>
              <label htmlFor="funnel-end-date" className="text-xs text-muted-foreground block mb-1">End Date</label>
              <input
                id="funnel-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-background"
              />
            </div>
            <div>
              <label htmlFor="funnel-product-category" className="text-xs text-muted-foreground block mb-1">Product Category</label>
              <select
                id="funnel-product-category"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm bg-background"
              >
                <option value="">All</option>
                <option value="smartphone">Smartphone</option>
                <option value="digital_credit">Digital Credit</option>
              </select>
            </div>
            {(startDate || endDate || productCategory) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setProductCategory(''); }}
                className="text-xs text-muted-foreground underline pb-1"
              >
                Clear filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Sessions"
          value={data?.total_sessions?.toLocaleString() || '--'}
          icon={<Users className="h-4 w-4" />}
          loading={isLoading}
        />
        <SummaryCard
          title="Completion Rate"
          value={data ? `${data.completion_rate.toFixed(1)}%` : '--'}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          loading={isLoading}
        />
        <SummaryCard
          title="Avg Duration"
          value={formatDuration(data?.avg_duration_seconds ?? null)}
          icon={<Clock className="h-4 w-4" />}
          loading={isLoading}
        />
        <SummaryCard
          title="Abandoned"
          value={data?.abandoned?.toLocaleString() || '--'}
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          loading={isLoading}
        />
      </div>

      {/* Funnel Chart */}
      {!isLoading && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Onboarding Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 32)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'count') return [value.toLocaleString(), 'Sessions'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Drop-off States */}
      {!isLoading && data?.top_drop_off_states && data.top_drop_off_states.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Top Drop-off Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.top_drop_off_states.map((s) => (
                <div
                  key={s.state}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {STATE_LABELS[s.state] || s.state}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.count.toLocaleString()} sessions reached
                    </span>
                  </div>
                  <Badge variant={s.drop_off_rate > 50 ? 'destructive' : 'secondary'}>
                    {s.drop_off_rate.toFixed(1)}% drop-off
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Funnel Table */}
      {!isLoading && activeFunnel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed State Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">State</th>
                    <th className="text-right py-2 px-3">Sessions</th>
                    <th className="text-right py-2 px-3">Drop-off</th>
                    <th className="text-right py-2 px-3">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFunnel.map((step) => (
                    <tr key={step.state} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">
                        {STATE_LABELS[step.state] || step.state}
                      </td>
                      <td className="text-right py-2 px-3">
                        {step.count.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-3">
                        <Badge
                          variant={
                            step.drop_off_rate > 30
                              ? 'destructive'
                              : step.drop_off_rate > 15
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {step.drop_off_rate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-3 text-muted-foreground">
                        {formatDuration(step.avg_time_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && (!data || data.total_sessions === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Session Data</h3>
            <p className="text-sm text-muted-foreground mt-1">
              WhatsApp onboarding session data will appear here as customers interact with the bot.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
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
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          {icon}
        </div>
        {loading ? (
          <div className="h-6 w-16 bg-muted rounded animate-pulse mt-1" />
        ) : (
          <p className="text-xl font-bold mt-1">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
