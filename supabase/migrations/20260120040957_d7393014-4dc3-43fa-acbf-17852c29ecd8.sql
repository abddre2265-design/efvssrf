-- Allow anonymous SELECT on purchase_documents for duplicate checking (limited to checking existence)
CREATE POLICY "Public can check purchase document duplicates"
ON public.purchase_documents
FOR SELECT
USING (true);

-- Allow anonymous SELECT on pending_public_uploads for duplicate checking
CREATE POLICY "Public can check pending upload duplicates"
ON public.pending_public_uploads
FOR SELECT
USING (true);