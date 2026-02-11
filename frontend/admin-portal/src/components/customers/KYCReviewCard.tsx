'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveKYC, rejectKYC } from '@/lib/api/customers';
import { formatDate, maskPhone } from '@/lib/utils';
import type { KYCSubmission, Customer } from '@/types/database';

interface KYCReviewCardProps {
  submission: KYCSubmission & { customers: Customer };
}

export function KYCReviewCard({ submission }: KYCReviewCardProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => approveKYC(submission.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-pending-review'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectKYC(submission.id, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-pending-review'] });
    },
  });

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {submission.customers.first_name} {submission.customers.last_name}
          </h3>
          <p className="text-sm text-gray-500">
            Submitted {formatDate(submission.submitted_at)} | Attempt #
            {submission.attempt_number}
          </p>
          <p className="text-sm text-gray-500">
            Phone: {maskPhone(submission.customers.phone_number)}
          </p>
        </div>

        {submission.smile_confidence_score !== null && (
          <div className="text-right">
            <div className="text-sm text-gray-500">Smile ID Confidence</div>
            <div
              className={`text-2xl font-bold ${
                submission.smile_confidence_score >= 85
                  ? 'text-green-600'
                  : submission.smile_confidence_score >= 50
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {submission.smile_confidence_score}%
            </div>
          </div>
        )}
      </div>

      {/* Document Images */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            ID Front
          </p>
          <div
            className="relative aspect-[1.6/1] cursor-pointer overflow-hidden rounded-lg bg-gray-100 hover:opacity-90"
            onClick={() => setSelectedImage(submission.document_front_url)}
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
            <p className="mb-2 text-sm font-medium text-gray-700">
              ID Back
            </p>
            <div
              className="relative aspect-[1.6/1] cursor-pointer overflow-hidden rounded-lg bg-gray-100 hover:opacity-90"
              onClick={() => setSelectedImage(submission.document_back_url!)}
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
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              Selfie
            </p>
            <div
              className="relative aspect-[1.6/1] cursor-pointer overflow-hidden rounded-lg bg-gray-100 hover:opacity-90"
              onClick={() => setSelectedImage(submission.selfie_url!)}
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
      <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
        <div>
          <p className="text-sm text-gray-500">Document Number</p>
          <p className="mt-1 font-medium">{submission.document_number}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Document Type</p>
          <p className="mt-1 font-medium capitalize">
            {submission.document_type.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      {/* Smile Identity Results */}
      {submission.smile_result && (
        <div className="mt-4 rounded-lg bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">
            Smile Identity Analysis
          </p>
          <div className="mt-2 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-blue-600">Face Match</p>
              <p className="font-medium">
                {submission.smile_result.face_match ? 'Pass' : 'Fail'}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600">Liveness Check</p>
              <p className="font-medium">
                {submission.smile_result.liveness_check ? 'Pass' : 'Fail'}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600">ID Validation</p>
              <p className="font-medium">
                {submission.smile_result.id_validation ? 'Pass' : 'Fail'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quality Indicators */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        {submission.liveness_passed !== null && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Liveness</p>
            <p
              className={`font-medium ${submission.liveness_passed ? 'text-green-600' : 'text-red-600'}`}
            >
              {submission.liveness_passed ? 'Passed' : 'Failed'}
            </p>
          </div>
        )}
        {submission.image_quality_score !== null && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Image Quality</p>
            <p className="font-medium">{submission.image_quality_score}%</p>
          </div>
        )}
        {submission.document_readable !== null && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Document Readable</p>
            <p
              className={`font-medium ${submission.document_readable ? 'text-green-600' : 'text-red-600'}`}
            >
              {submission.document_readable ? 'Yes' : 'No'}
            </p>
          </div>
        )}
      </div>

      {/* Rejection Reason Input */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">
          Rejection Reason (required to reject)
        </label>
        <textarea
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          rows={2}
          placeholder="Provide detailed reason for rejection..."
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to approve this KYC submission?')) {
              approveMutation.mutate();
            }
          }}
          disabled={isProcessing}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {approveMutation.isPending ? 'Approving...' : 'Approve KYC'}
        </button>
        <button
          onClick={() => {
            if (!rejectionReason.trim()) {
              alert('Please provide a rejection reason');
              return;
            }
            rejectMutation.mutate();
          }}
          disabled={isProcessing || !rejectionReason.trim()}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {rejectMutation.isPending ? 'Rejecting...' : 'Reject KYC'}
        </button>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
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
              className="absolute right-4 top-4 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
