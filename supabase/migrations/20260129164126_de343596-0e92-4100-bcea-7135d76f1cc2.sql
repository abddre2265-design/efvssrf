-- Allow public to create import folders (needed for public upload workflow)
CREATE POLICY "Public can create import folders"
ON public.import_folders
FOR INSERT
WITH CHECK (true);