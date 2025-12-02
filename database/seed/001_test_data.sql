-- =====================================================
-- Lynia Finance - Test Seed Data
-- Seed File: 001
-- Created: November 28, 2025
-- Purpose: Test data for development environment
-- =====================================================

-- ⚠️ ONLY RUN IN DEVELOPMENT/STAGING ENVIRONMENTS
-- DO NOT RUN IN PRODUCTION

-- =====================================================
-- 1. TEST ADMIN USERS
-- =====================================================

INSERT INTO admin_users (id, email, full_name, role, status) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@lynia.finance', 'System Administrator', 'admin', 'active'),
('00000000-0000-0000-0000-000000000002', 'manager@lynia.finance', 'Loan Manager', 'manager', 'active'),
('00000000-0000-0000-0000-000000000003', 'support@lynia.finance', 'Support Agent', 'support', 'active');

-- =====================================================
-- 2. TEST DISTRIBUTORS (Agents)
-- =====================================================

INSERT INTO distributors (id, business_name, contact_person, phone_number, email, city, province, status) VALUES
('00000000-0000-0000-0000-000000000011', 'Harare Mobile Hub', 'John Moyo', '+263771234567', 'harare@agents.lynia.co.zw', 'Harare', 'Harare', 'active'),
('00000000-0000-0000-0000-000000000012', 'Bulawayo Tech Shop', 'Sarah Ncube', '+263781234567', 'bulawayo@agents.lynia.co.zw', 'Bulawayo', 'Bulawayo', 'active');

-- =====================================================
-- 3. TEST LOAN PRODUCTS
-- =====================================================

-- Digital Credit product (launching soon)
INSERT INTO loan_products (
  id,
  product_code,
  product_name,
  product_type,
  status,
  min_amount_usd,
  max_amount_usd,
  loan_term_months,
  interest_rate_annual,
  deposit_percentage,
  description
) VALUES (
  '00000000-0000-0000-0000-000000000021',
  'DIGI_CREDIT_001',
  'Digital Credit',
  'digital_credit',
  'launching_soon',
  50,
  300,
  3,
  18.00,
  0,
  'Short-term digital credit for emergencies - Coming Soon!'
);

-- =====================================================
-- 4. TEST CUSTOMERS
-- =====================================================

-- Customer 1: High credit score, approved
INSERT INTO customers (
  id,
  phone_number,
  country_code,
  phone_verified,
  email,
  first_name,
  last_name,
  date_of_birth,
  gender,
  city,
  province,
  employment_status,
  monthly_income_usd,
  household_size,
  dependents,
  existing_debt_obligations_usd,
  kyc_status,
  kyc_verified_at,
  credit_score,
  credit_tier,
  credit_limit_usd,
  onboarding_status,
  onboarding_current_step,
  onboarding_completed_at
) VALUES (
  '00000000-0000-0000-0000-000000000031',
  '+263771111111',
  '+263',
  TRUE,
  'customer1@test.com',
  'Tendai',
  'Mutasa',
  '1990-05-15',
  'male',
  'Harare',
  'Harare',
  'self_employed',
  450.00,
  3,
  1,
  50.00,
  'approved',
  NOW(),
  750,
  'Tier 3',
  500.00,
  'completed',
  8,
  NOW()
);

-- Customer 2: Medium credit score
INSERT INTO customers (
  id,
  phone_number,
  country_code,
  phone_verified,
  email,
  first_name,
  last_name,
  date_of_birth,
  gender,
  city,
  province,
  employment_status,
  monthly_income_usd,
  household_size,
  dependents,
  existing_debt_obligations_usd,
  kyc_status,
  kyc_verified_at,
  credit_score,
  credit_tier,
  credit_limit_usd,
  onboarding_status,
  onboarding_current_step,
  onboarding_completed_at
) VALUES (
  '00000000-0000-0000-0000-000000000032',
  '+263772222222',
  '+263',
  TRUE,
  'customer2@test.com',
  'Rudo',
  'Chimukoko',
  '1995-08-20',
  'female',
  'Bulawayo',
  'Bulawayo',
  'employed',
  300.00,
  4,
  2,
  75.00,
  'approved',
  NOW(),
  700,
  'Tier 2',
  350.00,
  'completed',
  8,
  NOW()
);

-- Customer 3: In onboarding (not completed)
INSERT INTO customers (
  id,
  phone_number,
  country_code,
  phone_verified,
  first_name,
  last_name,
  kyc_status,
  onboarding_status,
  onboarding_current_step
) VALUES (
  '00000000-0000-0000-0000-000000000033',
  '+263773333333',
  '+263',
  TRUE,
  'Takudzwa',
  'Chivasa',
  'pending',
  'in_progress',
  4
);

-- =====================================================
-- 5. TEST KYC SUBMISSIONS
-- =====================================================

INSERT INTO kyc_submissions (
  id,
  customer_id,
  submission_number,
  attempt_number,
  id_document_url,
  selfie_url,
  id_number,
  status,
  confidence_score,
  face_match_score,
  liveness_passed,
  extracted_name,
  extracted_dob,
  verified_at
) VALUES
(
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031',
  'KYC-001',
  1,
  'https://storage.example.com/id_tendai.jpg',
  'https://storage.example.com/selfie_tendai.jpg',
  '63-1234567-A-11',
  'approved',
  96,
  95,
  TRUE,
  'Tendai Mutasa',
  '1990-05-15',
  NOW()
),
(
  '00000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000032',
  'KYC-002',
  1,
  'https://storage.example.com/id_rudo.jpg',
  'https://storage.example.com/selfie_rudo.jpg',
  '63-7654321-B-22',
  'approved',
  94,
  93,
  TRUE,
  'Rudo Chimukoko',
  '1995-08-20',
  NOW()
);

-- =====================================================
-- 6. TEST CREDIT SCORES
-- =====================================================

INSERT INTO credit_scores (
  id,
  customer_id,
  total_score,
  scaled_score,
  affordability_score,
  repayment_willingness_score,
  mobile_money_score,
  external_credit_score,
  kyc_verification_score,
  decision,
  credit_tier,
  recommended_limit_usd,
  model_version
) VALUES
(
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000031',
  820,
  751,
  280,
  125,
  180,
  140,
  95,
  'approve',
  'Tier 3',
  500.00,
  'rule-based-v1'
),
(
  '00000000-0000-0000-0000-000000000052',
  '00000000-0000-0000-0000-000000000032',
  730,
  702,
  250,
  125,
  155,
  105,
  95,
  'approve',
  'Tier 2',
  350.00,
  'rule-based-v1'
);

-- =====================================================
-- 7. TEST DEVICES
-- =====================================================

INSERT INTO devices (
  id,
  imei,
  serial_number,
  manufacturer,
  model,
  device_type,
  storage_gb,
  color,
  condition,
  purchase_price_usd,
  retail_price_usd,
  status,
  location
) VALUES
(
  '00000000-0000-0000-0000-000000000061',
  '351234567890123',
  'SN12345ABC',
  'Samsung',
  'Galaxy A14',
  'smartphone',
  64,
  'Black',
  'new',
  180.00,
  220.00,
  'in_stock',
  'Harare Warehouse'
),
(
  '00000000-0000-0000-0000-000000000062',
  '351234567890124',
  'SN12346DEF',
  'Samsung',
  'Galaxy A14',
  'smartphone',
  64,
  'Blue',
  'new',
  180.00,
  220.00,
  'in_stock',
  'Harare Warehouse'
),
(
  '00000000-0000-0000-0000-000000000063',
  '351234567890125',
  'SN12347GHI',
  'Redmi',
  'Note 12',
  'smartphone',
  128,
  'Green',
  'new',
  200.00,
  250.00,
  'in_stock',
  'Bulawayo Warehouse'
);

-- =====================================================
-- 8. TEST LOANS
-- =====================================================

-- Active loan for Customer 1
INSERT INTO loans (
  id,
  customer_id,
  product_id,
  loan_number,
  loan_amount_usd,
  interest_rate,
  loan_term_months,
  deposit_amount_usd,
  deposit_paid,
  deposit_paid_at,
  status,
  approval_status,
  approved_at,
  approved_by,
  disbursed_at,
  disbursed_amount_usd,
  total_amount_due_usd,
  total_paid_usd,
  outstanding_balance_usd,
  next_payment_date,
  next_payment_amount_usd,
  days_past_due,
  missed_payments_count
) VALUES (
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000020',  -- SMRT_FIN_001
  'LN-2025-001',
  200.00,
  12.00,
  6,
  20.00,
  TRUE,
  NOW() - INTERVAL '2 days',
  'active',
  'auto_approved',
  NOW() - INTERVAL '2 days',
  '00000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '1 day',
  200.00,
  224.00,  -- 200 + 12% = 224
  37.33,  -- 1 payment made
  186.67,
  CURRENT_DATE + INTERVAL '28 days',
  37.33,
  0,
  0
);

-- Pending loan for Customer 2
INSERT INTO loans (
  id,
  customer_id,
  product_id,
  loan_number,
  loan_amount_usd,
  interest_rate,
  loan_term_months,
  deposit_amount_usd,
  deposit_paid,
  deposit_paid_at,
  status,
  approval_status,
  approved_at,
  approved_by,
  total_amount_due_usd
) VALUES (
  '00000000-0000-0000-0000-000000000072',
  '00000000-0000-0000-0000-000000000032',
  '00000000-0000-0000-0000-000000000020',
  'LN-2025-002',
  350.00,
  12.00,
  6,
  35.00,
  TRUE,
  NOW() - INTERVAL '1 day',
  'approved',
  'auto_approved',
  NOW() - INTERVAL '1 day',
  '00000000-0000-0000-0000-000000000001',
  392.00  -- 350 + 12% = 392
);

-- =====================================================
-- 9. TEST PAYMENTS
-- =====================================================

-- Deposit payment for Loan 1
INSERT INTO payments (
  id,
  loan_id,
  customer_id,
  payment_type,
  amount_usd,
  payment_method,
  payment_provider,
  transaction_id,
  status,
  confirmed_at,
  reconciled,
  payment_date
) VALUES (
  '00000000-0000-0000-0000-000000000081',
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000031',
  'deposit',
  20.00,
  'ecocash',
  'EcoCash',
  'ECO-TXN-001',
  'confirmed',
  NOW() - INTERVAL '2 days',
  TRUE,
  NOW() - INTERVAL '2 days'
);

-- First installment for Loan 1
INSERT INTO payments (
  id,
  loan_id,
  customer_id,
  payment_type,
  amount_usd,
  payment_method,
  payment_provider,
  transaction_id,
  status,
  confirmed_at,
  reconciled,
  payment_date
) VALUES (
  '00000000-0000-0000-0000-000000000082',
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000031',
  'installment',
  37.33,
  'ecocash',
  'EcoCash',
  'ECO-TXN-002',
  'confirmed',
  NOW() - INTERVAL '1 day',
  TRUE,
  NOW() - INTERVAL '1 day'
);

-- Deposit payment for Loan 2
INSERT INTO payments (
  id,
  loan_id,
  customer_id,
  payment_type,
  amount_usd,
  payment_method,
  payment_provider,
  transaction_id,
  status,
  confirmed_at,
  reconciled,
  payment_date
) VALUES (
  '00000000-0000-0000-0000-000000000083',
  '00000000-0000-0000-0000-000000000072',
  '00000000-0000-0000-0000-000000000032',
  'deposit',
  35.00,
  'onemoney',
  'OneMoney',
  'ONE-TXN-001',
  'confirmed',
  NOW() - INTERVAL '1 day',
  TRUE,
  NOW() - INTERVAL '1 day'
);

-- =====================================================
-- 10. TEST NOTIFICATIONS
-- =====================================================

INSERT INTO notifications (
  customer_id,
  loan_id,
  type,
  template,
  subject,
  message,
  recipient_phone,
  status,
  sent_at,
  delivered_at,
  provider
) VALUES
(
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000071',
  'sms',
  'loan_approved',
  'Loan Approved',
  'Congratulations! Your loan of $200 has been approved. Deposit: $20.',
  '+263771111111',
  'delivered',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  'twilio'
),
(
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000071',
  'whatsapp',
  'payment_reminder',
  'Payment Reminder',
  'Your next payment of $37.33 is due on ' || TO_CHAR(CURRENT_DATE + INTERVAL '28 days', 'DD/MM/YYYY'),
  '+263771111111',
  'sent',
  NOW(),
  NULL,
  'whatsapp'
);

-- =====================================================
-- 11. TEST INTERNATIONAL INTEREST (Zimbabwe-only policy)
-- =====================================================

INSERT INTO international_interest (
  phone_number,
  country_code,
  email,
  full_name,
  country,
  city,
  product_interest
) VALUES
(
  '+254712345678',
  '+254',
  'kenya.customer@example.com',
  'John Kamau',
  'Kenya',
  'Nairobi',
  'smartphone'
),
(
  '+27821234567',
  '+27',
  'sa.customer@example.com',
  'Thabo Mbeki',
  'South Africa',
  'Johannesburg',
  'smartphone'
);

-- =====================================================
-- 12. TEST PRODUCT WAITLIST (Digital Credit)
-- =====================================================

INSERT INTO product_interest_waitlist (
  customer_id,
  product_id,
  phone_number,
  email,
  product_code,
  product_name
) VALUES
(
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000021',
  '+263771111111',
  'customer1@test.com',
  'DIGI_CREDIT_001',
  'Digital Credit'
),
(
  '00000000-0000-0000-0000-000000000032',
  '00000000-0000-0000-0000-000000000021',
  '+263772222222',
  'customer2@test.com',
  'DIGI_CREDIT_001',
  'Digital Credit'
);

-- =====================================================
-- VERIFY SEED DATA
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Test seed data inserted successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Accounts Created:';
  RAISE NOTICE '- Admin: admin@lynia.finance';
  RAISE NOTICE '- Manager: manager@lynia.finance';
  RAISE NOTICE '- Support: support@lynia.finance';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Customers:';
  RAISE NOTICE '- Customer 1: +263771111111 (Tier 3, Score 750)';
  RAISE NOTICE '- Customer 2: +263772222222 (Tier 2, Score 700)';
  RAISE NOTICE '- Customer 3: +263773333333 (In onboarding)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Loans:';
  RAISE NOTICE '- LN-2025-001: $200 (Active, 1 payment made)';
  RAISE NOTICE '- LN-2025-002: $350 (Approved, deposit paid)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Devices: 3 smartphones in stock';
  RAISE NOTICE 'Test Agents: 2 distributors (Harare, Bulawayo)';
END $$;
