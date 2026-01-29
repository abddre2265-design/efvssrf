-- Drop the existing public update policy
DROP POLICY IF EXISTS "Public can update pending payment requests" ON public.purchase_payment_requests;

-- Create corrected policy: allow public to update pending requests and set them to awaiting_approval
CREATE POLICY "Public can update pending payment requests"
ON public.purchase_payment_requests
FOR UPDATE
USING (status = 'pending')
WITH CHECK (status = 'awaiting_approval');