-- Create quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  client_id uuid REFERENCES public.clients(id),
  quote_request_id uuid REFERENCES public.quote_requests(id),
  
  quote_number text NOT NULL,
  quote_prefix text NOT NULL DEFAULT 'DEV',
  quote_year integer NOT NULL,
  quote_counter integer NOT NULL,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  validity_date date,
  
  client_type text NOT NULL DEFAULT 'person',
  currency text NOT NULL DEFAULT 'TND',
  exchange_rate numeric NOT NULL DEFAULT 1,
  
  subtotal_ht numeric NOT NULL DEFAULT 0,
  total_vat numeric NOT NULL DEFAULT 0,
  total_discount numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  stamp_duty_enabled boolean NOT NULL DEFAULT true,
  stamp_duty_amount numeric NOT NULL DEFAULT 1.000,
  net_payable numeric NOT NULL DEFAULT 0,
  
  status text NOT NULL DEFAULT 'draft',
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create quote_lines table
CREATE TABLE public.quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_ht numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  line_total_ht numeric NOT NULL DEFAULT 0,
  line_vat numeric NOT NULL DEFAULT 0,
  line_total_ttc numeric NOT NULL DEFAULT 0,
  line_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

-- RLS for quotes
CREATE POLICY "Users can view their organization quotes"
  ON public.quotes FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = quotes.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can create quotes for their organization"
  ON public.quotes FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = quotes.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can update their organization quotes"
  ON public.quotes FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = quotes.organization_id AND organizations.user_id = auth.uid()));

CREATE POLICY "Users can delete their organization quotes"
  ON public.quotes FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = quotes.organization_id AND organizations.user_id = auth.uid()));

-- Helper function for quote lines RLS
CREATE OR REPLACE FUNCTION public.is_quote_owner(q_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.organizations o ON q.organization_id = o.id
    WHERE q.id = q_id AND o.user_id = auth.uid()
  )
$$;

-- RLS for quote_lines
CREATE POLICY "Users can view their quote lines"
  ON public.quote_lines FOR SELECT TO public
  USING (is_quote_owner(quote_id));

CREATE POLICY "Users can create quote lines"
  ON public.quote_lines FOR INSERT TO public
  WITH CHECK (is_quote_owner(quote_id));

CREATE POLICY "Users can update their quote lines"
  ON public.quote_lines FOR UPDATE TO public
  USING (is_quote_owner(quote_id));

CREATE POLICY "Users can delete their quote lines"
  ON public.quote_lines FOR DELETE TO public
  USING (is_quote_owner(quote_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;

-- Trigger for updated_at
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();