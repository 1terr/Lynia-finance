-- AWS Post-Migration Script
-- Run AFTER all standard migrations (001-017) on RDS PostgreSQL.
-- Removes Supabase-specific RLS policies and auth schema.
-- Authorization is handled at the application layer (Lambda + Cognito).

-- Disable RLS on all public tables
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END;
$$;

-- Drop all RLS policies on public tables
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- Drop Supabase-specific helper functions
DROP FUNCTION IF EXISTS public.is_admin_or_manager();
DROP FUNCTION IF EXISTS public.is_admin_staff();

-- Drop the auth schema stub (no longer needed)
DROP SCHEMA IF EXISTS auth CASCADE;
