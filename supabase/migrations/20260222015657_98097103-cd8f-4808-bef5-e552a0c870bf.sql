-- Create dedicated supply_records table for the approvisionnement module
-- This is completely independent from purchase_documents

CREATE TABLE public.supply_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  supplier_name text NOT NULL,
  supplier_type text NOT NULL DEFAULT 'business_local',
  invoice_number text NULL,
  invoice_date date NULL,
  currency text NOT NULL DEFAULT 'TND',
  exchange_rate numeric NOT NULL DEFAULT 1,
  subtotal_ht numeric NOT NULL DEFAULT 0,
  total_vat numeric NOT NULL DEFAULT 0,
  total_discount numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  stamp_duty_amount numeric NOT NULL DEFAULT 0,
  net_payable numeric NOT NULL DEFAULT 0,
  pdf_url text NULL,
  pdf_hash text NULL,
  status text NOT NULL DEFAULT 'validated',
  payment_status text NOT NULL DEFAULT 'unpaid',
  paid_amount numeric NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create supply_lines table
CREATE TABLE public.supply_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_record_id uuid NOT NULL REFERENCES public.supply_records(id) ON DELETE CASCADE,
  product_id uuid NULL,
  reference text NULL,
  ean text NULL,
  name text NOT NULL,
  product_type text NOT NULL DEFAULT 'physical',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_ht numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  line_total_ht numeric NOT NULL DEFAULT 0,
  line_vat numeric NOT NULL DEFAULT 0,
  line_total_ttc numeric NOT NULL DEFAULT 0,
  is_new_product boolean NOT NULL DEFAULT false,
  is_existing_product boolean NOT NULL DEFAULT true,
  line_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supply_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for supply_records
CREATE POLICY "Users can view their supply records"
  ON public.supply_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = supply_records.organization_id
      AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can create supply records"
  ON public.supply_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = supply_records.organization_id
      AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their supply records"
  ON public.supply_records FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = supply_records.organization_id
      AND organizations.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their supply records"
  ON public.supply_records FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = supply_records.organization_id
      AND organizations.user_id = auth.uid()
  ));

-- RLS policies for supply_lines
CREATE POLICY "Users can view their supply lines"
  ON public.supply_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.supply_records sr
    JOIN public.organizations o ON o.id = sr.organization_id
    WHERE sr.id = supply_lines.supply_record_id
      AND o.user_id = auth.uid()
  ));

CREATE POLICY "Users can create supply lines"
  ON public.supply_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.supply_records sr
    JOIN public.organizations o ON o.id = sr.organization_id
    WHERE sr.id = supply_lines.supply_record_id
      AND o.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their supply lines"
  ON public.supply_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.supply_records sr
    JOIN public.organizations o ON o.id = sr.organization_id
    WHERE sr.id = supply_lines.supply_record_id
      AND o.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their supply lines"
  ON public.supply_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.supply_records sr
    JOIN public.organizations o ON o.id = sr.organization_id
    WHERE sr.id = supply_lines.supply_record_id
      AND o.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_supply_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_supply_records_updated_at
  BEFORE UPDATE ON public.supply_records
  FOR EACH ROW EXECUTE FUNCTION public.update_supply_records_updated_at();
