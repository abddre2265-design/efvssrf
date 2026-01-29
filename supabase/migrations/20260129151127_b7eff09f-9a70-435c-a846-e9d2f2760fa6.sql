-- Create customs_receipts table for tracking validated customs receipts (quittances douanières)
CREATE TABLE public.customs_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_folder_id UUID NOT NULL REFERENCES public.import_folders(id) ON DELETE CASCADE,
  pending_upload_id UUID, -- Reference to the original pending upload (can be null if manually created)
  
  -- Document identification
  quittance_type TEXT NOT NULL DEFAULT 'droits_taxes_importation',
  customs_office TEXT,
  document_number TEXT,
  document_date DATE,
  
  -- Financial details
  total_amount NUMERIC(15,3) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15,3) NOT NULL DEFAULT 0,
  
  -- Declaration reference
  customs_declaration_number TEXT,
  importer_name TEXT,
  
  -- PDF reference
  pdf_url TEXT,
  storage_path TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'validated', -- validated, cancelled
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customs_receipts ENABLE ROW LEVEL SECURITY;

-- Create RLS helper function
CREATE OR REPLACE FUNCTION public.is_customs_receipt_owner(receipt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM customs_receipts cr
    JOIN organizations o ON o.id = cr.organization_id
    WHERE cr.id = receipt_id AND o.user_id = auth.uid()
  );
END;
$$;

-- RLS Policies
CREATE POLICY "Users can view their own customs receipts"
ON public.customs_receipts
FOR SELECT
USING (is_customs_receipt_owner(id));

CREATE POLICY "Users can create customs receipts in their organization"
ON public.customs_receipts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own customs receipts"
ON public.customs_receipts
FOR UPDATE
USING (is_customs_receipt_owner(id));

CREATE POLICY "Users can delete their own customs receipts"
ON public.customs_receipts
FOR DELETE
USING (is_customs_receipt_owner(id));

-- Create indexes
CREATE INDEX idx_customs_receipts_org ON public.customs_receipts(organization_id);
CREATE INDEX idx_customs_receipts_folder ON public.customs_receipts(import_folder_id);
CREATE INDEX idx_customs_receipts_status ON public.customs_receipts(status);
CREATE INDEX idx_customs_receipts_payment ON public.customs_receipts(payment_status);

-- Create trigger for updated_at
CREATE TRIGGER update_customs_receipts_updated_at
BEFORE UPDATE ON public.customs_receipts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create customs_receipt_payments table for tracking payments
CREATE TABLE public.customs_receipt_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customs_receipt_id UUID NOT NULL REFERENCES public.customs_receipts(id) ON DELETE CASCADE,
  amount NUMERIC(15,3) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'virement',
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for payments
ALTER TABLE public.customs_receipt_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view payments for their customs receipts"
ON public.customs_receipt_payments
FOR SELECT
USING (is_customs_receipt_owner(customs_receipt_id));

CREATE POLICY "Users can create payments for their customs receipts"
ON public.customs_receipt_payments
FOR INSERT
WITH CHECK (is_customs_receipt_owner(customs_receipt_id));

CREATE POLICY "Users can update payments for their customs receipts"
ON public.customs_receipt_payments
FOR UPDATE
USING (is_customs_receipt_owner(customs_receipt_id));

CREATE POLICY "Users can delete payments for their customs receipts"
ON public.customs_receipt_payments
FOR DELETE
USING (is_customs_receipt_owner(customs_receipt_id));

-- Create index
CREATE INDEX idx_customs_receipt_payments_receipt ON public.customs_receipt_payments(customs_receipt_id);

-- Create trigger for updated_at
CREATE TRIGGER update_customs_receipt_payments_updated_at
BEFORE UPDATE ON public.customs_receipt_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();