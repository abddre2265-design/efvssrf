-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_type TEXT NOT NULL CHECK (org_type IN ('legal', 'individual')),
  name TEXT NOT NULL,
  identifier TEXT,
  identifier_type TEXT CHECK (identifier_type IN ('taxId', 'cin', 'passport')),
  identifier_locked BOOLEAN NOT NULL DEFAULT false,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  governorate TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create organization_banks table
CREATE TABLE public.organization_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_name TEXT,
  iban TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_banks ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user owns organization
CREATE OR REPLACE FUNCTION public.is_organization_owner(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id AND user_id = auth.uid()
  )
$$;

-- Helper function: Check if user already has an organization
CREATE OR REPLACE FUNCTION public.has_organization()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE user_id = auth.uid()
  )
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create one organization"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND NOT public.has_organization());

CREATE POLICY "Users can update their own organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own organization"
ON public.organizations FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for organization_banks
CREATE POLICY "Users can view their organization banks"
ON public.organization_banks FOR SELECT
TO authenticated
USING (public.is_organization_owner(organization_id));

CREATE POLICY "Users can add banks to their organization"
ON public.organization_banks FOR INSERT
TO authenticated
WITH CHECK (public.is_organization_owner(organization_id));

CREATE POLICY "Users can update their organization banks"
ON public.organization_banks FOR UPDATE
TO authenticated
USING (public.is_organization_owner(organization_id));

CREATE POLICY "Users can delete their organization banks"
ON public.organization_banks FOR DELETE
TO authenticated
USING (public.is_organization_owner(organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_banks_updated_at
BEFORE UPDATE ON public.organization_banks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('organization-logos', 'organization-logos', true);

-- Storage policies for logos
CREATE POLICY "Users can view their organization logo"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'organization-logos');

CREATE POLICY "Users can upload their organization logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their organization logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their organization logo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'organization-logos' AND (storage.foldername(name))[1] = auth.uid()::text);