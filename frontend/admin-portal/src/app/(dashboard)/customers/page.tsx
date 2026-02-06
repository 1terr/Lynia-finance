'use client';

import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500">Manage customer profiles, KYC status, and credit history.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-500">Customer Management</p>
          <p className="text-sm text-gray-400 mt-1">Coming in P3-T004</p>
        </CardContent>
      </Card>
    </div>
  );
}
