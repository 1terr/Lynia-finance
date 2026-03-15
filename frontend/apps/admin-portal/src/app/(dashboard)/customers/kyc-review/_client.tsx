'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getKYCPendingReview, approveKYC, rejectKYC } from '@/lib/api/customers';
import { useAuth } from '@/lib/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/data-table';
import { formatDateTime, formatDate, formatRelativeTime } from '@lynia/utils';
import { fetchAPI } from '@lynia/api-client';
import type { KYCSubmission, Customer } from '@/types';
import {
  CheckCircle,
  XCircle,
  User,
  Clock,
  ShieldCheck,
  FileText,
  Camera,
  AlertTriangle,
  Eye,
  Image,
  Search,
} from 'lucide-react';
import Link from 'next/link';

type KYCWithCustomer = KYCSubmission & {
  customer: Pick<Customer, 'id' | 'full_name' | 'phone_number'> | null;
};

interface KYCReviewRecord {
  id: string;
  customer_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer?: { full_name: string; phone_number: string } | null;
}

function getSLAStatus(createdAt: string): { label: string; color: string } {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  if (hours < 4) return { label: `${Math.round(hours)}h`, color: 'text-green-600' };
  if (hours < 24) return { label: `${Math.round(hours)}h`, color: 'text-yellow-600' };
  if (hours < 48) return { label: `${Math.round(hours / 24)}d`, color: 'text-orange-600' };
  return { label: `${Math.round(hours / 24)}d`, color: 'text-red-600' };
}

/** Common rejection reason templates for quick selection */
const REJECTION_TEMPLATES = [
  'Document illegible',
  'Face mismatch with ID photo',
  'ID document expired',
  'Suspected fraud',
] as const;

export default function KYCReviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [rejectModal, setRejectModal] = useState<KYCWithCustomer | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveConfirmSubmission, setApproveConfirmSubmission] = useState<KYCWithCustomer | null>(null);
  const [docViewerSubmission, setDocViewerSubmission] = useState<KYCWithCustomer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kyc-pending', page, debouncedSearch],
    queryFn: () => getKYCPendingReview(page, 25, debouncedSearch || undefined),
  });

  const { data: reviewHistory } = useQuery({
    queryKey: ['kyc-review-history'],
    queryFn: () =>
      fetchAPI<{ data: KYCReviewRecord[]; total: number }>(
        '/api/v1/kyc/submissions/review-history?limit=50'
      ),
  });

  const { data: slaStats } = useQuery({
    queryKey: ['kyc-sla-stats'],
    queryFn: () =>
      fetchAPI<{ total: number; within4h: number; within24h: number; over24h: number }>(
        '/api/v1/kyc/submissions/sla-stats'
      ),
  });

  const [mutationError, setMutationError] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: (submission: KYCWithCustomer) =>
      approveKYC(submission.id, submission.customer_id, user!.id),
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['kyc-pending'] });
      queryClient.invalidateQueries({ queryKey: ['kyc-review-history'] });
      queryClient.invalidateQueries({ queryKey: ['kyc-sla-stats'] });
    },
    onError: (error: Error) => {
      setMutationError(`Approve failed: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!rejectModal) throw new Error('No submission selected');
      return rejectKYC(rejectModal.id, rejectModal.customer_id, user!.id, rejectReason);
    },
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['kyc-pending'] });
      queryClient.invalidateQueries({ queryKey: ['kyc-review-history'] });
      queryClient.invalidateQueries({ queryKey: ['kyc-sla-stats'] });
      setRejectModal(null);
      setRejectReason('');
    },
    onError: (error: Error) => {
      setMutationError(`Reject failed: ${error.message}`);
      setRejectModal(null);
      setRejectReason('');
    },
  });

  const historyColumns: Column<KYCReviewRecord>[] = [
    {
      key: 'updated_at',
      header: 'Reviewed',
      render: (row) => <span className="text-muted-foreground">{formatRelativeTime(row.updated_at)}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.customer?.full_name || '-'}</p>
          <p className="text-xs text-muted-foreground">{row.customer?.phone_number}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Decision',
      render: (row) => (
        <Badge variant="status" status={row.status}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Submitted',
      render: (row) => <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'id',
      header: 'Processing Time',
      render: (row) => {
        const hours = (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 3600000;
        return (
          <span className={hours > 24 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
            {hours < 1 ? `${Math.round(hours * 60)}m` : hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">KYC Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve customer identity verification submissions.
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950 px-3 py-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              {data.total} pending review
            </span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {mutationError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{mutationError}</span>
          <button onClick={() => setMutationError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SLA Stats */}
      {slaStats && slaStats.total > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-2">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pending</p>
                <p className="text-lg font-semibold">{slaStats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">&lt; 4 hours</p>
                <p className="text-lg font-semibold text-green-600">{slaStats.within4h}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 p-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">4-24 hours</p>
                <p className="text-lg font-semibold text-yellow-600">{slaStats.within24h}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">&gt; 24 hours (SLA breach)</p>
                <p className="text-lg font-semibold text-red-600">{slaStats.over24h}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Review Queue{data ? ` (${data.total})` : ''}</TabsTrigger>
          <TabsTrigger value="history">Review History{reviewHistory ? ` (${reviewHistory.total})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          {/* Search input */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by customer name, phone, or submission number..."
              className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !data?.data?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShieldCheck className="h-12 w-12 text-green-300 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">No KYC submissions pending review.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(data?.data ?? []).map((submission) => {
                const sla = getSLAStatus(submission.created_at);
                const extractedName = submission.extracted_first_name
                  ? `${submission.extracted_first_name} ${submission.extracted_last_name || ''}`.trim()
                  : null;
                const displayName = extractedName || submission.customer?.full_name || 'Unknown';
                return (
                  <Card key={submission.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        {/* Left: Customer & Submission Info */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium">
                              <User className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {submission.customer ? (
                                  <Link
                                    href={`/customers/${submission.customer.id}`}
                                    className="text-base font-semibold text-foreground hover:text-brand-600"
                                  >
                                    {displayName}
                                  </Link>
                                ) : (
                                  <span className="text-base font-semibold text-orange-600">
                                    <AlertTriangle className="mr-1 inline h-4 w-4" />
                                    Orphaned Submission
                                  </span>
                                )}
                                <span className={`text-xs font-medium ${sla.color}`}>
                                  <Clock className="mr-0.5 inline h-3 w-3" />
                                  {sla.label} waiting
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {submission.customer?.phone_number || `No linked customer (ID: ${submission.customer_id})`}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {extractedName && submission.customer?.full_name && extractedName !== submission.customer.full_name && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Registered as: </span>
                                <span className="font-medium text-muted-foreground">
                                  {submission.customer.full_name}
                                </span>
                              </div>
                            )}
                            {submission.extracted_date_of_birth && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">DOB: </span>
                                <span className="font-medium">{formatDate(submission.extracted_date_of_birth)}</span>
                              </div>
                            )}
                            <div className="text-sm">
                              <span className="text-muted-foreground">Submitted: </span>
                              <span className="font-medium">{formatDateTime(submission.created_at)}</span>
                            </div>
                          </div>

                          {/* Document thumbnails */}
                          <div className="flex gap-3">
                            {submission.id_document_front_url && (
                              <button
                                onClick={() => setDocViewerSubmission(submission)}
                                className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                ID Front
                              </button>
                            )}
                            {submission.id_document_back_url && (
                              <button
                                onClick={() => setDocViewerSubmission(submission)}
                                className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                ID Back
                              </button>
                            )}
                            {submission.selfie_url && (
                              <button
                                onClick={() => setDocViewerSubmission(submission)}
                                className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                              >
                                <Camera className="h-3.5 w-3.5" />
                                Selfie
                              </button>
                            )}
                            {!submission.id_document_front_url && !submission.selfie_url && (
                              <span className="text-xs text-muted-foreground italic">No documents uploaded</span>
                            )}
                          </div>

                          {/* DIDIT Provider Results */}
                          {submission.provider_response && (
                            <div className="rounded-md bg-muted p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">DIDIT Verification Results</p>
                              <div className="flex flex-wrap gap-3 text-xs">
                                {Object.entries(submission.provider_response).slice(0, 4).map(([key, value]) => (
                                  <span key={key} className="text-muted-foreground">
                                    <span className="text-muted-foreground">{key}: </span>
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
                            variant="outline"
                            size="sm"
                            onClick={() => setDocViewerSubmission(submission)}
                          >
                            <Eye className="mr-1.5 h-4 w-4" />
                            View Docs
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setApproveConfirmSubmission(submission)}
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
                );
              })}
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
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Review Decisions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={historyColumns}
                data={reviewHistory?.data || []}
                keyExtractor={(row) => row.id}
                emptyMessage="No review history yet"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Viewer Modal */}
      <Modal
        open={!!docViewerSubmission}
        onClose={() => setDocViewerSubmission(null)}
        title="KYC Documents"
        size="lg"
      >
        {docViewerSubmission && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="font-medium">
                {docViewerSubmission.extracted_first_name
                  ? `${docViewerSubmission.extracted_first_name} ${docViewerSubmission.extracted_last_name || ''}`.trim()
                  : docViewerSubmission.customer?.full_name || 'Unknown Customer'}
              </span>
              <span className="text-muted-foreground">|</span>
              <span>{docViewerSubmission.customer?.phone_number || 'N/A'}</span>
            </div>

            <div className="space-y-4">
              {docViewerSubmission.id_document_front_url && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    <FileText className="mr-1 inline h-4 w-4" />
                    ID Document - Front
                  </p>
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-8">
                    <div className="text-center">
                      <Image className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
                      <p className="mt-2 text-xs text-muted-foreground font-mono break-all">
                        {docViewerSubmission.id_document_front_url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {docViewerSubmission.id_document_back_url && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    <FileText className="mr-1 inline h-4 w-4" />
                    ID Document - Back
                  </p>
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-8">
                    <div className="text-center">
                      <Image className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
                      <p className="mt-2 text-xs text-muted-foreground font-mono break-all">
                        {docViewerSubmission.id_document_back_url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {docViewerSubmission.selfie_url && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    <Camera className="mr-1 inline h-4 w-4" />
                    Selfie Photo
                  </p>
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-8">
                    <div className="text-center">
                      <Image className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
                      <p className="mt-2 text-xs text-muted-foreground font-mono break-all">
                        {docViewerSubmission.selfie_url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!docViewerSubmission.id_document_front_url &&
                !docViewerSubmission.id_document_back_url &&
                !docViewerSubmission.selfie_url && (
                  <div className="text-center py-8">
                    <Image className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                    <p className="mt-2 text-sm text-muted-foreground">No documents uploaded for this submission.</p>
                  </div>
                )}
            </div>

            {docViewerSubmission.provider_response && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">DIDIT Verification</p>
                <pre className="rounded-md bg-muted p-3 text-xs text-muted-foreground overflow-auto max-h-48">
                  {JSON.stringify(docViewerSubmission.provider_response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Confirmation Dialog */}
      <ConfirmationDialog
        open={!!approveConfirmSubmission}
        onClose={() => setApproveConfirmSubmission(null)}
        onConfirm={() => {
          if (approveConfirmSubmission) {
            approveMutation.mutate(approveConfirmSubmission);
            setApproveConfirmSubmission(null);
          }
        }}
        title="Approve KYC Submission"
        description={`Approve KYC for ${
          approveConfirmSubmission?.extracted_first_name
            ? `${approveConfirmSubmission.extracted_first_name} ${approveConfirmSubmission.extracted_last_name || ''}`.trim()
            : approveConfirmSubmission?.customer?.full_name || 'Unknown Customer'
        }? This will verify their identity and update their KYC status. This action cannot be undone.`}
        confirmLabel="Approve"
        cancelLabel="Cancel"
        variant="warning"
        isLoading={approveMutation.isPending}
      />

      {/* Reject Modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Reject KYC Submission"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reject KYC for <strong>{
              rejectModal?.extracted_first_name
                ? `${rejectModal.extracted_first_name} ${rejectModal.extracted_last_name || ''}`.trim()
                : rejectModal?.customer?.full_name || 'Unknown Customer'
            }</strong>?
            The customer will be notified and can resubmit.
          </p>
          <div>
            <label className="block text-sm font-medium text-foreground">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g., ID photo blurry, face doesn't match..."
            />
          </div>

          {/* Quick-select rejection reason templates */}
          <div className="flex flex-wrap gap-1.5">
            {REJECTION_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => {
                  setRejectReason((prev) =>
                    prev.trim() ? `${prev.trimEnd()}; ${template}` : template
                  );
                }}
                className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:border-border transition-colors"
              >
                {template}
              </button>
            ))}
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
