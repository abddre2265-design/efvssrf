export interface DeliveryNote {
  id: string;
  organization_id: string;
  invoice_id: string;
  client_id: string;
  delivery_note_number: string;
  delivery_note_prefix: string;
  delivery_note_year: number;
  delivery_note_counter: number;
  delivery_date: string;
  currency: string;
  exchange_rate: number;
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  total_ttc: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: {
    id: string;
    client_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
  invoice?: {
    id: string;
    invoice_number: string;
  };
}

export interface DeliveryNoteLine {
  id: string;
  delivery_note_id: string;
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
  // Joined data
  product?: {
    id: string;
    name: string;
    reference: string | null;
    ean: string | null;
  };
}

// Delivery note prefixes by language
export const DELIVERY_NOTE_PREFIXES = {
  fr: 'BL',
  en: 'DN',
  ar: 'بل',
} as const;

// Generate delivery note number
export const generateDeliveryNoteNumber = (prefix: string, year: number, counter: number): string => {
  return `${prefix}-${year}-${String(counter).padStart(5, '0')}`;
};
