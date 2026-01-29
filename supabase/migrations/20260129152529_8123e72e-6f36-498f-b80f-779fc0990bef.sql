-- Remove conflicting INSERT policy - there are two RESTRICTIVE INSERT policies
-- Both must pass for insert to work, which causes the failure
DROP POLICY IF EXISTS "Users can create customs receipts in their organization" ON public.customs_receipts;