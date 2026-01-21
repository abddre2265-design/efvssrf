-- Create stores table for point of sale management
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  governorate TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Tunisie',
  phone TEXT,
  email TEXT,
  google_maps_link TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their organization stores"
ON public.stores
FOR SELECT
USING (organization_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users can create stores for their organization"
ON public.stores
FOR INSERT
WITH CHECK (organization_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their organization stores"
ON public.stores
FOR UPDATE
USING (organization_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their organization stores"
ON public.stores
FOR DELETE
USING (organization_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_stores_organization_id ON public.stores(organization_id);
CREATE INDEX idx_stores_is_active ON public.stores(is_active);