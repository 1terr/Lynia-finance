'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCreditScoreHistory } from '@/lib/api/customers';
import { formatDate } from '@lynia/utils';

interface CreditScoreChartProps {
  customerId: string;
}

export function CreditScoreChart({ customerId }: CreditScoreChartProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['credit-score-history', customerId],
    queryFn: () => fetchCreditScoreHistory(customerId),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card p-6 shadow">
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading credit history...</p>
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="rounded-lg bg-card p-6 shadow">
        <h3 className="text-lg font-semibold text-foreground">
          Credit Score History
        </h3>
        <div className="mt-4 flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">No credit score history available</p>
        </div>
      </div>
    );
  }

  const maxScore = 1000;
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const points = history.map((entry, i) => ({
    x: padding.left + (i / Math.max(history.length - 1, 1)) * plotWidth,
    y: padding.top + plotHeight - (entry.score / maxScore) * plotHeight,
    score: entry.score,
    date: entry.created_at,
    reason: entry.reason,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <div className="rounded-lg bg-card p-6 shadow">
      <h3 className="text-lg font-semibold text-foreground">
        Credit Score History
      </h3>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          style={{ minWidth: '400px' }}
        >
          {/* Y-axis labels */}
          {[0, 250, 500, 750, 1000].map((val) => (
            <g key={val}>
              <text
                x={padding.left - 10}
                y={padding.top + plotHeight - (val / maxScore) * plotHeight + 4}
                textAnchor="end"
                className="fill-gray-400"
                fontSize="10"
              >
                {val}
              </text>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={padding.top + plotHeight - (val / maxScore) * plotHeight}
                y2={padding.top + plotHeight - (val / maxScore) * plotHeight}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
              />
            </g>
          ))}

          {/* Line */}
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
              <title>
                {formatDate(p.date)}: {p.score}
                {p.reason ? ` - ${p.reason}` : ''}
              </title>
            </g>
          ))}

          {/* X-axis dates (first and last) */}
          {points.length > 0 && (
            <>
              <text
                x={points[0].x}
                y={chartHeight - 5}
                textAnchor="start"
                className="fill-gray-400"
                fontSize="10"
              >
                {formatDate(points[0].date)}
              </text>
              {points.length > 1 && (
                <text
                  x={points[points.length - 1].x}
                  y={chartHeight - 5}
                  textAnchor="end"
                  className="fill-gray-400"
                  fontSize="10"
                >
                  {formatDate(points[points.length - 1].date)}
                </text>
              )}
            </>
          )}
        </svg>
      </div>

      {/* History table */}
      <div className="mt-4 max-h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                Score
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                Tier
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...history].reverse().map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-2 text-foreground">
                  {formatDate(entry.created_at)}
                </td>
                <td className="px-4 py-2 font-medium text-foreground">
                  {entry.score}
                </td>
                <td className="px-4 py-2 text-foreground">Tier {entry.tier}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {entry.reason || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
