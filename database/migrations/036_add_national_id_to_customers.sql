-- Migration 036: Add national_id column to customers table
--
-- Enables reliable customer identity beyond phone numbers.
-- Customers in Zimbabwe may have multiple phone numbers, causing
-- duplicate records and split loan history when using phone as the
-- primary identifier. National ID is unique per person.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS national_id VARCHAR(20) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_customers_national_id ON customers(national_id);
