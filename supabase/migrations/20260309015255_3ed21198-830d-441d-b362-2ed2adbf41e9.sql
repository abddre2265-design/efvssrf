
-- Add net_payable and rejection_reason columns to invoice_requests
ALTER TABLE public.invoice_requests 
  ADD COLUMN IF NOT EXISTS net_payable numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
