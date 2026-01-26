-- Add invoice_request_id to invoices table to link invoices with their source requests
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS invoice_request_id UUID REFERENCES public.invoice_requests(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_request_id ON public.invoices(invoice_request_id);

-- Add generated_invoice_id to invoice_requests to track which invoice was created
ALTER TABLE public.invoice_requests 
ADD COLUMN IF NOT EXISTS generated_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_requests_generated_invoice_id ON public.invoice_requests(generated_invoice_id);