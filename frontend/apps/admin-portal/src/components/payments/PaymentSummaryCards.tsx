'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPaymentSummary } from '@/lib/api/payments';
import { formatCurrency } from '@lynia/utils';

interface PaymentSummaryCardsProps {
  dateFrom?: string;
  dateTo?: string;
}

export function PaymentSummaryCards({ dateFrom, dateTo }: PaymentSummaryCardsProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['payment-summary', dateFrom, dateTo],
    queryFn: () => fetchPaymentSummary(dateFrom, dateTo),
  });

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg bg-card p-6 shadow"
          >
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-2 h-8 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Confirmed',
      amount: summary.total_confirmed,
      count: summary.count_confirmed,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950',
      border: 'border-green-200',
    },
    {
      label: 'Pending',
      amount: summary.total_pending,
      count: summary.count_pending,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-950',
      border: 'border-yellow-200',
    },
    {
      label: 'Failed',
      amount: summary.total_failed,
      count: summary.count_failed,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200',
    },
    {
      label: 'Refunded',
      amount: summary.total_refunded,
      count: summary.count_refunded,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
      border: 'border-border',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg border ${card.border} ${card.bg} p-6`}
        >
          <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
          <p className={`mt-1 text-2xl font-bold ${card.color}`}>
            {formatCurrency(card.amount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {card.count} payment{card.count !== 1 ? 's' : ''}
          </p>
        </div>
      ))}
    </div>
  );
}
