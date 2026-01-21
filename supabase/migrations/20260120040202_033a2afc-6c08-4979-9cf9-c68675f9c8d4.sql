-- Allow anonymous uploads to public-uploads bucket with token validation in code
CREATE POLICY "Public can upload to public-uploads bucket"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'public-uploads');

-- Allow anonymous inserts to pending_public_uploads (token validation done in app code)
CREATE POLICY "Public can create pending uploads"
ON public.pending_public_uploads
FOR INSERT
WITH CHECK (true);