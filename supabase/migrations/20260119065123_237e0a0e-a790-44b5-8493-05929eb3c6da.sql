-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('created', 'draft', 'validated');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  
  -- Invoice identification
  invoice_number TEXT NOT NULL,
  invoice_prefix TEXT NOT NULL, -- FAC, INV, فاتورة
  invoice_year INTEGER NOT NULL,
  invoice_counter INTEGER NOT NULL,
  
  -- Dates
  invoice_date DATE NOT NULL,
  due_date DATE,
  
  -- Client info snapshot
  client_type TEXT NOT NULL, -- individual_local, business_local, foreign
  
  -- Currency for foreign clients
  currency TEXT NOT NULL DEFAULT 'TND',
  exchange_rate NUMERIC(10, 4) DEFAULT 1.0,
  
  -- Totals (in original currency)
  subtotal_ht NUMERIC(12, 3) NOT NULL DEFAULT 0,
  total_vat NUMERIC(12, 3) NOT NULL DEFAULT 0,
  total_discount NUMERIC(12, 3) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(12, 3) NOT NULL DEFAULT 0,
  
  -- Stamp duty (local only)
  stamp_duty_enabled BOOLEAN NOT NULL DEFAULT true,
  stamp_duty_amount NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
  
  -- Final amount
  net_payable NUMERIC(12, 3) NOT NULL DEFAULT 0,
  
  -- Status
  status public.invoice_status NOT NULL DEFAULT 'created',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint on invoice number per organization
  CONSTRAINT unique_invoice_number_per_org UNIQUE (organization_id, invoice_number)
);

-- Create invoice lines table
CREATE TABLE public.invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  
  -- Line description (serial number, color, size, etc.)
  description TEXT,
  
  -- Quantities and prices
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_ht NUMERIC(12, 3) NOT NULL,
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 0, 7, 13, 19
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  
  -- Calculated totals
  line_total_ht NUMERIC(12, 3) NOT NULL DEFAULT 0,
  line_vat NUMERIC(12, 3) NOT NULL DEFAULT 0,
  line_total_ttc NUMERIC(12, 3) NOT NULL DEFAULT 0,
  
  -- Order for display
  line_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

-- Create function to check invoice ownership
CREATE OR REPLACE FUNCTION public.is_invoice_owner(invoice_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.organizations o ON i.organization_id = o.id
    WHERE i.id = invoice_id AND o.user_id = auth.uid()
  )
$$;

-- RLS Policies for invoices
CREATE POLICY "Users can view their organization invoices"
ON public.invoices FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = invoices.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create invoices for their organization"
ON public.invoices FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = invoices.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their organization invoices"
ON public.invoices FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = invoices.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization invoices"
ON public.invoices FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = invoices.organization_id
  AND organizations.user_id = auth.uid()
));

-- RLS Policies for invoice_lines
CREATE POLICY "Users can view their invoice lines"
ON public.invoice_lines FOR SELECT
USING (is_invoice_owner(invoice_id));

CREATE POLICY "Users can create invoice lines"
ON public.invoice_lines FOR INSERT
WITH CHECK (is_invoice_owner(invoice_id));

CREATE POLICY "Users can update their invoice lines"
ON public.invoice_lines FOR UPDATE
USING (is_invoice_owner(invoice_id));

CREATE POLICY "Users can delete their invoice lines"
ON public.invoice_lines FOR DELETE
USING (is_invoice_owner(invoice_id));

-- Add trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_invoices_organization_id ON public.invoices(organization_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX idx_invoices_year_counter ON public.invoices(organization_id, invoice_year, invoice_counter);
CREATE INDEX idx_invoice_lines_invoice_id ON public.invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_product_id ON public.invoice_lines(product_id);