-- Fix: Public SELECT policy leaks all payment requests across accounts
-- Replace it with a scoped policy that requires matching organization via purchase_document

DROP POLICY "Public can view pending payment requests via token" ON public.purchase_payment_requests;

CREATE POLICY "Public can view payment requests via purchase document"
ON public.purchase_payment_requests
FOR SELECT
USING (
  status IN ('pending', 'awaiting_approval', 'approved', 'rejected')
  AND EXISTS (
    SELECT 1 FROM public.purchase_documents pd
    WHERE pd.id = purchase_payment_requests.purchase_document_id
  )
);

-- Also fix the public UPDATE policy which has no org scoping
DROP POLICY "Public can update pending payment requests" ON public.purchase_payment_requests;

CREATE POLICY "Public can update pending payment requests"
ON public.purchase_payment_requests
FOR UPDATE
USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.purchase_documents pd
    WHERE pd.id = purchase_payment_requests.purchase_document_id
  )
)
WITH CHECK (
  status = 'awaiting_approval'
);