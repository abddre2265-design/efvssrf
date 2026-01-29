-- Create purchase_payment_requests table for tracking payment requests between internal app and public link
CREATE TABLE public.purchase_payment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  purchase_document_id UUID NOT NULL REFERENCES public.purchase_documents(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Request details
  requested_amount NUMERIC(15,3) NOT NULL,
  withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  withholding_amount NUMERIC(15,3) NOT NULL DEFAULT 0,
  net_requested_amount NUMERIC(15,3) NOT NULL,
  
  -- Payment response from public (filled by external user)
  paid_amount NUMERIC(15,3),
  payment_method TEXT,
  payment_methods JSONB, -- For mixed payments
  reference_number TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  payment_notes TEXT,
  
  -- Status management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_approval', 'approved', 'rejected', 'cancelled')),
  rejection_reason TEXT,
  
  -- Approval tracking
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure request number is unique per organization
  UNIQUE(organization_id, request_number)
);

-- Enable RLS
ALTER TABLE public.purchase_payment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies using explicit EXISTS checks
CREATE POLICY "Users can view their organization payment requests"
ON public.purchase_payment_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = purchase_payment_requests.organization_id
    AND organizations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create payment requests for their organization"
ON public.purchase_payment_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = purchase_payment_requests.organization_id
    AND organizations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their organization payment requests"
ON public.purchase_payment_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = purchase_payment_requests.organization_id
    AND organizations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their organization payment requests"
ON public.purchase_payment_requests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = purchase_payment_requests.organization_id
    AND organizations.user_id = auth.uid()
  )
);

-- Public access for the public upload link to view and update requests
CREATE POLICY "Public can view pending payment requests via token"
ON public.purchase_payment_requests
FOR SELECT
USING (status IN ('pending', 'awaiting_approval', 'approved', 'rejected'));

CREATE POLICY "Public can update pending payment requests"
ON public.purchase_payment_requests
FOR UPDATE
USING (status = 'pending');

-- Create index for faster lookups
CREATE INDEX idx_purchase_payment_requests_org ON public.purchase_payment_requests(organization_id);
CREATE INDEX idx_purchase_payment_requests_doc ON public.purchase_payment_requests(purchase_document_id);
CREATE INDEX idx_purchase_payment_requests_status ON public.purchase_payment_requests(status);

-- Create function to auto-generate request number
CREATE OR REPLACE FUNCTION public.generate_payment_request_number(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  next_counter INTEGER;
  request_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN request_number ~ ('^DEM-' || current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(request_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_counter
  FROM public.purchase_payment_requests
  WHERE organization_id = org_id;
  
  request_number := 'DEM-' || current_year || '-' || LPAD(next_counter::TEXT, 5, '0');
  
  RETURN request_number;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_purchase_payment_requests_updated_at
BEFORE UPDATE ON public.purchase_payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();