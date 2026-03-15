'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate, maskId } from '@lynia/utils';
import type { KYCSubmission } from '@/types/database';

interface CustomerDocumentsProps {
  customerId: string;
  kycSubmissions: KYCSubmission[];
}

const kycStatusMap: Record<string, { variant: 'green' | 'yellow' | 'blue' | 'red' | 'gray'; label: string }> = {
  approved: { variant: 'green', label: 'Approved' },
  pending: { variant: 'yellow', label: 'Pending' },
  manual_review: { variant: 'blue', label: 'In Review' },
  rejected: { variant: 'red', label: 'Rejected' },
};

export function CustomerDocuments({
  customerId,
  kycSubmissions,
}: CustomerDocumentsProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!kycSubmissions || kycSubmissions.length === 0) {
    return (
      <div className="rounded-lg bg-card p-6 shadow">
        <h2 className="text-lg font-semibold text-foreground">Documents</h2>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">No KYC submissions found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {kycSubmissions.map((submission) => {
        const statusInfo = kycStatusMap[submission.status] || kycStatusMap.pending;

        return (
          <div key={submission.id} className="rounded-lg bg-card p-6 shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  KYC Submission #{submission.attempt_number}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Submitted {formatDate(submission.submitted_at)}
                </p>
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>

            {/* Document Images */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  ID Document (Front)
                </p>
                <div
                  className="relative aspect-[1.6/1] cursor-pointer overflow-hidden rounded-lg bg-muted hover:opacity-90"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedImage(submission.document_front_url)
                  }
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedImage(submission.document_front_url); } }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={submission.document_front_url}
                    alt="ID Front"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {submission.document_back_url && (
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    ID Document (Back)
                  </p>
                  <div
                    className="relative aspect-[1.6/1] cursor-pointer overflow-hidden rounded-lg bg-muted hover:opacity-90"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedImage(submission.document_back_url!)
                    }
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedImage(submission.document_back_url!); } }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={submission.document_back_url}
                      alt="ID Back"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}

              {submission.selfie_url && (
                <div className="col-span-2 max-w-md">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Selfie
                  </p>
                  <div
                    className="relative aspect-[3/2] cursor-pointer overflow-hidden rounded-lg bg-muted hover:opacity-90"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedImage(submission.selfie_url!)
                    }
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedImage(submission.selfie_url!); } }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={submission.selfie_url}
                      alt="Selfie"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Extracted Info */}
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
              <div>
                <p className="text-sm text-muted-foreground">Document Type</p>
                <p className="mt-1 text-sm font-medium capitalize text-foreground">
                  {submission.document_type.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Document Number</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {maskId(submission.document_number)}
                </p>
              </div>
              {submission.image_quality_score !== null && (
                <div>
                  <p className="text-sm text-muted-foreground">Image Quality</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {submission.image_quality_score}%
                  </p>
                </div>
              )}
              {submission.liveness_score !== null && (
                <div>
                  <p className="text-sm text-muted-foreground">Liveness Score</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {submission.liveness_score}%
                  </p>
                </div>
              )}
            </div>

            {submission.rejection_reason && (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 p-4">
                <p className="text-sm font-medium text-red-900">
                  Rejection Reason
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {submission.rejection_reason}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Document"
              className="max-h-[80vh] rounded-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute right-4 top-4 rounded-lg bg-card px-4 py-2 text-sm font-medium shadow"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
