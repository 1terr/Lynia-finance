import type { KYCManualReview } from '@/types';

export const mockKYCSubmissionForReview = {
  id: 'kyc-review-001',
  customer_id: 'cust-001',
  submission_number: 'KYC-2026-0001',
  attempt_number: 1,
  status: 'pending' as const,
  confidence_score: 88,
  verification_confidence: 88,
  verification_decision: null,
  face_match_score: 92,
  liveness_score: 85,
  id_document_url: 'https://example.com/id-front.jpg',
  selfie_url: 'https://example.com/selfie.jpg',
  id_document_type: 'National ID',
  id_number: '63-1234567-A-01',
  extracted_name: 'John Moyo',
  extracted_id_number: '63-1234567-A-01',
  extracted_dob: '1990-05-15',
  kyc_provider: 'didit',
  provider_response: {
    face_match: true,
    liveness_check: true,
    id_validation: true,
    confidence: 88,
  },
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  customers: {
    id: 'cust-001',
    first_name: 'John',
    last_name: 'Moyo',
    phone_number: '+263771234567',
    email: 'john@example.com',
    city: 'Harare',
    province: 'Harare',
  },
  kyc_manual_reviews: [] as KYCManualReview[],
};

export const mockKYCManualReview: KYCManualReview = {
  id: 'review-001',
  submission_id: 'kyc-review-001',
  action: 'approved',
  reason: null,
  notes: 'Documents verified',
  reviewed_at: '2026-03-14T10:00:00Z',
  reviewed_by: 'admin-001',
  reviewer: {
    full_name: 'Admin User',
    email: 'admin@lynia.co.zw',
  },
};

export const mockRejectedReview: KYCManualReview = {
  id: 'review-002',
  submission_id: 'kyc-review-001',
  action: 'rejected',
  reason: 'Document illegible',
  notes: null,
  reviewed_at: '2026-03-13T08:00:00Z',
  reviewed_by: 'admin-002',
  reviewer: {
    full_name: 'Another Admin',
    email: 'admin2@lynia.co.zw',
  },
};
