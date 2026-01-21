-- Allow public/anonymous read access to verify token validity
CREATE POLICY "Public can check active tokens"
ON public.public_upload_links
FOR SELECT
USING (is_active = true);