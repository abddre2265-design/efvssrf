-- Add columns for customs receipt (quittance) data
ALTER TABLE public.pending_public_uploads 
ADD COLUMN IF NOT EXISTS quittance_type TEXT,
ADD COLUMN IF NOT EXISTS customs_office TEXT,
ADD COLUMN IF NOT EXISTS customs_declaration_number TEXT,
ADD COLUMN IF NOT EXISTS importer_name TEXT,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC;