-- =====================================================
-- Migration 017: Add RLS Policies for Unprotected Tables
-- =====================================================
-- Resolves Supabase Security Advisor lint warnings
-- (rls_enabled_no_policy / lint 0008) for 14 public tables
-- that have RLS enabled but no policies defined.
--
-- Tables addressed:
--   1.  admin_users
--   2.  agent_inventory
--   3.  audit_log
--   4.  credit_scores
--   5.  device_locks
--   6.  devices
--   7.  distributors
--   8.  kyc_submissions
--   9.  loans
--   10. notifications
--   11. payments
--   12. support_tickets
--   13. whatsapp_messages
--   14. whatsapp_sessions
--
-- Design:
--   - Service role (Lambda backend) bypasses RLS entirely.
--   - Admins/managers get full CRUD via FOR ALL policies.
--   - Support/reports_viewer get read-only access on
--     customer-facing tables via FOR SELECT policies.
--   - Customers see their own rows via customer_id = auth.uid().
--   - Distributors see their own rows via id / distributor_id.
--
-- Two SECURITY DEFINER helper functions are introduced so that
-- RLS policies on the admin_users table itself can safely check
-- role membership without circular policy evaluation.
--
-- Reference:
--   https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
-- =====================================================


-- =====================================================
-- 0. Helper functions (SECURITY DEFINER)
-- =====================================================
-- These run as the function owner (bypassing RLS on
-- admin_users) to prevent circular evaluation when used
-- in admin_users' own policies.

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'support', 'reports_viewer')
      AND status = 'active'
  );
$$;


-- =====================================================
-- 1. admin_users
-- =====================================================
-- Staff members can view their own profile row.
-- Admins/managers have full CRUD over all staff records.

CREATE POLICY "Staff view own profile"
ON public.admin_users FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins manage all staff"
ON public.admin_users FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 2. agent_inventory
-- =====================================================
-- Distributors see inventory assigned to them.
-- Admins/managers have full CRUD.

CREATE POLICY "Distributors view own inventory"
ON public.agent_inventory FOR SELECT
TO authenticated
USING (
  distributor_id = auth.uid()
  OR public.is_admin_or_manager()
);

CREATE POLICY "Admins manage agent inventory"
ON public.agent_inventory FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 3. audit_log
-- =====================================================
-- Read-only for admins/managers (sensitive security data).
-- Inserts are handled by service_role from backend services.

CREATE POLICY "Admins view audit log"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.is_admin_or_manager());


-- =====================================================
-- 4. credit_scores
-- =====================================================
-- Customers see their own scores.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view credit scores"
ON public.credit_scores FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage credit scores"
ON public.credit_scores FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 5. device_locks
-- =====================================================
-- Customers see lock events on their devices.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view device locks"
ON public.device_locks FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage device locks"
ON public.device_locks FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 6. devices
-- =====================================================
-- Customers see devices assigned to them.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view devices"
ON public.devices FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage devices"
ON public.devices FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 7. distributors
-- =====================================================
-- Distributors see their own profile.
-- Admins/managers have full CRUD.

CREATE POLICY "Distributors view own profile"
ON public.distributors FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin_or_manager()
);

CREATE POLICY "Admins manage distributors"
ON public.distributors FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 8. kyc_submissions
-- =====================================================
-- Customers see their own KYC submissions.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view KYC submissions"
ON public.kyc_submissions FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage KYC submissions"
ON public.kyc_submissions FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 9. loans
-- =====================================================
-- Customers see their own loans.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view loans"
ON public.loans FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage loans"
ON public.loans FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 10. notifications
-- =====================================================
-- Customers see their own notifications.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage notifications"
ON public.notifications FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 11. payments
-- =====================================================
-- Customers see their own payments.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage payments"
ON public.payments FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 12. support_tickets
-- =====================================================
-- Customers see their own tickets.
-- Support staff also see tickets assigned to them.
-- All admin staff can read; admins/managers can write.

CREATE POLICY "Customers and staff view support tickets"
ON public.support_tickets FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_admin_staff()
);

CREATE POLICY "Admins manage support tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 13. whatsapp_messages
-- =====================================================
-- All admin staff can read for customer support.
-- Writes are handled by service_role (WhatsApp service).

CREATE POLICY "Staff view WhatsApp messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (public.is_admin_staff());

CREATE POLICY "Admins manage WhatsApp messages"
ON public.whatsapp_messages FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());


-- =====================================================
-- 14. whatsapp_sessions
-- =====================================================
-- All admin staff can read for customer support.
-- Writes are handled by service_role (WhatsApp service).

CREATE POLICY "Staff view WhatsApp sessions"
ON public.whatsapp_sessions FOR SELECT
TO authenticated
USING (public.is_admin_staff());

CREATE POLICY "Admins manage WhatsApp sessions"
ON public.whatsapp_sessions FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());
