
-- Fix: Restrict public policies to anon role only to prevent data leaking between authenticated users

-- 1. purchase_payment_requests: public SELECT
DROP POLICY IF EXISTS "Public can view payment requests by status" ON public.purchase_payment_requests;
CREATE POLICY "Public can view payment requests by status"
ON public.purchase_payment_requests
FOR SELECT
TO anon
USING (status IN ('pending', 'awaiting_approval', 'approved', 'rejected'));

-- 2. purchase_payment_requests: public UPDATE
DROP POLICY IF EXISTS "Public can update pending payment requests" ON public.purchase_payment_requests;
CREATE POLICY "Public can update pending payment requests"
ON public.purchase_payment_requests
FOR UPDATE
TO anon
USING (status = 'pending')
WITH CHECK (status = 'awaiting_approval');

-- 3. purchase_documents: public SELECT
DROP POLICY IF EXISTS "Public can view purchase documents linked to payment requests" ON public.purchase_documents;
CREATE POLICY "Public can view purchase documents linked to payment requests"
ON public.purchase_documents
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM purchase_payment_requests ppr
  WHERE ppr.purchase_document_id = purchase_documents.id
  AND ppr.status IN ('pending', 'awaiting_approval', 'approved', 'rejected')
));

-- 4. suppliers: public SELECT
DROP POLICY IF EXISTS "Public can view suppliers linked to payment requests" ON public.suppliers;
CREATE POLICY "Public can view suppliers linked to payment requests"
ON public.suppliers
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM purchase_documents pd
  JOIN purchase_payment_requests ppr ON ppr.purchase_document_id = pd.id
  WHERE pd.supplier_id = suppliers.id
  AND ppr.status IN ('pending', 'awaiting_approval', 'approved', 'rejected')
));

-- 5. purchase_lines: check if there's a public policy too
DROP POLICY IF EXISTS "Public can view purchase lines linked to payment requests" ON public.purchase_lines;
CREATE POLICY "Public can view purchase lines linked to payment requests"
ON public.purchase_lines
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM purchase_payment_requests ppr
  WHERE ppr.purchase_document_id = purchase_lines.purchase_document_id
  AND ppr.status IN ('pending', 'awaiting_approval', 'approved', 'rejected')
));
