-- Add withholding tracking to invoices
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS withholding_rate NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS withholding_amount NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS withholding_applied BOOLEAN NOT NULL DEFAULT false;