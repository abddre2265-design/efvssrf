
-- Fix circular dependency in public UPDATE policy for purchase_payment_requests
DROP POLICY IF EXISTS "Public can update pending payment requests" ON public.purchase_payment_requests;

CREATE POLICY "Public can update pending payment requests"
ON public.purchase_payment_requests
FOR UPDATE
USING (status = 'pending')
WITH CHECK (status = 'awaiting_approval');
