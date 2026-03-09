export interface PurchaseCreditNote {
  id: string;
  organization_id: string;
  purchase_document_id: string;
  supplier_id: string;
  credit_note_number: string;
  credit_note_prefix: string;
  credit_note_year: number;
  credit_note_counter: number;
  credit_note_date: string;
  credit_note_type: 'commercial_price' | 'product_return';
  credit_note_method: 'lines' | 'total';
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  stamp_duty_amount: number;
  original_net_payable: number;
  new_net_payable: number;
  status: 'created' | 'draft' | 'validated' | 'validated_partial';
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  supplier?: {
    id: string;
    supplier_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
  purchase_document?: {
    id: string;
    invoice_number: string | null;
  };
}

export interface PurchaseCreditNoteLine {
  id: string;
  credit_note_id: string;
  purchase_line_id: string;
  product_id: string | null;
  product_name: string | null;
  product_reference: string | null;
  original_quantity: number;
  original_unit_price_ht: number;
  original_line_total_ht: number;
  original_line_vat: number;
  original_line_total_ttc: number;
  returned_quantity: number;
  validated_quantity: number;
  discount_ht: number;
  discount_ttc: number;
  discount_rate: number;
  new_line_total_ht: number;
  new_line_vat: number;
  new_line_total_ttc: number;
  vat_rate: number;
  line_order: number;
  created_at: string;
}
