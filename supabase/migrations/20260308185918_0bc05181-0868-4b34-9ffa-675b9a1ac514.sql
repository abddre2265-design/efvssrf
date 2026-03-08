
ALTER TABLE public.purchase_orders ADD COLUMN order_prefix TEXT NOT NULL DEFAULT 'BC';
ALTER TABLE public.purchase_orders ADD COLUMN order_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::integer;
ALTER TABLE public.purchase_orders ADD COLUMN order_counter INTEGER NOT NULL DEFAULT 1;
