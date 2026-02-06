'use client';

import { CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500">Track payments, reconciliation, and collections.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CreditCard className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-500">Payment Management</p>
          <p className="text-sm text-gray-400 mt-1">Coming in P3-T005</p>
        </CardContent>
      </Card>
    </div>
  );
}
