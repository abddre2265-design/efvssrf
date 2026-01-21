-- Create client account movements table for tracking credits/debits
CREATE TABLE public.client_account_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('credit', 'debit')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  balance_after NUMERIC NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL, -- 'direct_deposit', 'invoice_payment', 'refund'
  source_id UUID, -- reference to payment_id or invoice_id if applicable
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for client lookups
CREATE INDEX idx_client_account_movements_client_id ON public.client_account_movements(client_id);
CREATE INDEX idx_client_account_movements_organization_id ON public.client_account_movements(organization_id);
CREATE INDEX idx_client_account_movements_movement_date ON public.client_account_movements(movement_date DESC);

-- Enable RLS
ALTER TABLE public.client_account_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization client movements"
ON public.client_account_movements
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = client_account_movements.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can create client movements for their organization"
ON public.client_account_movements
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = client_account_movements.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can update their organization client movements"
ON public.client_account_movements
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = client_account_movements.organization_id
  AND organizations.user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization client movements"
ON public.client_account_movements
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM organizations
  WHERE organizations.id = client_account_movements.organization_id
  AND organizations.user_id = auth.uid()
));

-- Add account_balance column to clients for quick balance lookup
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS account_balance NUMERIC NOT NULL DEFAULT 0;

-- Create function to get client balance (recalculated from movements)
CREATE OR REPLACE FUNCTION public.get_client_balance(p_client_id uuid)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT balance_after FROM client_account_movements 
     WHERE client_id = p_client_id 
     ORDER BY created_at DESC 
     LIMIT 1),
    0
  )
$$;

-- Create function to update client balance after movement
CREATE OR REPLACE FUNCTION public.update_client_balance_after_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients 
  SET account_balance = NEW.balance_after
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

-- Create trigger to update client balance
CREATE TRIGGER update_client_balance_trigger
AFTER INSERT ON public.client_account_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_client_balance_after_movement();