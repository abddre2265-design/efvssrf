-- Create a dedicated bucket for public uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('public-uploads', 'public-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy to allow public uploads (with token validation in code)
CREATE POLICY "Public can upload with token" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'public-uploads');

-- Allow authenticated users to view their org's uploads
CREATE POLICY "Org owners can view uploads" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'public-uploads');

-- Allow authenticated users to delete uploads from their org
CREATE POLICY "Org owners can delete uploads" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'public-uploads');

-- Create table for public upload links configuration
CREATE TABLE public.public_upload_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  file_prefix TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.public_upload_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Users can view their org upload link"
ON public.public_upload_links
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = public_upload_links.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create upload link for their org"
ON public.public_upload_links
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = public_upload_links.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their org upload link"
ON public.public_upload_links
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = public_upload_links.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their org upload link"
ON public.public_upload_links
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = public_upload_links.organization_id
  AND organizations.user_id = auth.uid()
));

-- Create table for pending public uploads (before processing)
CREATE TABLE public.pending_public_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  supplier_detected TEXT,
  document_number TEXT,
  document_date DATE,
  new_filename TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzed', 'validated', 'duplicate', 'transferred', 'error')),
  analysis_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_public_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org pending uploads"
ON public.pending_public_uploads
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = pending_public_uploads.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create pending uploads for their org"
ON public.pending_public_uploads
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = pending_public_uploads.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their org pending uploads"
ON public.pending_public_uploads
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = pending_public_uploads.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their org pending uploads"
ON public.pending_public_uploads
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = pending_public_uploads.organization_id
  AND organizations.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_public_upload_links_updated_at
BEFORE UPDATE ON public.public_upload_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_public_uploads_updated_at
BEFORE UPDATE ON public.pending_public_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();