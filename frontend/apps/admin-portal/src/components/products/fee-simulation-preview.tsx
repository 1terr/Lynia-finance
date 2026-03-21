'use client';

import { useMemo } from 'react';
import { calculateInsuranceFee, calculateFlatRatePayment } from '@/lib/utils/fee-calculator';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface FeeSimulationPreviewProps {
  /** Mid-range principal for simulation (min+max/2) */
  minAmount: number;
  maxAmount: number;
  /** Annual interest rate as a percentage */
  annualRate: number;
  /** Loan term in months */
  termMonths: number;
  /** Insurance fee configuration */
  insuranceFeeType: 'none' | 'percentage' | 'flat';
  insuranceFeePercentage: number;
  insuranceFeeFlatUsd: number;
  insuranceFeeFrequency: 'upfront' | 'monthly';
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function FeeSimulationPreview(props: FeeSimulationPreviewProps) {
  const {
    minAmount,
    maxAmount,
    annualRate,
    termMonths,
    insuranceFeeType,
    insuranceFeePercentage,
    insuranceFeeFlatUsd,
    insuranceFeeFrequency,
  } = props;

  const simulation = useMemo(() => {
    const principal = Math.round((minAmount + maxAmount) / 2);

    if (principal <= 0 || termMonths <= 0) {
      return null;
    }

    const loan = calculateFlatRatePayment({
      principal,
      annualRatePercent: annualRate,
      termMonths,
    });

    const insurance = calculateInsuranceFee({
      loanAmount: principal,
      feeType: insuranceFeeType,
      feePercentage: insuranceFeePercentage,
      feeFlatUsd: insuranceFeeFlatUsd,
      frequency: insuranceFeeFrequency,
      termMonths,
    });

    const totalCostOfCredit = loan.totalInterest + insurance.totalFee;
    const totalRepaymentWithFees = loan.totalRepayment + insurance.totalFee;
    const monthlyWithInsurance = loan.monthlyPayment + insurance.monthlyFee;

    return {
      principal,
      loan,
      insurance,
      totalCostOfCredit,
      totalRepaymentWithFees,
      monthlyWithInsurance,
    };
  }, [minAmount, maxAmount, annualRate, termMonths, insuranceFeeType, insuranceFeePercentage, insuranceFeeFlatUsd, insuranceFeeFrequency]);

  if (!simulation) {
    return null;
  }

  return (
    <Card className="p-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
          Fee Simulation Preview
        </h3>
        <span className="text-xs text-blue-600 dark:text-blue-400">
          (for {formatMoney(simulation.principal)} loan, {termMonths} months)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <SimRow label="Interest (flat rate)" value={formatMoney(simulation.loan.totalInterest)} />
        {simulation.insurance.totalFee > 0 && (
          <>
            {simulation.insurance.upfrontFee > 0 && (
              <SimRow label="Insurance (upfront)" value={formatMoney(simulation.insurance.upfrontFee)} />
            )}
            {simulation.insurance.monthlyFee > 0 && (
              <SimRow label="Insurance (monthly)" value={formatMoney(simulation.insurance.monthlyFee) + '/mo'} />
            )}
            <SimRow label="Total insurance" value={formatMoney(simulation.insurance.totalFee)} />
          </>
        )}
        <div className="col-span-2 border-t border-blue-200 my-1" />
        <SimRow label="Monthly payment" value={formatMoney(simulation.monthlyWithInsurance)} highlight />
        <SimRow label="Total repayment" value={formatMoney(simulation.totalRepaymentWithFees)} highlight />
        <SimRow label="Total cost of credit" value={formatMoney(simulation.totalCostOfCredit)} />
        <SimRow label="Effective APR" value={`${simulation.loan.effectiveApr}%`} />
      </div>
    </Card>
  );
}

function SimRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  );
}
