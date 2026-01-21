export type SupplierCreditNoteType = 'financial' | 'product_return';
export type SupplierCreditNoteStatus = 'draft' | 'validated' | 'cancelled';

export interface SupplierCreditNote {
  id: string;
  organization_id: string;
  purchase_document_id: string;
  supplier_id: string;
  credit_note_number: string;
  credit_note_prefix: string;
  credit_note_year: number;
  credit_note_counter: number;
  credit_note_type: SupplierCreditNoteType;
  credit_note_date: string;
  reason: string | null;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_amount: number;
  credit_generated: number;
  credit_used: number;
  credit_available: number;
  credit_blocked: number;
  status: SupplierCreditNoteStatus;
  currency: string;
  exchange_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreditNoteLine {
  id: string;
  supplier_credit_note_id: string;
  product_id: string | null;
  purchase_line_id: string | null;
  description: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  return_reason: string | null;
  stock_deducted: boolean;
  line_order: number;
  created_at: string;
}

export interface PurchaseLineForCredit {
  id: string;
  product_id: string | null;
  product?: {
    id: string;
    name: string;
    reference: string | null;
    product_type: string;
  } | null;
  name: string;
  reference: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  credited_quantity?: number;
}

export interface SupplierCreditNoteLineInput {
  purchase_line_id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  return_reason?: string;
}

export const SUPPLIER_RETURN_REASONS = [
  'defective',
  'wrong_product',
  'damaged_in_transit',
  'quality_issue',
  'price_adjustment',
  'other_reason'
] as const;

export type SupplierReturnReason = typeof SUPPLIER_RETURN_REASONS[number];
