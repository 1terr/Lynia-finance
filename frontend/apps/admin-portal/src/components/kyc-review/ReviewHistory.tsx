'use client';

import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn, formatDateTime } from '@lynia/utils';
import type { KYCManualReview } from '@/types';

interface ReviewHistoryProps {
  reviews: KYCManualReview[];
  className?: string;
}

export function ReviewHistory({ reviews, className }: ReviewHistoryProps) {
  if (!reviews || reviews.length === 0) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <h3 className="text-sm font-medium text-foreground mb-3">Review History</h3>
        <p className="text-sm text-muted-foreground">No previous reviews</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <h3 className="text-sm font-medium text-foreground mb-4">
        Review History ({reviews.length})
      </h3>

      <div className="space-y-4">
        {reviews.map((review, index) => (
          <ReviewHistoryItem
            key={review.id}
            review={review}
            isLast={index === reviews.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewHistoryItem({
  review,
  isLast,
}: {
  review: KYCManualReview;
  isLast: boolean;
}) {
  const isApproved = review.action === 'approved';

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
      )}

      <div className="flex gap-3">
        <div
          className={cn(
            'flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full',
            isApproved ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
          )}
        >
          {isApproved ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-foreground">
              {isApproved ? 'Approved' : 'Rejected'}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDateTime(review.reviewed_at)}
            </div>
          </div>

          {review.reviewer && (
            <p className="text-xs text-muted-foreground mt-0.5">
              by {review.reviewer.full_name}
            </p>
          )}

          {review.reason && (
            <div className="mt-1.5 rounded bg-red-50 dark:bg-red-950 px-2.5 py-1.5">
              <p className="text-xs text-red-700">
                <span className="font-medium">Reason:</span> {review.reason}
              </p>
            </div>
          )}

          {review.notes && (
            <div className="mt-1.5 rounded bg-muted px-2.5 py-1.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Notes:</span> {review.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
