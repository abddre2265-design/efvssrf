-- Add import-related columns to pending_public_uploads
ALTER TABLE public.pending_public_uploads 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'local',
ADD COLUMN IF NOT EXISTS import_folder_id UUID REFERENCES public.import_folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS document_category TEXT;

-- Add RLS policy for anonymous users to read open import folders for the organization
CREATE POLICY "Public can read open import folders by org"
ON public.import_folders
FOR SELECT
USING (status = 'open');