'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoanDisbursementReport } from '@/components/reports/loan-disbursement-report';
import { PaymentCollectionReport } from '@/components/reports/payment-collection-report';
import { KycStatusReport } from '@/components/reports/kyc-status-report';
import { CustomerAcquisitionReport } from '@/components/reports/customer-acquisition-report';
import { FeeRevenueReport } from '@/components/reports/fee-revenue-report';
import { CommissionOverviewReport } from '@/components/reports/commission-overview-report';
import { DistributorPerformanceReport } from '@/components/reports/distributor-performance-report';

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* Header: Title                                                      */}
      {/* ================================================================= */}
      <div>
        <h1 className="text-2xl font-bold">Operations Reports</h1>
        <p className="text-sm text-muted-foreground">
          Real-time operational intelligence across all business functions.
        </p>
      </div>

      {/* ================================================================= */}
      {/* Tab Navigation + Content                                           */}
      {/* ================================================================= */}
      <Tabs defaultValue="disbursements" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
            <TabsTrigger value="disbursements">Disbursements</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="kyc">KYC Pipeline</TabsTrigger>
            <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
            <TabsTrigger value="fee-revenue">Fee Revenue</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="distributor-performance">Distributor Performance</TabsTrigger>
          </TabsList>
        </div>

        {/* --- Disbursements Tab --- */}
        <TabsContent value="disbursements">
          <LoanDisbursementReport />
        </TabsContent>

        {/* --- Collections Tab --- */}
        <TabsContent value="collections">
          <PaymentCollectionReport />
        </TabsContent>

        {/* --- KYC Pipeline Tab --- */}
        <TabsContent value="kyc">
          <KycStatusReport />
        </TabsContent>

        {/* --- Customer Acquisition Tab --- */}
        <TabsContent value="acquisition">
          <CustomerAcquisitionReport />
        </TabsContent>

        {/* --- Fee Revenue Tab --- */}
        <TabsContent value="fee-revenue">
          <FeeRevenueReport />
        </TabsContent>

        {/* --- Commissions Tab --- */}
        <TabsContent value="commissions">
          <CommissionOverviewReport />
        </TabsContent>

        {/* --- Distributor Performance Tab --- */}
        <TabsContent value="distributor-performance">
          <DistributorPerformanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
