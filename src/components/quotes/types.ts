export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'invoiced';

export interface Quote {
  id: string;
  organization_id: string;
  client_id: string | null;
  quote_request_id: string | null;
  quote_number: string;
  quote_prefix: string;
  quote_year: number;
  quote_counter: number;
  quote_date: string;
  validity_date: string | null;
  client_type: string;
  currency: string;
  exchange_rate: number;
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  total_ttc: number;
  stamp_duty_enabled: boolean;
  stamp_duty_amount: number;
  net_payable: number;
  status: QuoteStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  client?: {
    id: string;
    client_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  product_id: string;
  description: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  line_order: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    reference: string | null;
  };
}

export const QUOTE_PREFIXES = {
  fr: 'DEV',
  en: 'QUO',
  ar: 'عرض',
} as const;

export const generateQuoteNumber = (prefix: string, year: number, counter: number): string => {
  return `${prefix}-${year}-${String(counter).padStart(5, '0')}`;
};
