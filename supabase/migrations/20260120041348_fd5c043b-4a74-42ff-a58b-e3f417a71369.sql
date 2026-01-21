-- Add file_hash column to pending_public_uploads for duplicate detection by file content
ALTER TABLE public.pending_public_uploads 
ADD COLUMN file_hash TEXT;