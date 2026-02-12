-- =====================================================
-- Migration 016: Fix Supabase Security Advisor Warnings
-- =====================================================
-- Resolves:
--   1. function_search_path_mutable on public.update_updated_at_column
--   2. function_search_path_mutable on public.refresh_portfolio_summary
--   3. function_search_path_mutable on public.increment_distributor_stats
--   4. materialized_view_in_api on public.mv_portfolio_summary
--
-- References:
--   https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
--   https://supabase.com/docs/guides/database/database-linter?lint=0016_materialized_view_in_api
-- =====================================================

-- =====================================================
-- 1. FIX: update_updated_at_column — set immutable search_path
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. FIX: refresh_portfolio_summary — set immutable search_path
-- =====================================================
CREATE OR REPLACE FUNCTION public.refresh_portfolio_summary()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_portfolio_summary;
END;
$$;

-- =====================================================
-- 3. FIX: increment_distributor_stats — set immutable search_path
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_distributor_stats(
  dist_id UUID,
  devices_sold INTEGER DEFAULT 0,
  revenue DECIMAL(12, 2) DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.distributors
  SET
    total_devices_sold = total_devices_sold + devices_sold,
    total_revenue_usd = total_revenue_usd + revenue,
    updated_at = NOW()
  WHERE id = dist_id;
END;
$$;

-- =====================================================
-- 4. FIX: mv_portfolio_summary — revoke API access
-- =====================================================
-- Materialized views exposed to anon/authenticated roles are
-- accessible via the Supabase Data API (PostgREST). Revoking
-- SELECT removes them from the API surface while keeping them
-- usable by service_role and database functions.
REVOKE SELECT ON public.mv_portfolio_summary FROM anon;
REVOKE SELECT ON public.mv_portfolio_summary FROM authenticated;
