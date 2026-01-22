-- =====================================================
-- TAXES MANAGEMENT TABLES
-- =====================================================

-- 1. VAT Rates Table
CREATE TABLE public.vat_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, rate)
);

-- Enable RLS
ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vat_rates
CREATE POLICY "Users can view their organization's VAT rates"
ON public.vat_rates FOR SELECT
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert VAT rates for their organization"
ON public.vat_rates FOR INSERT
WITH CHECK (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update non-default VAT rates for their organization"
ON public.vat_rates FOR UPDATE
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
) AND is_default = false);

CREATE POLICY "Users can delete non-default VAT rates for their organization"
ON public.vat_rates FOR DELETE
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
) AND is_default = false);

-- 2. Withholding Tax Rates Table
CREATE TABLE public.withholding_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, rate)
);

-- Enable RLS
ALTER TABLE public.withholding_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for withholding_rates
CREATE POLICY "Users can view their organization's withholding rates"
ON public.withholding_rates FOR SELECT
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert withholding rates for their organization"
ON public.withholding_rates FOR INSERT
WITH CHECK (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update non-default withholding rates"
ON public.withholding_rates FOR UPDATE
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
) AND is_default = false);

CREATE POLICY "Users can delete non-default withholding rates"
ON public.withholding_rates FOR DELETE
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
) AND is_default = false);

-- 3. Stamp Duty Settings Table
CREATE TABLE public.stamp_duty_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL UNIQUE,
  amount NUMERIC(10,3) NOT NULL DEFAULT 1.000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stamp_duty_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stamp_duty_settings
CREATE POLICY "Users can view their organization's stamp duty"
ON public.stamp_duty_settings FOR SELECT
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert stamp duty for their organization"
ON public.stamp_duty_settings FOR INSERT
WITH CHECK (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update stamp duty for their organization"
ON public.stamp_duty_settings FOR UPDATE
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

-- 4. Custom Tax Types Table
CREATE TABLE public.custom_tax_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  application_type TEXT NOT NULL CHECK (application_type IN ('add', 'deduct')),
  application_order TEXT NOT NULL CHECK (application_order IN ('before_stamp', 'after_stamp')),
  applies_to_payment BOOLEAN NOT NULL DEFAULT false,
  value_type TEXT NOT NULL CHECK (value_type IN ('fixed', 'percentage')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_tax_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_tax_types
CREATE POLICY "Users can view their organization's custom tax types"
ON public.custom_tax_types FOR SELECT
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert custom tax types"
ON public.custom_tax_types FOR INSERT
WITH CHECK (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update custom tax types"
ON public.custom_tax_types FOR UPDATE
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete custom tax types"
ON public.custom_tax_types FOR DELETE
USING (organization_id IN (
  SELECT id FROM public.organizations WHERE user_id = auth.uid()
));

-- 5. Custom Tax Values Table
CREATE TABLE public.custom_tax_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_type_id UUID NOT NULL REFERENCES public.custom_tax_types(id) ON DELETE CASCADE,
  value NUMERIC(10,3) NOT NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_tax_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_tax_values
CREATE POLICY "Users can view custom tax values for their org"
ON public.custom_tax_values FOR SELECT
USING (tax_type_id IN (
  SELECT id FROM public.custom_tax_types WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert custom tax values"
ON public.custom_tax_values FOR INSERT
WITH CHECK (tax_type_id IN (
  SELECT id FROM public.custom_tax_types WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can update custom tax values"
ON public.custom_tax_values FOR UPDATE
USING (tax_type_id IN (
  SELECT id FROM public.custom_tax_types WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can delete custom tax values"
ON public.custom_tax_values FOR DELETE
USING (tax_type_id IN (
  SELECT id FROM public.custom_tax_types WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE user_id = auth.uid()
  )
));

-- 6. Invoice Custom Taxes (junction table for applied taxes)
CREATE TABLE public.invoice_custom_taxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_value_id UUID NOT NULL REFERENCES public.custom_tax_values(id),
  applied_value NUMERIC(10,3) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_custom_taxes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_custom_taxes
CREATE POLICY "Users can view their invoice custom taxes"
ON public.invoice_custom_taxes FOR SELECT
USING (invoice_id IN (
  SELECT id FROM public.invoices WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Users can insert invoice custom taxes"
ON public.invoice_custom_taxes FOR INSERT
WITH CHECK (invoice_id IN (
  SELECT id FROM public.invoices WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE user_id = auth.uid()
  )
));

-- Update timestamp trigger for all new tables
CREATE TRIGGER update_vat_rates_updated_at
BEFORE UPDATE ON public.vat_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withholding_rates_updated_at
BEFORE UPDATE ON public.withholding_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stamp_duty_settings_updated_at
BEFORE UPDATE ON public.stamp_duty_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_tax_types_updated_at
BEFORE UPDATE ON public.custom_tax_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_tax_values_updated_at
BEFORE UPDATE ON public.custom_tax_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if a VAT rate is in use by any product
CREATE OR REPLACE FUNCTION public.is_vat_rate_in_use(rate_value NUMERIC)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.products WHERE vat_rate = rate_value
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if a withholding rate is in use by any invoice
CREATE OR REPLACE FUNCTION public.is_withholding_rate_in_use(rate_value NUMERIC)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.invoices WHERE withholding_rate = rate_value AND withholding_applied = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if a custom tax value is in use
CREATE OR REPLACE FUNCTION public.is_custom_tax_value_in_use(value_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.invoice_custom_taxes WHERE tax_value_id = value_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;