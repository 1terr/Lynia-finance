'use client';

import { Card } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Package, CreditCard, DollarSign, Percent } from 'lucide-react';

interface ProductStatsProps {
  activeProducts: number;
  totalLoans: number;
  totalVolume: number;
  avgInterestRate: number;
}

export function ProductStats({ activeProducts, totalLoans, totalVolume, avgInterestRate }: ProductStatsProps) {
  const stats = [
    {
      label: 'Active Products',
      value: formatNumber(activeProducts),
      icon: Package,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Total Loans',
      value: formatNumber(totalLoans),
      icon: CreditCard,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      label: 'Total Volume',
      value: formatCurrency(totalVolume),
      icon: DollarSign,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Avg Interest Rate',
      value: `${avgInterestRate.toFixed(1)}%/mo`,
      icon: Percent,
      iconBg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stat.iconBg}`}>
                <Icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-lg font-semibold">{stat.value}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
