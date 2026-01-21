-- Create enum for client types
CREATE TYPE client_type AS ENUM ('individual_local', 'business_local', 'foreign');

-- Create enum for client status
CREATE TYPE client_status AS ENUM ('active', 'archived');

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_type client_type NOT NULL,
  
  -- Name fields
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  
  -- Identification
  identifier_type TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  
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
  status client_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT clients_name_check CHECK (
    (client_type = 'individual_local' AND first_name IS NOT NULL AND last_name IS NOT NULL) OR
    (client_type = 'business_local' AND company_name IS NOT NULL) OR
    (client_type = 'foreign' AND (company_name IS NOT NULL OR (first_name IS NOT NULL AND last_name IS NOT NULL)))
  ),
  CONSTRAINT clients_governorate_check CHECK (
    (client_type IN ('individual_local', 'business_local') AND governorate IS NOT NULL) OR
    (client_type = 'foreign')
  )
);

-- Create unique index for identifier per organization
CREATE UNIQUE INDEX clients_org_identifier_unique ON public.clients(organization_id, identifier_value);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization clients"
ON public.clients FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = clients.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create clients for their organization"
ON public.clients FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = clients.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their organization clients"
ON public.clients FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = clients.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization clients"
ON public.clients FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = clients.organization_id
  AND organizations.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();