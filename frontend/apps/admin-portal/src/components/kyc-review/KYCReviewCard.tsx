'use client';

import { useState, useCallback } from 'react';
import {
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  MapPin,
  Shield,
  ShieldCheck,
  ShieldX,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DocumentViewer } from './DocumentViewer';
import { SLAIndicator } from './SLAIndicator';
import { ReviewHistory } from './ReviewHistory';
import { cn, formatDateTime, getConfidenceLevel, maskPhone, maskId } from '@lynia/utils';
import { useKYCActions } from '@/lib/hooks/useKYCReview';
import type { KYCSubmission } from '@/types';

/** Common rejection reason templates for quick selection */
const REJECTION_TEMPLATES = [
  'Document illegible',
  'Face mismatch with ID photo',
  'ID document expired',
  'Suspected fraud',
] as const;

interface KYCReviewCardProps {
  submission: KYCSubmission;
  onActionComplete: () => void;
  expanded?: boolean;
}

export function KYCReviewCard({
  submission,
  onActionComplete,
  expanded: initialExpanded = false,
}: KYCReviewCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const { approveMutation, rejectMutation } = useKYCActions(onActionComplete);

  const isSubmitting = approveMutation.isPending || rejectMutation.isPending;

  const customer = submission.customers;
  const customerName = customer
    ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
    : 'Unknown';
  const confidence = getConfidenceLevel(submission.verification_confidence ?? submission.confidence_score);
  const providerResult = submission.provider_response;
  const providerName = submission.kyc_provider || 'didit';

  // Calculate SLA deadline (24 hours from submission)
  const slaDeadline = new Date(
    new Date(submission.submitted_at ?? submission.created_at).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  const handleApprove = useCallback(() => {
    approveMutation.mutate({
      submissionId: submission.id,
      notes: approvalNotes || undefined,
    });
    setShowApproveConfirm(false);
  }, [submission.id, approvalNotes, approveMutation]);

  const handleReject = useCallback(() => {
    if (!rejectionReason.trim()) return;
    rejectMutation.mutate({
      submissionId: submission.id,
      reason: rejectionReason,
    });
  }, [submission.id, rejectionReason, rejectMutation]);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Customer avatar */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100">
            <span className="text-sm font-semibold text-primary-700">
              {customer?.first_name?.[0]}
              {customer?.last_name?.[0]}
            </span>
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground">
              {customer?.first_name} {customer?.last_name}
            </h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-muted-foreground">
                #{submission.submission_number}
              </span>
              <span className="text-xs text-muted-foreground">
                Attempt {submission.attempt_number}/3
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Confidence Score */}
          {submission.confidence_score !== null && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Confidence</div>
              <div className="flex items-center gap-1.5">
                <Badge variant={confidence.color}>
                  {submission.confidence_score}%
                </Badge>
              </div>
            </div>
          )}

          {/* SLA */}
          <SLAIndicator deadline={slaDeadline} compact />

          {/* Expand button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            <Eye className="h-4 w-4 mr-1" />
            {expanded ? 'Collapse' : 'Review'}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Documents */}
            <div className="lg:col-span-1">
              <DocumentViewer
                idDocumentUrl={submission.id_document_url ?? ''}
                selfieUrl={submission.selfie_url ?? ''}
                idDocumentType={submission.id_document_type || 'National ID'}
              />
            </div>

            {/* Middle Column: Customer & Verification Details */}
            <div className="lg:col-span-1 space-y-4">
              {/* Customer Information */}
              <div className="rounded-lg border border-border p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">
                  Customer Information
                </h4>
                <div className="space-y-2.5">
                  <InfoRow icon={User} label="Name" value={`${customer?.first_name} ${customer?.last_name}`} />
                  <InfoRow icon={Phone} label="Phone" value={customer?.phone_number ? maskPhone(customer.phone_number) : 'N/A'} />
                  <InfoRow icon={Mail} label="Email" value={customer?.email || 'N/A'} />
                  <InfoRow icon={CreditCard} label="ID Number" value={submission.id_number ? maskId(submission.id_number) : 'N/A'} />
                  <InfoRow icon={Calendar} label="Submitted" value={formatDateTime(submission.submitted_at ?? submission.created_at)} />
                  {customer?.city && (
                    <InfoRow icon={MapPin} label="Location" value={`${customer.city}${customer.province ? ', ' + customer.province : ''}`} />
                  )}
                </div>
              </div>

              {/* Extracted Data */}
              {(submission.extracted_name || submission.extracted_id_number) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-3">
                    Extracted from Document
                  </h4>
                  <div className="space-y-2">
                    {submission.extracted_name && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Name</span>
                        <span className="font-medium text-blue-900">
                          {submission.extracted_name}
                        </span>
                      </div>
                    )}
                    {submission.extracted_id_number && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">ID Number</span>
                        <span className="font-medium text-blue-900">
                          {submission.extracted_id_number}
                        </span>
                      </div>
                    )}
                    {submission.extracted_dob && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Date of Birth</span>
                        <span className="font-medium text-blue-900">
                          {submission.extracted_dob}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* KYC Provider Results (provider-agnostic) */}
              {(providerResult || submission.verification_confidence != null) && (
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-foreground">
                      Verification Checks
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      DIDIT
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <VerificationCheck
                      label="Face Match"
                      passed={submission.face_match_score != null ? submission.face_match_score >= 85 : !!(providerResult?.face_match)}
                    />
                    <VerificationCheck
                      label="Liveness Check"
                      passed={submission.liveness_score != null ? submission.liveness_score >= 50 : !!(providerResult?.liveness_check)}
                    />
                    <VerificationCheck
                      label="ID Validation"
                      passed={!!(providerResult?.id_validation) || submission.verification_decision === 'APPROVED'}
                    />
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Overall Confidence
                        </span>
                        <span
                          className={cn(
                            'text-lg font-bold',
                            (submission.verification_confidence ?? (providerResult?.confidence as number) ?? 0) >= 85
                              ? 'text-green-600'
                              : (submission.verification_confidence ?? (providerResult?.confidence as number) ?? 0) >= 50
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          )}
                        >
                          {submission.verification_confidence ?? (providerResult?.confidence as number) ?? 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Actions & History */}
            <div className="lg:col-span-1 space-y-4">
              {/* SLA Tracking */}
              <SLAIndicator deadline={slaDeadline} />

              {/* Action Buttons */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-sm font-medium text-foreground">
                  Review Decision
                </h4>

                {!showRejectForm ? (
                  <>
                    {/* Approval Notes */}
                    <div>
                      <label htmlFor="kyc-approval-notes" className="block text-xs font-medium text-muted-foreground mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        id="kyc-approval-notes"
                        rows={2}
                        maxLength={1000}
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add any notes about this review..."
                        className="w-full rounded-md border border-border px-3 py-2 text-sm placeholder-muted-foreground focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        className="flex-1"
                        onClick={() => setShowApproveConfirm(true)}
                        disabled={isSubmitting}
                        isLoading={approveMutation.isPending}
                      >
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1"
                        onClick={() => setShowRejectForm(true)}
                        disabled={isSubmitting}
                      >
                        <ShieldX className="h-4 w-4 mr-1.5" />
                        Reject
                      </Button>
                    </div>

                    {/* Approve Confirmation Dialog */}
                    <ConfirmationDialog
                      open={showApproveConfirm}
                      onClose={() => setShowApproveConfirm(false)}
                      onConfirm={handleApprove}
                      title="Approve KYC Submission"
                      description={`Approve KYC for ${customerName}? This will verify their identity and update their KYC status. This action cannot be undone.`}
                      confirmLabel="Approve"
                      cancelLabel="Cancel"
                      variant="warning"
                      isLoading={approveMutation.isPending}
                    />
                  </>
                ) : (
                  <>
                    {/* Rejection Reason */}
                    <div>
                      <label htmlFor="kyc-rejection-reason" className="block text-xs font-medium text-muted-foreground mb-1">
                        Rejection Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="kyc-rejection-reason"
                        rows={3}
                        maxLength={1000}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Provide a detailed reason for rejection..."
                        className="w-full rounded-md border border-border px-3 py-2 text-sm placeholder-muted-foreground focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        /* eslint-disable-next-line jsx-a11y/no-autofocus */
                        autoFocus
                      />
                    </div>

                    {/* Quick-select rejection reason templates */}
                    <div className="flex flex-wrap gap-1.5">
                      {REJECTION_TEMPLATES.map((template) => (
                        <button
                          key={template}
                          type="button"
                          onClick={() => {
                            setRejectionReason((prev) =>
                              prev.trim() ? `${prev.trimEnd()}; ${template}` : template
                            );
                          }}
                          className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:border-border transition-colors"
                        >
                          {template}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectionReason('');
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1"
                        onClick={handleReject}
                        isLoading={rejectMutation.isPending}
                        disabled={!rejectionReason.trim() || isSubmitting}
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Review History */}
              {submission.kyc_manual_reviews &&
                submission.kyc_manual_reviews.length > 0 && (
                  <ReviewHistory reviews={submission.kyc_manual_reviews} />
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground min-w-[60px]">{label}</span>
      <span className="text-sm text-foreground truncate">{value}</span>
    </div>
  );
}

function VerificationCheck({
  label,
  passed,
}: {
  label: string;
  passed: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className={cn('h-4 w-4', passed ? 'text-green-500' : 'text-red-500')} />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <Badge variant={passed ? 'green' : 'red'}>
        {passed ? 'Pass' : 'Fail'}
      </Badge>
    </div>
  );
}
