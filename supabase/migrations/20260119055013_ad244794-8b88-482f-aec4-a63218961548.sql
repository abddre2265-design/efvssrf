-- Create enum for product type
CREATE TYPE public.product_type AS ENUM ('physical', 'service');

-- Create enum for product status
CREATE TYPE public.product_status AS ENUM ('active', 'archived');

-- Create enum for stock movement type
CREATE TYPE public.stock_movement_type AS ENUM ('add', 'remove');

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference TEXT,
  ean TEXT,
  name TEXT NOT NULL,
  product_type product_type NOT NULL,
  vat_rate NUMERIC(5,2) NOT NULL CHECK (vat_rate IN (0, 7, 13, 19)),
  price_ht NUMERIC(12,3) NOT NULL CHECK (price_ht >= 0),
  price_ttc NUMERIC(12,3) NOT NULL CHECK (price_ttc >= 0),
  unit TEXT,
  purchase_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  max_discount NUMERIC(5,2) CHECK (max_discount >= 0 AND max_discount <= 100),
  unlimited_stock BOOLEAN NOT NULL DEFAULT false,
  allow_out_of_stock_sale BOOLEAN DEFAULT false,
  current_stock INTEGER DEFAULT 0 CHECK (current_stock >= 0 OR unlimited_stock = true),
  status product_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock movements table for history
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason_category TEXT NOT NULL,
  reason_detail TEXT NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Create function to check product ownership
CREATE OR REPLACE FUNCTION public.is_product_owner(product_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organizations o ON p.organization_id = o.id
    WHERE p.id = product_id AND o.user_id = auth.uid()
  )
$$;

-- RLS policies for products
CREATE POLICY "Users can view their organization products"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create products for their organization"
ON public.products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their organization products"
ON public.products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their organization products"
ON public.products
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND user_id = auth.uid()
  )
);

-- RLS policies for stock movements
CREATE POLICY "Users can view their product stock movements"
ON public.stock_movements
FOR SELECT
USING (is_product_owner(product_id));

CREATE POLICY "Users can create stock movements for their products"
ON public.stock_movements
FOR INSERT
WITH CHECK (is_product_owner(product_id));

-- Triggers for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate reference if empty
CREATE OR REPLACE FUNCTION public.generate_product_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'PRD-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_product_reference_trigger
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.generate_product_reference();