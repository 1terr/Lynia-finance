'use client';

import { useState } from 'react';
import type { ReportType, DateRange, ReportFilters, ReportMeta } from '@/types/reports';
import { DateRangeFilter, getPresetDates } from '@/components/reports/date-range-filter';
import { LoanDisbursementReport } from '@/components/reports/loan-disbursement-report';
import { PaymentCollectionReport } from '@/components/reports/payment-collection-report';
import { DefaultRateReport } from '@/components/reports/default-rate-report';
import { KycStatusReport } from '@/components/reports/kyc-status-report';
import { DeviceManagementReport } from '@/components/reports/device-management-report';
import { CustomerAcquisitionReport } from '@/components/reports/customer-acquisition-report';
import { PortfolioHealthReport } from '@/components/reports/portfolio-health-report';
import { cn } from '@/lib/utils';
import {
  Banknote,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  Smartphone,
  Users,
  PieChart,
} from 'lucide-react';

const REPORT_TYPES: ReportMeta[] = [
  { type: 'loan_disbursement', title: 'Loan Disbursement', description: 'Loan volumes, values & approval rates', icon: 'banknote', color: 'text-blue-600' },
  { type: 'payment_collection', title: 'Payment Collection', description: 'Collection rates & payment methods', icon: 'credit-card', color: 'text-green-600' },
  { type: 'default_rate', title: 'Default Rate / PAR', description: 'Portfolio at risk & aging buckets', icon: 'alert-triangle', color: 'text-red-600' },
  { type: 'kyc_status', title: 'KYC Status', description: 'KYC submissions & approval rates', icon: 'shield-check', color: 'text-yellow-600' },
  { type: 'device_management', title: 'Device Management', description: 'Device status & lock operations', icon: 'smartphone', color: 'text-cyan-600' },
  { type: 'customer_acquisition', title: 'Customer Acquisition', description: 'Funnel conversion & source analysis', icon: 'users', color: 'text-purple-600' },
  { type: 'portfolio_health', title: 'Portfolio Health', description: 'Portfolio composition & health metrics', icon: 'pie-chart', color: 'text-orange-600' },
];

const iconMap: Record<string, React.ElementType> = {
  'banknote': Banknote,
  'credit-card': CreditCard,
  'alert-triangle': AlertTriangle,
  'shield-check': ShieldCheck,
  'smartphone': Smartphone,
  'users': Users,
  'pie-chart': PieChart,
};

function getDefaultDateRange(): DateRange {
  const dates = getPresetDates('30d');
  return { ...dates, preset: '30d' };
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('loan_disbursement');
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

  const filters: ReportFilters = { dateRange };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">View and export operational reports for Lynia Finance</p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 mb-6">
        {REPORT_TYPES.map((report) => {
          const Icon = iconMap[report.icon] ?? PieChart;
          const isActive = activeReport === report.type;
          return (
            <button
              key={report.type}
              onClick={() => setActiveReport(report.type)}
              className={cn(
                'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all',
                isActive
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive ? report.color : 'text-muted-foreground')} />
              <span className={cn('text-xs font-semibold leading-tight', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                {report.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Date range filter */}
      <div className="mb-6">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Active report */}
      <div>
        {activeReport === 'loan_disbursement' && <LoanDisbursementReport filters={filters} />}
        {activeReport === 'payment_collection' && <PaymentCollectionReport filters={filters} />}
        {activeReport === 'default_rate' && <DefaultRateReport filters={filters} />}
        {activeReport === 'kyc_status' && <KycStatusReport filters={filters} />}
        {activeReport === 'device_management' && <DeviceManagementReport filters={filters} />}
        {activeReport === 'customer_acquisition' && <CustomerAcquisitionReport filters={filters} />}
        {activeReport === 'portfolio_health' && <PortfolioHealthReport filters={filters} />}
      </div>
    </div>
  );
}
