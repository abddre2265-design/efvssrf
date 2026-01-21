-- Add reserved_stock column to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;

-- Create product_reservations table
CREATE TABLE public.product_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  expiration_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'converted')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_reservations
CREATE POLICY "Users can view their organization reservations" 
ON public.product_reservations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM organizations 
  WHERE organizations.id = product_reservations.organization_id 
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create reservations for their organization" 
ON public.product_reservations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations 
  WHERE organizations.id = product_reservations.organization_id 
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their organization reservations" 
ON public.product_reservations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM organizations 
  WHERE organizations.id = product_reservations.organization_id 
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization reservations" 
ON public.product_reservations 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM organizations 
  WHERE organizations.id = product_reservations.organization_id 
  AND organizations.user_id = auth.uid()
));

-- Create helper function to check reservation ownership
CREATE OR REPLACE FUNCTION public.is_reservation_owner(reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_reservations pr
    JOIN public.organizations o ON pr.organization_id = o.id
    WHERE pr.id = reservation_id AND o.user_id = auth.uid()
  )
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_product_reservations_updated_at
BEFORE UPDATE ON public.product_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();