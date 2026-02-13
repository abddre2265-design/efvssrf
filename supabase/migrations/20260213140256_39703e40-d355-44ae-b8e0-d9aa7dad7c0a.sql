
-- Drop functions with CASCADE (to remove dependent RLS policies)
DROP FUNCTION IF EXISTS public.is_credit_note_owner(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_supplier_credit_note_owner(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_commercial_price_overpayment() CASCADE;

-- Drop tables with CASCADE
DROP TABLE IF EXISTS public.credit_note_lines CASCADE;
DROP TABLE IF EXISTS public.credit_notes CASCADE;
DROP TABLE IF EXISTS public.supplier_credit_note_lines CASCADE;
DROP TABLE IF EXISTS public.supplier_credit_notes CASCADE;

-- Remove credit note tracking columns from invoices
ALTER TABLE public.invoices DROP COLUMN IF EXISTS total_credited;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS credit_note_count;
