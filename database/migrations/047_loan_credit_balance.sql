-- Migration 047: Add credit_balance_usd column to loans table
-- Purpose: Track overpayment credit that is applied to the next installment
-- Context: F1 gap from loan journey audit — overpayment handling

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS credit_balance_usd NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN loans.credit_balance_usd IS 'Overpayment credit balance applied to next installment (in USD cents)';
