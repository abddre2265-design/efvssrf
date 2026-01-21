-- Create quote_request_links table for public access tokens
CREATE TABLE public.quote_request_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote_requests table
CREATE TABLE public.quote_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  
  -- Client info (may or may not be linked to existing client)
  client_id UUID REFERENCES public.clients(id),
  client_type TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  identifier_type TEXT,
  identifier_value TEXT,
  country TEXT DEFAULT 'Tunisie',
  governorate TEXT,
  address TEXT,
  postal_code TEXT,
  phone_prefix TEXT DEFAULT '+216',
  phone TEXT,
  whatsapp_prefix TEXT DEFAULT '+216',
  whatsapp TEXT,
  email TEXT,
  
  -- AI conversation summary
  ai_conversation_summary TEXT,
  ai_extracted_needs TEXT,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote_request_items table for extracted product needs
CREATE TABLE public.quote_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  quantity INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote_request_messages table for AI conversation history
CREATE TABLE public.quote_request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_request_id UUID NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_request_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_request_links
CREATE POLICY "Users can view their organization's quote request links"
  ON public.quote_request_links FOR SELECT
  USING (public.is_organization_owner(organization_id));

CREATE POLICY "Users can create quote request links for their organization"
  ON public.quote_request_links FOR INSERT
  WITH CHECK (public.is_organization_owner(organization_id));

CREATE POLICY "Users can update their organization's quote request links"
  ON public.quote_request_links FOR UPDATE
  USING (public.is_organization_owner(organization_id));

-- Public read access for active links (for public page validation)
CREATE POLICY "Anyone can read active quote request links by token"
  ON public.quote_request_links FOR SELECT
  USING (is_active = true);

-- RLS Policies for quote_requests
CREATE POLICY "Users can view their organization's quote requests"
  ON public.quote_requests FOR SELECT
  USING (public.is_organization_owner(organization_id));

CREATE POLICY "Anyone can create quote requests"
  ON public.quote_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their organization's quote requests"
  ON public.quote_requests FOR UPDATE
  USING (public.is_organization_owner(organization_id));

-- RLS Policies for quote_request_items
CREATE POLICY "Users can view their organization's quote request items"
  ON public.quote_request_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.quote_requests qr
    WHERE qr.id = quote_request_id
    AND public.is_organization_owner(qr.organization_id)
  ));

CREATE POLICY "Anyone can create quote request items"
  ON public.quote_request_items FOR INSERT
  WITH CHECK (true);

-- RLS Policies for quote_request_messages
CREATE POLICY "Users can view their organization's quote request messages"
  ON public.quote_request_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.quote_requests qr
    WHERE qr.id = quote_request_id
    AND public.is_organization_owner(qr.organization_id)
  ));

CREATE POLICY "Anyone can create quote request messages"
  ON public.quote_request_messages FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_quote_request_links_token ON public.quote_request_links(access_token);
CREATE INDEX idx_quote_request_links_org ON public.quote_request_links(organization_id);
CREATE INDEX idx_quote_requests_org ON public.quote_requests(organization_id);
CREATE INDEX idx_quote_requests_status ON public.quote_requests(status);
CREATE INDEX idx_quote_request_items_request ON public.quote_request_items(quote_request_id);
CREATE INDEX idx_quote_request_messages_request ON public.quote_request_messages(quote_request_id);

-- Trigger for updated_at
CREATE TRIGGER update_quote_request_links_updated_at
  BEFORE UPDATE ON public.quote_request_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();