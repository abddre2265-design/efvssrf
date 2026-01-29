-- Create table for other import folder documents (not invoices or customs receipts)
CREATE TABLE public.import_folder_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_folder_id UUID NOT NULL REFERENCES public.import_folders(id) ON DELETE CASCADE,
  pending_upload_id UUID REFERENCES public.pending_public_uploads(id) ON DELETE SET NULL,
  document_family_id UUID REFERENCES public.document_families(id) ON DELETE SET NULL,
  
  -- Document info
  document_type TEXT NOT NULL DEFAULT 'import',
  document_category TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  pdf_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'validated',
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_folder_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies using organization ownership
CREATE POLICY "Users can view their import folder documents"
ON public.import_folder_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = import_folder_documents.organization_id
    AND organizations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert import folder documents"
ON public.import_folder_documents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = import_folder_documents.organization_id
    AND organizations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their import folder documents"
ON public.import_folder_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = import_folder_documents.organization_id
    AND organizations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their import folder documents"
ON public.import_folder_documents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = import_folder_documents.organization_id
    AND organizations.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_import_folder_documents_folder ON public.import_folder_documents(import_folder_id);
CREATE INDEX idx_import_folder_documents_org ON public.import_folder_documents(organization_id);

-- Add trigger for updated_at
CREATE TRIGGER update_import_folder_documents_updated_at
BEFORE UPDATE ON public.import_folder_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();