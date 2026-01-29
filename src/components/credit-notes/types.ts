export type CreditNoteType = 'financial' | 'product_return';
export type CreditNoteStatus = 'draft' | 'validated' | 'cancelled';
export type CreditNoteReceptionStatus = 'blocked' | 'partially_unblocked' | 'restored';

// Financial credit note usage status (calculated from credit_used vs credit_generated)
export type CreditNoteUsageStatus = 
  | 'available'           // credit_used = 0
  | 'partially_used'      // 0 < credit_used < credit_generated
  | 'fully_used'          // credit_used = credit_generated
  | 'partially_refunded'  // Has some refunds but not all
  | 'refunded';           // Fully refunded

export interface CreditNote {
  id: string;
  organization_id: string;
  invoice_id: string;
  client_id: string;
  credit_note_number: string;
  credit_note_prefix: string;
  credit_note_year: number;
  credit_note_counter: number;
  credit_note_type: CreditNoteType;
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
  credit_refunded?: number; // Optional: total amount refunded (may not exist in older records)
  status: CreditNoteStatus;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Helper function to calculate usage status for financial credit notes
export const getCreditNoteUsageStatus = (creditNote: CreditNote): CreditNoteUsageStatus => {
  if (creditNote.credit_note_type !== 'financial') {
    return 'available'; // Not applicable for product returns
  }
  
  const refunded = creditNote.credit_refunded || 0;
  const used = creditNote.credit_used || 0;
  const generated = creditNote.credit_generated || 0;
  
  if (refunded >= generated && generated > 0) {
    return 'refunded';
  }
  
  if (refunded > 0) {
    return 'partially_refunded';
  }
  
  if (used >= generated && generated > 0) {
    return 'fully_used';
  }
  
  if (used > 0) {
    return 'partially_used';
  }
  
  return 'available';
};

export interface CreditNoteLine {
  id: string;
  credit_note_id: string;
  product_id: string | null;
  invoice_line_id: string | null;
  description: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  return_reason: string | null;
  stock_restored: boolean;
  line_order: number;
  created_at: string;
}

export interface InvoiceLineForCredit {
  id: string;
  product_id: string;
  product: {
    id: string;
    name: string;
    reference: string | null;
    product_type: string;
  } | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  description: string | null;
  // For tracking how much has already been credited
  credited_quantity?: number;
}

export interface CreditNoteLineInput {
  invoice_line_id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  return_reason?: string;
}

export const RETURN_REASONS = [
  'defective',
  'wrong_product',
  'customer_changed_mind',
  'damaged_in_transit',
  'quality_issue',
  'other_reason'
] as const;

export type ReturnReason = typeof RETURN_REASONS[number];
