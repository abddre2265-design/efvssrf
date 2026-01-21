// Types for the supply/provisioning workflow

export interface UploadedFile {
  file: File;
  url: string | null;
  storagePath: string | null;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

// VAT Breakdown by rate
export interface VATBreakdown {
  rate: number;
  base_ht: number;
  vat_amount: number;
}

// Extracted product from PDF
export interface ExtractedProduct {
  name: string;
  reference: string | null;
  ean: string | null;
  quantity: number;
  unit_price_ht: number;
  unit_price_ttc: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_total_ttc: number;
  line_vat: number;
  product_type: 'physical' | 'service';
  unit: string;
  max_discount: number;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean;
  purchase_year: number;
  // Matching with existing products
  is_existing?: boolean;
  existing_product_id?: string;
  use_existing?: boolean;
}

// Extracted supplier from PDF
export interface ExtractedSupplier {
  name: string;
  identifier_type: string | null;
  identifier_value: string | null;
  address: string | null;
  phone: string | null;
  phone_prefix: string | null;
  email: string | null;
  country: string;
  governorate: string | null;
  postal_code: string | null;
  whatsapp: string | null;
  whatsapp_prefix: string | null;
  supplier_type: 'individual_local' | 'business_local' | 'foreign';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  // Matching with existing suppliers
  is_existing?: boolean;
  existing_supplier_id?: string;
  match_confidence?: number | null;
  match_reason?: string | null;
}

// Extracted totals from PDF
export interface ExtractedTotals {
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  ht_after_discount: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_payable: number;
  currency: string;
  vat_breakdown: VATBreakdown[];
}

// Full extraction result from edge function
export interface ExtractionResult {
  invoice_number: string | null;
  invoice_date: string | null;
  supplier: ExtractedSupplier | null;
  products: ExtractedProduct[];
  totals: ExtractedTotals;
  is_duplicate: boolean;
  duplicate_reason: string | null;
}

// Analysis state
export type AnalysisStatus = 'idle' | 'analyzing' | 'success' | 'error' | 'duplicate';
