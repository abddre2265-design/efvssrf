-- Create credit note type enum
CREATE TYPE public.credit_note_type AS ENUM ('financial', 'product_return');

-- Create credit note status enum
CREATE TYPE public.credit_note_status AS ENUM ('draft', 'validated', 'cancelled');

-- Create credit notes table
CREATE TABLE public.credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  
  -- Numbering
  credit_note_number TEXT NOT NULL,
  credit_note_prefix TEXT NOT NULL,
  credit_note_year INTEGER NOT NULL,
  credit_note_counter INTEGER NOT NULL,
  
  -- Type and dates
  credit_note_type public.credit_note_type NOT NULL,
  credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  
  -- Amounts
  subtotal_ht NUMERIC NOT NULL DEFAULT 0,
  total_vat NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  stamp_duty_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Credit tracking
  credit_generated NUMERIC NOT NULL DEFAULT 0,
  credit_used NUMERIC NOT NULL DEFAULT 0,
  credit_available NUMERIC NOT NULL DEFAULT 0,
  credit_blocked NUMERIC NOT NULL DEFAULT 0,
  
  -- Status
  status public.credit_note_status NOT NULL DEFAULT 'draft',
  
  -- Currency (inherit from invoice)
  currency TEXT NOT NULL DEFAULT 'TND',
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit note lines table
CREATE TABLE public.credit_note_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  
  -- For product return type
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  invoice_line_id UUID REFERENCES public.invoice_lines(id) ON DELETE RESTRICT,
  
  -- Line details
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price_ht NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  
  -- Calculated totals
  line_total_ht NUMERIC NOT NULL DEFAULT 0,
  line_vat NUMERIC NOT NULL DEFAULT 0,
  line_total_ttc NUMERIC NOT NULL DEFAULT 0,
  
  -- Return specific
  return_reason TEXT,
  stock_restored BOOLEAN NOT NULL DEFAULT false,
  
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add credit note tracking to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS total_credited NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_note_count INTEGER NOT NULL DEFAULT 0;

-- Enable Row Level Security
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;

-- Create function to check credit note ownership
CREATE OR REPLACE FUNCTION public.is_credit_note_owner(credit_note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.credit_notes cn
    JOIN public.organizations o ON cn.organization_id = o.id
    WHERE cn.id = credit_note_id AND o.user_id = auth.uid()
  )
$$;

-- RLS Policies for credit_notes
CREATE POLICY "Users can view their organization credit notes" 
ON public.credit_notes 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = credit_notes.organization_id 
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create credit notes for their organization" 
ON public.credit_notes 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = credit_notes.organization_id 
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their organization credit notes" 
ON public.credit_notes 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = credit_notes.organization_id 
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization credit notes" 
ON public.credit_notes 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = credit_notes.organization_id 
  AND organizations.user_id = auth.uid()
));

-- RLS Policies for credit_note_lines
CREATE POLICY "Users can view their credit note lines" 
ON public.credit_note_lines 
FOR SELECT 
USING (is_credit_note_owner(credit_note_id));

CREATE POLICY "Users can create credit note lines" 
ON public.credit_note_lines 
FOR INSERT 
WITH CHECK (is_credit_note_owner(credit_note_id));

CREATE POLICY "Users can update their credit note lines" 
ON public.credit_note_lines 
FOR UPDATE 
USING (is_credit_note_owner(credit_note_id));

CREATE POLICY "Users can delete their credit note lines" 
ON public.credit_note_lines 
FOR DELETE 
USING (is_credit_note_owner(credit_note_id));

-- Create trigger for updated_at
CREATE TRIGGER update_credit_notes_updated_at
BEFORE UPDATE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_credit_notes_invoice_id ON public.credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_client_id ON public.credit_notes(client_id);
CREATE INDEX idx_credit_notes_organization_id ON public.credit_notes(organization_id);
CREATE INDEX idx_credit_note_lines_credit_note_id ON public.credit_note_lines(credit_note_id);