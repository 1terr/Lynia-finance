'use client';

import { Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <p className="text-sm text-gray-500">Manage device inventory, lock/unlock controls, and handover tracking.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Smartphone className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-500">Device Management</p>
          <p className="text-sm text-gray-400 mt-1">Coming in P3-T006</p>
        </CardContent>
      </Card>
    </div>
  );
}
