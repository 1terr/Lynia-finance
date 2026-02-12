-- Enable Row Level Security on tables flagged by Supabase linter.
--
-- The following public tables were missing RLS:
--   1. loan_products
--   2. international_interest
--   3. product_interest_waitlist
--   4. system_config
--
-- All backend Lambda services use the Supabase service_role key, which
-- bypasses RLS by default, so existing server-side functionality is
-- unaffected.

-- ===================================================================
-- 1. loan_products – product catalog (read by authenticated users,
--    managed by admins)
-- ===================================================================

ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;

-- Authenticated users can browse active products
CREATE POLICY "Authenticated users can view active loan products"
ON loan_products FOR SELECT
TO authenticated
USING (
    status = 'active'
    OR EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- Admins can manage all loan products
CREATE POLICY "Admins manage loan products"
ON loan_products FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- ===================================================================
-- 2. international_interest – interest submissions from outside
--    Zimbabwe (inserted via API, managed by admins)
-- ===================================================================

ALTER TABLE international_interest ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage international interest submissions
CREATE POLICY "Admins manage international interest"
ON international_interest FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- ===================================================================
-- 3. product_interest_waitlist – customer waitlist for upcoming
--    products (customers see own entries, admins manage all)
-- ===================================================================

ALTER TABLE product_interest_waitlist ENABLE ROW LEVEL SECURITY;

-- Customers can view their own waitlist entries
CREATE POLICY "Customers view own waitlist entries"
ON product_interest_waitlist FOR SELECT
TO authenticated
USING (
    customer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- Admins can manage all waitlist entries
CREATE POLICY "Admins manage product waitlist"
ON product_interest_waitlist FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);

-- ===================================================================
-- 4. system_config – application configuration (admin-only access)
-- ===================================================================

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read and manage system configuration
CREATE POLICY "Admins manage system config"
ON system_config FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
        AND status = 'active'
    )
);
