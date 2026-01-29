-- Drop and recreate INSERT policy with explicit inline check (no function call)
DROP POLICY IF EXISTS "Users can insert own customs receipts" ON public.customs_receipts;

CREATE POLICY "Users can insert customs receipts for their organization" 
ON public.customs_receipts 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = customs_receipts.organization_id 
    AND organizations.user_id = auth.uid()
  )
);