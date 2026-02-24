
-- Drop the circular policy on purchase_payment_requests
DROP POLICY IF EXISTS "Public can view payment requests via purchase document" ON public.purchase_payment_requests;

-- Recreate with a simple status-based check (no circular dependency)
CREATE POLICY "Public can view payment requests by status"
ON public.purchase_payment_requests
FOR SELECT
USING (status IN ('pending', 'awaiting_approval', 'approved', 'rejected'));
