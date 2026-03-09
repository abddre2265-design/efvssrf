
-- Purchase Credit Notes table (mirrors credit_notes for purchases)
CREATE TABLE public.purchase_credit_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  purchase_document_id uuid NOT NULL REFERENCES public.purchase_documents(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  credit_note_number text NOT NULL,
  credit_note_prefix text NOT NULL DEFAULT 'AVA',
  credit_note_year integer NOT NULL,
  credit_note_counter integer NOT NULL,
  credit_note_date date NOT NULL DEFAULT CURRENT_DATE,
  credit_note_type text NOT NULL DEFAULT 'commercial_price',
  credit_note_method text NOT NULL DEFAULT 'lines',
  subtotal_ht numeric NOT NULL DEFAULT 0,
  total_vat numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  stamp_duty_amount numeric NOT NULL DEFAULT 0,
  original_net_payable numeric NOT NULL DEFAULT 0,
  new_net_payable numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'created',
  reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Purchase Credit Note Lines table (mirrors credit_note_lines for purchases)
CREATE TABLE public.purchase_credit_note_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id uuid NOT NULL REFERENCES public.purchase_credit_notes(id),
  purchase_line_id uuid NOT NULL REFERENCES public.purchase_lines(id),
  product_id uuid REFERENCES public.products(id),
  product_name text,
  product_reference text,
  original_quantity numeric NOT NULL DEFAULT 0,
  original_unit_price_ht numeric NOT NULL DEFAULT 0,
  original_line_total_ht numeric NOT NULL DEFAULT 0,
  original_line_vat numeric NOT NULL DEFAULT 0,
  original_line_total_ttc numeric NOT NULL DEFAULT 0,
  returned_quantity numeric NOT NULL DEFAULT 0,
  validated_quantity numeric NOT NULL DEFAULT 0,
  discount_ht numeric NOT NULL DEFAULT 0,
  discount_ttc numeric NOT NULL DEFAULT 0,
  discount_rate numeric NOT NULL DEFAULT 0,
  new_line_total_ht numeric NOT NULL DEFAULT 0,
  new_line_vat numeric NOT NULL DEFAULT 0,
  new_line_total_ttc numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  line_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_credit_note_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_credit_notes
CREATE POLICY "Users can view their own purchase credit notes"
  ON public.purchase_credit_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organizations WHERE organizations.id = purchase_credit_notes.organization_id AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert purchase credit notes"
  ON public.purchase_credit_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM organizations WHERE organizations.id = purchase_credit_notes.organization_id AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own purchase credit notes"
  ON public.purchase_credit_notes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM organizations WHERE organizations.id = purchase_credit_notes.organization_id AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own purchase credit notes"
  ON public.purchase_credit_notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM organizations WHERE organizations.id = purchase_credit_notes.organization_id AND organizations.user_id = auth.uid()
  ));

-- Helper function for purchase credit note ownership
CREATE OR REPLACE FUNCTION public.is_purchase_credit_note_owner(pcn_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM purchase_credit_notes pcn
    JOIN organizations o ON o.id = pcn.organization_id
    WHERE pcn.id = pcn_id AND o.user_id = auth.uid()
  )
$$;

-- RLS policies for purchase_credit_note_lines
CREATE POLICY "Users can view their purchase credit note lines"
  ON public.purchase_credit_note_lines FOR SELECT
  USING (is_purchase_credit_note_owner(credit_note_id));

CREATE POLICY "Users can insert purchase credit note lines"
  ON public.purchase_credit_note_lines FOR INSERT
  WITH CHECK (is_purchase_credit_note_owner(credit_note_id));

CREATE POLICY "Users can update their purchase credit note lines"
  ON public.purchase_credit_note_lines FOR UPDATE
  USING (is_purchase_credit_note_owner(credit_note_id));

CREATE POLICY "Users can delete their purchase credit note lines"
  ON public.purchase_credit_note_lines FOR DELETE
  USING (is_purchase_credit_note_owner(credit_note_id));

-- Add total_credited column to purchase_documents
ALTER TABLE public.purchase_documents ADD COLUMN IF NOT EXISTS total_credited numeric NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_documents ADD COLUMN IF NOT EXISTS credit_note_count integer NOT NULL DEFAULT 0;
