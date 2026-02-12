-- AWS Pre-Migration Script
-- Run BEFORE the standard migrations (001-017) on RDS PostgreSQL.
-- Creates stubs for Supabase-specific functions so existing migrations parse
-- without modification.

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create a stub auth schema with auth.uid() function.
-- Supabase migrations reference auth.uid() in RLS policies.
-- This stub lets those CREATE POLICY statements execute without error.
-- The RLS policies and this schema are removed in 018_remove_rls_for_aws.sql.
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true)::uuid;
END;
$$ LANGUAGE plpgsql;
