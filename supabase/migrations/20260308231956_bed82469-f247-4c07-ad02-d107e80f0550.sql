ALTER TABLE public.organizations
  ADD COLUMN default_withholding_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN withholding_min_amount numeric NOT NULL DEFAULT 0;