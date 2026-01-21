-- Create purchase document status enum
CREATE TYPE public.purchase_status AS ENUM ('pending', 'validated', 'cancelled');

-- Create payment status for purchases
CREATE TYPE public.purchase_payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- Create import folder status enum
CREATE TYPE public.import_folder_status AS ENUM ('open', 'closed');

-- Create document families table
CREATE TABLE public.document_families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_families ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_families
CREATE POLICY "Users can view their organization document families" 
  ON public.document_families FOR SELECT 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = document_families.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can create document families for their organization" 
  ON public.document_families FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = document_families.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can update their organization document families" 
  ON public.document_families FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = document_families.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can delete their organization document families" 
  ON public.document_families FOR DELETE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = document_families.organization_id AND organizations.user_id = auth.uid()));

-- Create import folders table
CREATE TABLE public.import_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  folder_number TEXT NOT NULL,
  folder_month INTEGER NOT NULL CHECK (folder_month >= 1 AND folder_month <= 12),
  folder_year INTEGER NOT NULL,
  country TEXT NOT NULL,
  status public.import_folder_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for import_folders
CREATE POLICY "Users can view their organization import folders" 
  ON public.import_folders FOR SELECT 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = import_folders.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can create import folders for their organization" 
  ON public.import_folders FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = import_folders.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can update their organization import folders" 
  ON public.import_folders FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = import_folders.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can delete their organization import folders" 
  ON public.import_folders FOR DELETE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = import_folders.organization_id AND organizations.user_id = auth.uid()));

-- Create purchase documents table
CREATE TABLE public.purchase_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  import_folder_id UUID REFERENCES public.import_folders(id),
  document_family_id UUID REFERENCES public.document_families(id),
  invoice_number TEXT,
  invoice_date DATE,
  currency TEXT NOT NULL DEFAULT 'TND',
  exchange_rate NUMERIC NOT NULL DEFAULT 1.0,
  subtotal_ht NUMERIC NOT NULL DEFAULT 0,
  total_vat NUMERIC NOT NULL DEFAULT 0,
  total_discount NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  stamp_duty_amount NUMERIC NOT NULL DEFAULT 0,
  net_payable NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status public.purchase_status NOT NULL DEFAULT 'pending',
  payment_status public.purchase_payment_status NOT NULL DEFAULT 'unpaid',
  pdf_url TEXT,
  pdf_hash TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_documents
CREATE POLICY "Users can view their organization purchase documents" 
  ON public.purchase_documents FOR SELECT 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_documents.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can create purchase documents for their organization" 
  ON public.purchase_documents FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_documents.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can update their organization purchase documents" 
  ON public.purchase_documents FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_documents.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can delete their organization purchase documents" 
  ON public.purchase_documents FOR DELETE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_documents.organization_id AND organizations.user_id = auth.uid()));

-- Create purchase document lines table
CREATE TABLE public.purchase_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_document_id UUID NOT NULL REFERENCES public.purchase_documents(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  reference TEXT,
  ean TEXT,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'physical',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_ht NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 19,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  line_total_ht NUMERIC NOT NULL DEFAULT 0,
  line_vat NUMERIC NOT NULL DEFAULT 0,
  line_total_ttc NUMERIC NOT NULL DEFAULT 0,
  is_new_product BOOLEAN NOT NULL DEFAULT false,
  is_existing_product BOOLEAN NOT NULL DEFAULT false,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_lines ENABLE ROW LEVEL SECURITY;

-- Function to check purchase document ownership
CREATE OR REPLACE FUNCTION public.is_purchase_document_owner(purchase_doc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM purchase_documents pd
    JOIN organizations o ON o.id = pd.organization_id
    WHERE pd.id = purchase_doc_id AND o.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS policies for purchase_lines
CREATE POLICY "Users can view their purchase lines" 
  ON public.purchase_lines FOR SELECT 
  USING (is_purchase_document_owner(purchase_document_id));

CREATE POLICY "Users can create purchase lines" 
  ON public.purchase_lines FOR INSERT 
  WITH CHECK (is_purchase_document_owner(purchase_document_id));

CREATE POLICY "Users can update their purchase lines" 
  ON public.purchase_lines FOR UPDATE 
  USING (is_purchase_document_owner(purchase_document_id));

CREATE POLICY "Users can delete their purchase lines" 
  ON public.purchase_lines FOR DELETE 
  USING (is_purchase_document_owner(purchase_document_id));

-- Create import folder history/logs table
CREATE TABLE public.import_folder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_folder_id UUID NOT NULL REFERENCES public.import_folders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_folder_logs ENABLE ROW LEVEL SECURITY;

-- Function to check import folder ownership
CREATE OR REPLACE FUNCTION public.is_import_folder_owner(folder_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM import_folders f
    JOIN organizations o ON o.id = f.organization_id
    WHERE f.id = folder_id AND o.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS policies for import_folder_logs
CREATE POLICY "Users can view their import folder logs" 
  ON public.import_folder_logs FOR SELECT 
  USING (is_import_folder_owner(import_folder_id));

CREATE POLICY "Users can create import folder logs" 
  ON public.import_folder_logs FOR INSERT 
  WITH CHECK (is_import_folder_owner(import_folder_id));

-- Create storage bucket for purchase PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('purchase-documents', 'purchase-documents', false);

-- Storage policies for purchase-documents bucket
CREATE POLICY "Users can upload purchase documents" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'purchase-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their purchase documents" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'purchase-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their purchase documents" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'purchase-documents' AND auth.uid() IS NOT NULL);

-- Create exchange rates table with default values
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL DEFAULT 'TND',
  rate NUMERIC NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, from_currency, to_currency)
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for exchange_rates
CREATE POLICY "Users can view their organization exchange rates" 
  ON public.exchange_rates FOR SELECT 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = exchange_rates.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can create exchange rates for their organization" 
  ON public.exchange_rates FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = exchange_rates.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can update their organization exchange rates" 
  ON public.exchange_rates FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = exchange_rates.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can delete their organization exchange rates" 
  ON public.exchange_rates FOR DELETE 
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = exchange_rates.organization_id AND organizations.user_id = auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_document_families_updated_at
  BEFORE UPDATE ON public.document_families
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_folders_updated_at
  BEFORE UPDATE ON public.import_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_documents_updated_at
  BEFORE UPDATE ON public.purchase_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exchange_rates_updated_at
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();