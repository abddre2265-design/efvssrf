
CREATE OR REPLACE FUNCTION public.get_organization_public_info(org_id uuid)
RETURNS TABLE (name text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.name, o.logo_url
  FROM public.organizations o
  WHERE o.id = org_id
  LIMIT 1;
$$;
