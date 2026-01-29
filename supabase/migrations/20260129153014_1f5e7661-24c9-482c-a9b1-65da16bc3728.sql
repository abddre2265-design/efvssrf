-- Fix SELECT policy - use organization ownership check instead of is_customs_receipt_owner
-- The is_customs_receipt_owner function requires the row to exist, which works for SELECT
-- BUT when combined with INSERT...RETURNING, the SELECT check happens before the row is fully committed

DROP POLICY IF EXISTS "Users can view their own customs receipts" ON public.customs_receipts;

CREATE POLICY "Users can view their own customs receipts" 
ON public.customs_receipts 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = customs_receipts.organization_id 
    AND organizations.user_id = auth.uid()
  )
);

-- Also fix UPDATE and DELETE to be consistent
DROP POLICY IF EXISTS "Users can update their own customs receipts" ON public.customs_receipts;

CREATE POLICY "Users can update their own customs receipts" 
ON public.customs_receipts 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = customs_receipts.organization_id 
    AND organizations.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own customs receipts" ON public.customs_receipts;

CREATE POLICY "Users can delete their own customs receipts" 
ON public.customs_receipts 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = customs_receipts.organization_id 
    AND organizations.user_id = auth.uid()
  )
);