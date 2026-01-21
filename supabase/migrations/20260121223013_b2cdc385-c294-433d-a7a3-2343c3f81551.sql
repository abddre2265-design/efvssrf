-- Add unique constraint on transaction_number per organization
-- This ensures the same transaction number can only be used once per organization
CREATE UNIQUE INDEX idx_invoice_requests_org_transaction_unique 
ON public.invoice_requests (organization_id, transaction_number);

-- Add comment explaining the constraint
COMMENT ON INDEX idx_invoice_requests_org_transaction_unique IS 'Ensures transaction number is unique per organization to prevent duplicate requests';