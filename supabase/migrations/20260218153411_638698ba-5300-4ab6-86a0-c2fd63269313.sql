-- Remove the overly permissive public SELECT policy
DROP POLICY "Public can check purchase document duplicates" ON public.purchase_documents;