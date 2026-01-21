-- Create delivery_notes table
CREATE TABLE public.delivery_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  delivery_note_number VARCHAR(50) NOT NULL,
  delivery_note_prefix VARCHAR(10) NOT NULL DEFAULT 'BL',
  delivery_note_year INTEGER NOT NULL,
  delivery_note_counter INTEGER NOT NULL,
  delivery_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  currency VARCHAR(3) NOT NULL DEFAULT 'TND',
  exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 1,
  subtotal_ht NUMERIC(15,3) NOT NULL DEFAULT 0,
  total_vat NUMERIC(15,3) NOT NULL DEFAULT 0,
  total_discount NUMERIC(15,3) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(15,3) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, delivery_note_number)
);

-- Create delivery_note_lines table
CREATE TABLE public.delivery_note_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  description TEXT,
  quantity NUMERIC(15,3) NOT NULL DEFAULT 1,
  unit_price_ht NUMERIC(15,3) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total_ht NUMERIC(15,3) NOT NULL DEFAULT 0,
  line_vat NUMERIC(15,3) NOT NULL DEFAULT 0,
  line_total_ttc NUMERIC(15,3) NOT NULL DEFAULT 0,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add delivery status to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'pending';

-- Enable RLS
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_lines ENABLE ROW LEVEL SECURITY;

-- Create ownership check function for delivery notes
CREATE OR REPLACE FUNCTION public.is_delivery_note_owner(dn_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_notes dn
    JOIN public.organizations o ON dn.organization_id = o.id
    WHERE dn.id = dn_id AND o.user_id = auth.uid()
  )
$$;

-- RLS policies for delivery_notes
CREATE POLICY "Users can view their own delivery notes"
ON public.delivery_notes FOR SELECT
USING (is_organization_owner(organization_id));

CREATE POLICY "Users can create their own delivery notes"
ON public.delivery_notes FOR INSERT
WITH CHECK (is_organization_owner(organization_id));

CREATE POLICY "Users can update their own delivery notes"
ON public.delivery_notes FOR UPDATE
USING (is_organization_owner(organization_id));

CREATE POLICY "Users can delete their own delivery notes"
ON public.delivery_notes FOR DELETE
USING (is_organization_owner(organization_id));

-- RLS policies for delivery_note_lines
CREATE POLICY "Users can view their own delivery note lines"
ON public.delivery_note_lines FOR SELECT
USING (is_delivery_note_owner(delivery_note_id));

CREATE POLICY "Users can create their own delivery note lines"
ON public.delivery_note_lines FOR INSERT
WITH CHECK (is_delivery_note_owner(delivery_note_id));

CREATE POLICY "Users can update their own delivery note lines"
ON public.delivery_note_lines FOR UPDATE
USING (is_delivery_note_owner(delivery_note_id));

CREATE POLICY "Users can delete their own delivery note lines"
ON public.delivery_note_lines FOR DELETE
USING (is_delivery_note_owner(delivery_note_id));

-- Triggers for updated_at
CREATE TRIGGER update_delivery_notes_updated_at
BEFORE UPDATE ON public.delivery_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();