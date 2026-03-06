-- Fix quantity columns to support decimal values (NUMERIC) instead of INTEGER
-- This prevents "invalid input syntax for type integer" errors when processing documents with decimal quantities

-- 1. purchase_lines
ALTER TABLE public.purchase_lines 
ALTER COLUMN quantity TYPE NUMERIC;

-- 2. invoice_lines
ALTER TABLE public.invoice_lines 
ALTER COLUMN quantity TYPE NUMERIC;

-- 3. product_reservations
ALTER TABLE public.product_reservations 
ALTER COLUMN quantity TYPE NUMERIC;

-- 4. quote_request_items
ALTER TABLE public.quote_request_items 
ALTER COLUMN quantity TYPE NUMERIC;

-- 5. products (stock columns)
ALTER TABLE public.products 
ALTER COLUMN current_stock TYPE NUMERIC,
ALTER COLUMN reserved_stock TYPE NUMERIC;

-- 6. stock_movements
ALTER TABLE public.stock_movements 
ALTER COLUMN quantity TYPE NUMERIC,
ALTER COLUMN previous_stock TYPE NUMERIC,
ALTER COLUMN new_stock TYPE NUMERIC;
