'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getKYCPendingReview, approveKYC, rejectKYC } from '@/lib/api/customers';
import { useAuth } from '@/lib/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { formatDateTime, formatDate } from '@/lib/utils';
import type { KYCSubmission, Customer } from '@/types';
import {
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Clock,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import Link from 'next/link';

type KYCWithCustomer = KYCSubmission & {
  customer: Pick<Customer, 'id' | 'full_name' | 'phone_number'>;
};

export default function KYCReviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [rejectModal, setRejectModal] = useState<KYCWithCustomer | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['kyc-pending', page],
    queryFn: () => getKYCPendingReview(page),
  });

  const approveMutation = useMutation({
    mutationFn: (submission: KYCWithCustomer) =>
      approveKYC(submission.id, submission.customer_id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-pending'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!rejectModal) throw new Error('No submission selected');
      return rejectKYC(rejectModal.id, rejectModal.customer_id, user!.id, rejectReason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-pending'] });
      setRejectModal(null);
      setRejectReason('');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Review Queue</h1>
          <p className="text-sm text-gray-500">
            Review and approve customer identity verification submissions.
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              {data.total} pending review
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="h-12 w-12 text-green-300 mb-4" />
            <p className="text-lg font-medium text-gray-500">All caught up!</p>
            <p className="text-sm text-gray-400 mt-1">No KYC submissions pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.data.map((submission) => (
            <Card key={submission.id}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: Customer & Submission Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <Link
                          href={`/customers/${submission.customer.id}`}
                          className="text-base font-semibold text-gray-900 hover:text-brand-600"
                        >
                          {submission.customer.full_name}
                        </Link>
                        <p className="text-sm text-gray-500">{submission.customer.phone_number}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {submission.extracted_first_name && (
                        <div className="text-sm">
                          <span className="text-gray-500">ID Name: </span>
                          <span className="font-medium">
                            {submission.extracted_first_name} {submission.extracted_last_name}
                          </span>
                        </div>
                      )}
                      {submission.extracted_date_of_birth && (
                        <div className="text-sm">
                          <span className="text-gray-500">DOB: </span>
                          <span className="font-medium">{formatDate(submission.extracted_date_of_birth)}</span>
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="text-gray-500">Submitted: </span>
                        <span className="font-medium">{formatDateTime(submission.created_at)}</span>
                      </div>
                    </div>

                    {/* Smile Identity Results */}
                    {submission.smile_identity_result && (
                      <div className="rounded-md bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-600 mb-1">Smile Identity Results</p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {Object.entries(submission.smile_identity_result).slice(0, 4).map(([key, value]) => (
                            <span key={key} className="text-gray-600">
                              <span className="text-gray-400">{key}: </span>
                              {String(value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-row gap-2 lg:flex-col">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(submission)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="mr-1.5 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRejectModal(submission)}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={data.limit}
          onPageChange={setPage}
        />
      )}

      {/* Reject Modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Reject KYC Submission"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Reject KYC for <strong>{rejectModal?.customer.full_name}</strong>?
            The customer will be notified and can resubmit.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g., ID photo blurry, face doesn't match..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectModal(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
