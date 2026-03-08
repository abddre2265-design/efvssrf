
-- Purchase Orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  currency TEXT NOT NULL DEFAULT 'TND',
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  subtotal_ht NUMERIC NOT NULL DEFAULT 0,
  total_vat NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Order Lines table
CREATE TABLE public.purchase_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  reference TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price_ht NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  line_total_ht NUMERIC NOT NULL DEFAULT 0,
  line_vat NUMERIC NOT NULL DEFAULT 0,
  line_total_ttc NUMERIC NOT NULL DEFAULT 0,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their purchase orders" ON public.purchase_orders FOR SELECT USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_orders.organization_id AND organizations.user_id = auth.uid()));
CREATE POLICY "Users can create purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_orders.organization_id AND organizations.user_id = auth.uid()));
CREATE POLICY "Users can update their purchase orders" ON public.purchase_orders FOR UPDATE USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_orders.organization_id AND organizations.user_id = auth.uid()));
CREATE POLICY "Users can delete their purchase orders" ON public.purchase_orders FOR DELETE USING (EXISTS (SELECT 1 FROM organizations WHERE organizations.id = purchase_orders.organization_id AND organizations.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.is_purchase_order_owner(po_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM purchase_orders po JOIN organizations o ON o.id = po.organization_id WHERE po.id = po_id AND o.user_id = auth.uid());
$$;

CREATE POLICY "Users can view their purchase order lines" ON public.purchase_order_lines FOR SELECT USING (is_purchase_order_owner(purchase_order_id));
CREATE POLICY "Users can create purchase order lines" ON public.purchase_order_lines FOR INSERT WITH CHECK (is_purchase_order_owner(purchase_order_id));
CREATE POLICY "Users can update their purchase order lines" ON public.purchase_order_lines FOR UPDATE USING (is_purchase_order_owner(purchase_order_id));
CREATE POLICY "Users can delete their purchase order lines" ON public.purchase_order_lines FOR DELETE USING (is_purchase_order_owner(purchase_order_id));
