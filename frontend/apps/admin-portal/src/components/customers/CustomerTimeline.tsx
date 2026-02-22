'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCustomerTimeline } from '@/lib/api/customers';
import { formatDateTime } from '@lynia/utils';
import type { TimelineEvent } from '@/types/database';

interface CustomerTimelineProps {
  customerId: string;
}

interface EventConfig {
  title: string;
  description: (data: Record<string, unknown>) => string;
  iconBg: string;
  iconText: string;
}

const eventConfigs: Record<string, EventConfig> = {
  customer_created: {
    title: 'Customer Created',
    description: () => 'Customer account was created',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
  },
  kyc_submitted: {
    title: 'KYC Submitted',
    description: () => 'Submitted KYC documents for verification',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
  },
  kyc_approved: {
    title: 'KYC Approved',
    description: () => 'Identity verification approved',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
  },
  kyc_rejected: {
    title: 'KYC Rejected',
    description: (data) => `Rejected: ${data.reason || 'No reason provided'}`,
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
  },
  loan_applied: {
    title: 'Loan Application',
    description: (data) => `Applied for ${data.device_name || 'device'}`,
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
  },
  loan_approved: {
    title: 'Loan Approved',
    description: (data) => `Loan approved for $${data.amount || '0'}`,
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
  },
  loan_rejected: {
    title: 'Loan Rejected',
    description: (data) => `Reason: ${data.reason || 'No reason provided'}`,
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
  },
  payment_made: {
    title: 'Payment Received',
    description: (data) => `Paid $${data.amount || '0'} via ${data.method || 'unknown'}`,
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
  },
  payment_missed: {
    title: 'Payment Missed',
    description: (data) => `Missed payment of $${data.amount || '0'}`,
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-600',
  },
  device_locked: {
    title: 'Device Locked',
    description: (data) => `Device locked: ${data.reason || 'overdue payment'}`,
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
  },
  device_unlocked: {
    title: 'Device Unlocked',
    description: () => 'Device has been unlocked',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
  },
  credit_updated: {
    title: 'Credit Score Updated',
    description: (data) => `Score changed to ${data.new_score || 'N/A'}`,
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
  },
};

const defaultConfig: EventConfig = {
  title: 'Event',
  description: () => '',
  iconBg: 'bg-gray-100',
  iconText: 'text-gray-600',
};

export function CustomerTimeline({ customerId }: CustomerTimelineProps) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['customer-timeline', customerId],
    queryFn: () => fetchCustomerTimeline(customerId),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-gray-500">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">
          Customer Timeline
        </h2>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">No timeline events found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-6 text-lg font-semibold text-gray-900">
        Customer Timeline
      </h2>

      <div className="space-y-6">
        {events.map((event, index) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const config = eventConfigs[event.event_type] || {
    ...defaultConfig,
    title: event.event_type.replace(/_/g, ' '),
  };

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute bottom-0 left-4 top-8 w-0.5 bg-gray-200" />
      )}

      <div className="flex gap-4">
        <div
          className={`z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.iconBg}`}
        >
          <span className={`text-xs font-bold ${config.iconText}`}>
            {config.title[0]}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {config.title}
              </p>
              <p className="text-sm text-gray-500">
                {config.description(event.event_data || {})}
              </p>
            </div>
            <time className="text-xs text-gray-400">
              {formatDateTime(event.created_at)}
            </time>
          </div>

          {event.created_by && (
            <p className="mt-1 text-xs text-gray-400">
              by {event.created_by}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
