-- Fix the ambiguous column reference in generate_payment_request_number function
CREATE OR REPLACE FUNCTION public.generate_payment_request_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year integer;
  next_counter integer;
  new_request_number text;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::integer;
  
  -- Get the max counter for this year, using table alias to avoid ambiguity
  SELECT COALESCE(MAX(
    CASE 
      WHEN ppr.request_number ~ '^DEM-[0-9]{4}-[0-9]+$' 
      THEN SUBSTRING(ppr.request_number FROM 'DEM-[0-9]{4}-([0-9]+)$')::integer 
      ELSE 0 
    END
  ), 0) + 1
  INTO next_counter
  FROM purchase_payment_requests ppr
  WHERE ppr.organization_id = org_id
    AND ppr.request_number LIKE 'DEM-' || current_year || '-%';
  
  new_request_number := 'DEM-' || current_year || '-' || LPAD(next_counter::text, 5, '0');
  
  RETURN new_request_number;
END;
$$;