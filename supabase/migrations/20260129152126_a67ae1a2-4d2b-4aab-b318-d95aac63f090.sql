-- Fix RLS policy for customs_receipts INSERT
-- The current policy uses is_customs_receipt_owner which requires the row to exist
-- We need to check organization ownership instead

DROP POLICY IF EXISTS "Users can insert own customs receipts" ON public.customs_receipts;

CREATE POLICY "Users can insert own customs receipts" 
ON public.customs_receipts 
FOR INSERT 
WITH CHECK (is_organization_owner(organization_id));

-- Also fix import_folder_logs INSERT policy if needed
DROP POLICY IF EXISTS "Users can insert logs for own folders" ON public.import_folder_logs;

CREATE POLICY "Users can insert logs for own folders"
ON public.import_folder_logs
FOR INSERT
WITH CHECK (is_import_folder_owner(import_folder_id));