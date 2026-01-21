-- Create invoice_requests table
CREATE TABLE public.invoice_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Client info (same as clients table)
  client_type TEXT NOT NULL, -- 'company' or 'individual'
  company_name TEXT,
  first_name TEXT,
  last_name TEXT,
  identifier_type TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  phone_prefix TEXT DEFAULT '+216',
  whatsapp TEXT,
  whatsapp_prefix TEXT DEFAULT '+216',
  address TEXT,
  governorate TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'TN',
  
  -- Transaction info
  purchase_date DATE NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  transaction_number TEXT NOT NULL,
  receipt_number TEXT,
  order_number TEXT,
  total_ttc NUMERIC(12,3) NOT NULL,
  
  -- Payment info
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- 'paid', 'partial', 'unpaid'
  paid_amount NUMERIC(12,3) DEFAULT 0,
  payment_methods JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'rejected', 'converted'
  
  -- Linked client if found
  linked_client_id UUID REFERENCES public.clients(id),
  
  -- AI conversation
  ai_conversation JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice request links table (one per organization)
CREATE TABLE public.invoice_request_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_request_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_requests
CREATE POLICY "Users can view their organization's invoice requests"
  ON public.invoice_requests
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoice requests for their organization"
  ON public.invoice_requests
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's invoice requests"
  ON public.invoice_requests
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organization's invoice requests"
  ON public.invoice_requests
  FOR DELETE
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE user_id = auth.uid()
    )
  );

-- Allow public insert via token (for public form)
CREATE POLICY "Public can insert invoice requests via valid token"
  ON public.invoice_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoice_request_links
      WHERE organization_id = invoice_requests.organization_id
      AND is_active = true
    )
  );

-- RLS policies for invoice_request_links
CREATE POLICY "Users can view their organization's request links"
  ON public.invoice_request_links
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's request links"
  ON public.invoice_request_links
  FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE user_id = auth.uid()
    )
  );

-- Public can read link info by token
CREATE POLICY "Public can read active links by token"
  ON public.invoice_request_links
  FOR SELECT
  USING (is_active = true);

-- Public read for stores (for dropdown)
CREATE POLICY "Public can read active stores via request link"
  ON public.stores
  FOR SELECT
  USING (
    is_active = true AND
    organization_id IN (
      SELECT organization_id FROM public.invoice_request_links WHERE is_active = true
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_invoice_requests_updated_at
  BEFORE UPDATE ON public.invoice_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_request_links_updated_at
  BEFORE UPDATE ON public.invoice_request_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();