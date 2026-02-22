'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatRelativeTime } from '@lynia/utils';
import type { RecentActivity as RecentActivityType } from '@/types';
import {
  UserPlus,
  FileCheck,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react';

interface RecentActivityProps {
  activities: RecentActivityType[];
}

const ACTIVITY_ICONS: Record<string, { icon: typeof UserPlus; color: string; bg: string }> = {
  create: { icon: UserPlus, color: 'text-green-600', bg: 'bg-green-50' },
  approve: { icon: FileCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
  reject: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  payment: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  lock: { icon: Lock, color: 'text-red-600', bg: 'bg-red-50' },
  unlock: { icon: Unlock, color: 'text-green-600', bg: 'bg-green-50' },
  login: { icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  update: { icon: Smartphone, color: 'text-yellow-600', bg: 'bg-yellow-50' },
};

export function RecentActivityFeed({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 10).map((activity) => {
              const config = ACTIVITY_ICONS[activity.event_type] || ACTIVITY_ICONS.update;
              const Icon = config.icon;
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 rounded-lg p-2 ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(activity.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
