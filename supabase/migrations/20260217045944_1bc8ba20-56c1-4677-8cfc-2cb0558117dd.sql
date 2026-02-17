
-- Drop old tables if they exist (from previous implementation)
DROP TABLE IF EXISTS public.credit_note_lines CASCADE;
DROP TABLE IF EXISTS public.credit_notes CASCADE;

-- Create credit_notes table
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  credit_note_number TEXT NOT NULL,
  credit_note_prefix TEXT NOT NULL DEFAULT 'AV',
  credit_note_year INTEGER NOT NULL,
  credit_note_counter INTEGER NOT NULL,
  credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  credit_note_type TEXT NOT NULL DEFAULT 'commercial_price',
  credit_note_method TEXT NOT NULL DEFAULT 'lines',
  subtotal_ht NUMERIC NOT NULL DEFAULT 0,
  total_vat NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  stamp_duty_amount NUMERIC NOT NULL DEFAULT 0,
  withholding_rate NUMERIC NOT NULL DEFAULT 0,
  withholding_amount NUMERIC NOT NULL DEFAULT 0,
  original_net_payable NUMERIC NOT NULL DEFAULT 0,
  new_net_payable NUMERIC NOT NULL DEFAULT 0,
  financial_credit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create credit_note_lines table
CREATE TABLE public.credit_note_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  invoice_line_id UUID NOT NULL REFERENCES public.invoice_lines(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT,
  product_reference TEXT,
  original_quantity NUMERIC NOT NULL DEFAULT 0,
  original_unit_price_ht NUMERIC NOT NULL DEFAULT 0,
  original_line_total_ht NUMERIC NOT NULL DEFAULT 0,
  original_line_vat NUMERIC NOT NULL DEFAULT 0,
  original_line_total_ttc NUMERIC NOT NULL DEFAULT 0,
  discount_ht NUMERIC NOT NULL DEFAULT 0,
  discount_ttc NUMERIC NOT NULL DEFAULT 0,
  discount_rate NUMERIC NOT NULL DEFAULT 0,
  new_line_total_ht NUMERIC NOT NULL DEFAULT 0,
  new_line_vat NUMERIC NOT NULL DEFAULT 0,
  new_line_total_ttc NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 0,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_notes (using EXISTS pattern for INSERT...RETURNING compatibility)
CREATE POLICY "Users can view their own credit notes"
ON public.credit_notes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own credit notes"
ON public.credit_notes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.user_id = auth.uid()
));

CREATE POLICY "Users can update their own credit notes"
ON public.credit_notes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own credit notes"
ON public.credit_notes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.user_id = auth.uid()
));

-- RLS policies for credit_note_lines
CREATE POLICY "Users can view their own credit note lines"
ON public.credit_note_lines FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.credit_notes cn
  JOIN public.organizations o ON o.id = cn.organization_id
  WHERE cn.id = credit_note_id AND o.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own credit note lines"
ON public.credit_note_lines FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.credit_notes cn
  JOIN public.organizations o ON o.id = cn.organization_id
  WHERE cn.id = credit_note_id AND o.user_id = auth.uid()
));

CREATE POLICY "Users can update their own credit note lines"
ON public.credit_note_lines FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.credit_notes cn
  JOIN public.organizations o ON o.id = cn.organization_id
  WHERE cn.id = credit_note_id AND o.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own credit note lines"
ON public.credit_note_lines FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.credit_notes cn
  JOIN public.organizations o ON o.id = cn.organization_id
  WHERE cn.id = credit_note_id AND o.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_credit_notes_updated_at
BEFORE UPDATE ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
