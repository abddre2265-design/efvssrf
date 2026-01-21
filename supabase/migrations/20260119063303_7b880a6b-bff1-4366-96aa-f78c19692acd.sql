-- Create enum for supplier types
CREATE TYPE supplier_type AS ENUM ('individual_local', 'business_local', 'foreign');

-- Create enum for supplier status
CREATE TYPE supplier_status AS ENUM ('active', 'archived');

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_type supplier_type NOT NULL,
  
  -- Name fields
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  
  -- Identification (optional for foreign suppliers)
  identifier_type TEXT,
  identifier_value TEXT,
  
  -- Address
  country TEXT NOT NULL DEFAULT 'Tunisie',
  governorate TEXT,
  address TEXT,
  postal_code TEXT,
  
  -- Contact
  phone_prefix TEXT,
  phone TEXT,
  whatsapp_prefix TEXT,
  whatsapp TEXT,
  email TEXT,
  
  -- Status and timestamps
  status supplier_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints for names
  CONSTRAINT suppliers_name_check CHECK (
    (supplier_type = 'individual_local' AND first_name IS NOT NULL AND last_name IS NOT NULL) OR
    (supplier_type = 'business_local' AND company_name IS NOT NULL) OR
    (supplier_type = 'foreign' AND (company_name IS NOT NULL OR (first_name IS NOT NULL AND last_name IS NOT NULL)))
  ),
  -- Governorate required for local suppliers
  CONSTRAINT suppliers_governorate_check CHECK (
    (supplier_type IN ('individual_local', 'business_local') AND governorate IS NOT NULL) OR
    (supplier_type = 'foreign')
  ),
  -- Identifier required for local suppliers only
  CONSTRAINT suppliers_identifier_check CHECK (
    (supplier_type IN ('individual_local', 'business_local') AND identifier_type IS NOT NULL AND identifier_value IS NOT NULL) OR
    (supplier_type = 'foreign')
  )
);

-- Create unique index for identifier per organization (only when identifier_value is not null)
CREATE UNIQUE INDEX suppliers_org_identifier_unique ON public.suppliers(organization_id, identifier_value) WHERE identifier_value IS NOT NULL;

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization suppliers"
ON public.suppliers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = suppliers.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create suppliers for their organization"
ON public.suppliers FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = suppliers.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their organization suppliers"
ON public.suppliers FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = suppliers.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization suppliers"
ON public.suppliers FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = suppliers.organization_id
  AND organizations.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();