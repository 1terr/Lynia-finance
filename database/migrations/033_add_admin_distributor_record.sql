-- Migration 033: Add distributor record for admin user Tereraishe Admin
-- This allows the admin to use the distributor dashboard with their own data.

INSERT INTO distributors (
  business_name,
  contact_person,
  phone_number,
  email,
  city,
  province,
  status,
  user_id,
  commission_rate,
  kyc_status,
  created_at,
  updated_at
)
SELECT
  'Lynia Finance HQ',
  'Tereraishe Admin',
  '+263000000000',
  'tereraishe@lyniafinance.com',
  'Harare',
  'Harare',
  'active',
  '74c824d8-2091-70d9-1c94-5db42629c25e',
  5.00,
  'approved',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM distributors WHERE user_id = '74c824d8-2091-70d9-1c94-5db42629c25e'
);
