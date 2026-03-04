/**
 * Test Fixtures: Customers
 * Sample customer data for testing
 */

export const testCustomers = {
  // Zimbabwe customer - valid for onboarding
  zimbabweCustomer: {
    id: 'cust_test_001',
    phone_number: '+263771234567',
    first_name: 'Tendai',
    last_name: 'Moyo',
    date_of_birth: '1990-05-15',
    gender: 'male',
    national_id: '63-1234567A21',
    address_line1: '123 Harare Street',
    city: 'Harare',
    province: 'Harare',
    country: 'Zimbabwe',
    postal_code: '00263',
    employment_status: 'full_time',
    employer_name: 'Econet Wireless',
    monthly_income: 500,
    employment_duration_months: 24,
    kyc_status: 'verified',
    credit_score: 720,
    credit_tier: 2,
    created_at: new Date().toISOString()
  },

  // Non-Zimbabwe customer - should be rejected
  nonZimbabweCustomer: {
    id: 'cust_test_non_zw',
    phone_number: '+27821234567',
    first_name: 'John',
    last_name: 'Van Der Merwe',
    date_of_birth: '1985-08-20',
    gender: 'male',
    national_id: 'RSA8501015800183',
    address_line1: '456 Long Street',
    city: 'Cape Town',
    province: 'Western Cape',
    country: 'South Africa',
    postal_code: '8001',
    employment_status: 'full_time',
    employer_name: 'Vodacom',
    monthly_income: 600,
    employment_duration_months: 36,
    kyc_status: 'not_started',
    created_at: new Date().toISOString()
  },

  // Kenya customer - should be rejected (non-Zimbabwe)
  kenyaCustomer: {
    id: 'cust_test_002',
    phone_number: '+254712345678',
    first_name: 'John',
    last_name: 'Kamau',
    date_of_birth: '1985-08-20',
    gender: 'male',
    national_id: 'KEN987654321',
    address_line1: '456 Nairobi Road',
    city: 'Nairobi',
    province: 'Nairobi',
    country: 'Kenya',
    postal_code: '00100',
    employment_status: 'full_time',
    employer_name: 'Safaricom',
    monthly_income: 600,
    employment_duration_months: 36,
    kyc_status: 'pending',
    created_at: new Date().toISOString()
  },

  // Customer with low credit score - manual review
  lowScoreCustomer: {
    id: 'cust_test_003',
    phone_number: '+263772345678',
    first_name: 'Grace',
    last_name: 'Chiweshe',
    date_of_birth: '1995-03-10',
    gender: 'female',
    national_id: 'ZIM987654321',
    address_line1: '789 Bulawayo Avenue',
    city: 'Bulawayo',
    province: 'Bulawayo',
    country: 'Zimbabwe',
    postal_code: '00263',
    employment_status: 'self_employed',
    employer_name: 'Self-employed',
    monthly_income: 300,
    employment_duration_months: 12,
    kyc_status: 'verified',
    credit_score: 640, // Manual review range
    created_at: new Date().toISOString()
  },

  // Customer with high credit score - auto-approve
  highScoreCustomer: {
    id: 'cust_test_004',
    phone_number: '+263773456789',
    first_name: 'Joseph',
    last_name: 'Ndlovu',
    date_of_birth: '1988-11-25',
    gender: 'male',
    national_id: 'ZIM456789012',
    address_line1: '321 Mutare Street',
    city: 'Mutare',
    province: 'Manicaland',
    country: 'Zimbabwe',
    postal_code: '00263',
    employment_status: 'full_time',
    employer_name: 'Delta Beverages',
    monthly_income: 800,
    employment_duration_months: 48,
    kyc_status: 'verified',
    credit_score: 780, // Tier 1
    credit_tier: 1,
    created_at: new Date().toISOString()
  }
};

export const testKycVerifications = {
  verified: {
    customer_id: 'cust_test_001',
    verification_provider: 'didit',
    id_type: 'national_id',
    id_number: 'ZIM123456789',
    id_document_url: 'https://test.supabase.co/storage/kyc/id_front_001.jpg',
    selfie_url: 'https://test.supabase.co/storage/kyc/selfie_001.jpg',
    verification_status: 'verified',
    confidence_score: 95.5,
    verified_at: new Date().toISOString()
  },

  rejected: {
    customer_id: 'cust_test_005',
    verification_provider: 'didit',
    id_type: 'national_id',
    id_number: 'ZIM999999999',
    id_document_url: 'https://test.supabase.co/storage/kyc/id_front_005.jpg',
    selfie_url: 'https://test.supabase.co/storage/kyc/selfie_005.jpg',
    verification_status: 'rejected',
    rejection_reason: 'Document quality too low',
    confidence_score: 45.2,
    verified_at: null
  }
};
