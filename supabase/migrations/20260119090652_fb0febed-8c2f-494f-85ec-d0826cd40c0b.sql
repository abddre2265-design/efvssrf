-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
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
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their invoice payments"
ON public.payments
FOR SELECT
USING (is_invoice_owner(invoice_id));

CREATE POLICY "Users can create payments for their invoices"
ON public.payments
FOR INSERT
WITH CHECK (is_invoice_owner(invoice_id));

CREATE POLICY "Users can update their invoice payments"
ON public.payments
FOR UPDATE
USING (is_invoice_owner(invoice_id));

CREATE POLICY "Users can delete their invoice payments"
ON public.payments
FOR DELETE
USING (is_invoice_owner(invoice_id));

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add paid_amount column to invoices for tracking
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;