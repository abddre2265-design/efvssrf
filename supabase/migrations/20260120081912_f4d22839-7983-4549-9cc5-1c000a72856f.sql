-- Create purchase_payments table for tracking payments to suppliers
CREATE TABLE public.purchase_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_document_id UUID NOT NULL REFERENCES public.purchase_documents(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  withholding_rate NUMERIC NOT NULL DEFAULT 0,
  withholding_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

-- Create function to check purchase payment ownership
CREATE OR REPLACE FUNCTION public.is_purchase_payment_owner(payment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM purchase_payments pp
    JOIN purchase_documents pd ON pd.id = pp.purchase_document_id
    JOIN organizations o ON o.id = pd.organization_id
    WHERE pp.id = payment_id AND o.user_id = auth.uid()
  );
END;
$$;

-- RLS Policies for purchase_payments
CREATE POLICY "Users can view their own purchase payments"
  ON public.purchase_payments FOR SELECT
  USING (is_purchase_payment_owner(id));

CREATE POLICY "Users can insert purchase payments for their documents"
  ON public.purchase_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_documents pd
      JOIN organizations o ON o.id = pd.organization_id
      WHERE pd.id = purchase_document_id AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own purchase payments"
  ON public.purchase_payments FOR UPDATE
  USING (is_purchase_payment_owner(id));

CREATE POLICY "Users can delete their own purchase payments"
  ON public.purchase_payments FOR DELETE
  USING (is_purchase_payment_owner(id));

-- Trigger for updated_at
CREATE TRIGGER update_purchase_payments_updated_at
  BEFORE UPDATE ON public.purchase_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add withholding columns to purchase_documents if not exist
ALTER TABLE public.purchase_documents 
  ADD COLUMN IF NOT EXISTS withholding_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholding_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholding_applied BOOLEAN NOT NULL DEFAULT false;