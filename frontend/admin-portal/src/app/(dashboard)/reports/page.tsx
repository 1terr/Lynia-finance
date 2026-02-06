'use client';

import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Financial and operational reporting with export capabilities.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-500">Reports & Analytics</p>
          <p className="text-sm text-gray-400 mt-1">Coming in P3-T008</p>
        </CardContent>
      </Card>
    </div>
  );
}
