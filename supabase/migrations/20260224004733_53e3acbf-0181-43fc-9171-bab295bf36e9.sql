
-- Allow public SELECT on purchase_documents only when referenced by a payment request
-- This is scoped: only rows that have a payment request can be seen
CREATE POLICY "Public can view purchase documents linked to payment requests"
ON public.purchase_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM purchase_payment_requests ppr
    WHERE ppr.purchase_document_id = purchase_documents.id
    AND ppr.status IN ('pending', 'awaiting_approval', 'approved', 'rejected')
  )
);

-- Allow public SELECT on suppliers only when referenced by a purchase document that has a payment request
CREATE POLICY "Public can view suppliers linked to payment requests"
ON public.suppliers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM purchase_documents pd
    JOIN purchase_payment_requests ppr ON ppr.purchase_document_id = pd.id
    WHERE pd.supplier_id = suppliers.id
    AND ppr.status IN ('pending', 'awaiting_approval', 'approved', 'rejected')
  )
);
