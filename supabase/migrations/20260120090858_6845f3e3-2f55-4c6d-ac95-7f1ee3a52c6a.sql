-- Create supplier credit notes table
CREATE TABLE public.supplier_credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  purchase_document_id UUID NOT NULL REFERENCES public.purchase_documents(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  credit_note_number TEXT NOT NULL,
  credit_note_prefix TEXT NOT NULL,
  credit_note_year INTEGER NOT NULL,
  credit_note_counter INTEGER NOT NULL,
  credit_note_type TEXT NOT NULL CHECK (credit_note_type IN ('financial', 'product_return')),
  credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  subtotal_ht NUMERIC NOT NULL DEFAULT 0,
  total_vat NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  stamp_duty_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  credit_generated NUMERIC NOT NULL DEFAULT 0,
  credit_used NUMERIC NOT NULL DEFAULT 0,
  credit_available NUMERIC NOT NULL DEFAULT 0,
  credit_blocked NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'cancelled')),
  currency TEXT NOT NULL DEFAULT 'TND',
  exchange_rate NUMERIC NOT NULL DEFAULT 1.0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier credit note lines table
CREATE TABLE public.supplier_credit_note_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_credit_note_id UUID NOT NULL REFERENCES public.supplier_credit_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  purchase_line_id UUID REFERENCES public.purchase_lines(id),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price_ht NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  line_total_ht NUMERIC NOT NULL DEFAULT 0,
  line_vat NUMERIC NOT NULL DEFAULT 0,
  line_total_ttc NUMERIC NOT NULL DEFAULT 0,
  return_reason TEXT,
  stock_deducted BOOLEAN NOT NULL DEFAULT false,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_supplier_credit_notes_org ON public.supplier_credit_notes(organization_id);
CREATE INDEX idx_supplier_credit_notes_supplier ON public.supplier_credit_notes(supplier_id);
CREATE INDEX idx_supplier_credit_notes_purchase ON public.supplier_credit_notes(purchase_document_id);
CREATE INDEX idx_supplier_credit_note_lines_note ON public.supplier_credit_note_lines(supplier_credit_note_id);

-- Add total_credited column to purchase_documents
ALTER TABLE public.purchase_documents 
ADD COLUMN IF NOT EXISTS total_credited NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_note_count INTEGER NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE public.supplier_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credit_note_lines ENABLE ROW LEVEL SECURITY;

-- Create helper function
CREATE OR REPLACE FUNCTION public.is_supplier_credit_note_owner(scn_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.supplier_credit_notes scn
    JOIN public.organizations o ON o.id = scn.organization_id
    WHERE scn.id = scn_id AND o.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS policies for supplier_credit_notes
CREATE POLICY "Users can view their organization supplier credit notes"
ON public.supplier_credit_notes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = supplier_credit_notes.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create supplier credit notes for their organization"
ON public.supplier_credit_notes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = supplier_credit_notes.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their organization supplier credit notes"
ON public.supplier_credit_notes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = supplier_credit_notes.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization supplier credit notes"
ON public.supplier_credit_notes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = supplier_credit_notes.organization_id
  AND organizations.user_id = auth.uid()
));

-- RLS policies for supplier_credit_note_lines
CREATE POLICY "Users can view their supplier credit note lines"
ON public.supplier_credit_note_lines FOR SELECT
USING (is_supplier_credit_note_owner(supplier_credit_note_id));

CREATE POLICY "Users can create supplier credit note lines"
ON public.supplier_credit_note_lines FOR INSERT
WITH CHECK (is_supplier_credit_note_owner(supplier_credit_note_id));

CREATE POLICY "Users can update their supplier credit note lines"
ON public.supplier_credit_note_lines FOR UPDATE
USING (is_supplier_credit_note_owner(supplier_credit_note_id));

CREATE POLICY "Users can delete their supplier credit note lines"
ON public.supplier_credit_note_lines FOR DELETE
USING (is_supplier_credit_note_owner(supplier_credit_note_id));

-- Trigger for updated_at
CREATE TRIGGER update_supplier_credit_notes_updated_at
BEFORE UPDATE ON public.supplier_credit_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();