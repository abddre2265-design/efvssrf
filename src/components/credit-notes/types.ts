export type CreditNoteType = 'financial' | 'product_return';

// Updated statuses: 'created' = draft modifiable, 'validated' = locked
export type CreditNoteStatus = 'created' | 'draft' | 'validated' | 'cancelled';

// Product return reception status (for validated product returns)
export type ProductReturnReceptionStatus = 
  | 'blocked'             // Validated but products not received, invoice unchanged
  | 'partially_restored'  // Some products received, invoice partially updated
  | 'restored';           // All products received, invoice fully updated

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
  credit_refunded?: number; // Total amount refunded
  status: CreditNoteStatus;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Product return specific: tracks if invoice was updated
  invoice_updated?: boolean;
  // Tracks total quantity restored for partial restorations
  total_restored_quantity?: number;
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

// Helper function to get product return reception status
export const getProductReturnReceptionStatus = (creditNote: CreditNote): ProductReturnReceptionStatus => {
  if (creditNote.credit_note_type !== 'product_return') {
    return 'restored'; // Not applicable for financial
  }

  const hasBlocked = creditNote.credit_blocked > 0;
  const hasAvailable = creditNote.credit_available > 0;
  
  if (hasBlocked && !hasAvailable) {
    return 'blocked';
  }
  
  if (hasBlocked && hasAvailable) {
    return 'partially_restored';
  }
  
  return 'restored';
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
  // Track quantity restored for partial restorations
  quantity_restored: number;
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

// ========================================
// BUSINESS RULES - PRODUCT RETURN CREDIT NOTES
// ========================================

/**
 * RÈGLES MÉTIER - AVOIR DE PRODUITS
 * 
 * 1. ÉTATS POSSIBLES:
 *    - created: Brouillon modifiable, aucun impact
 *    - validated + blocked: Validé légalement mais produits non reçus, facture inchangée
 *    - validated + restored: Produits reçus, stock restauré, facture modifiée
 *    - validated + partially_restored: État intermédiaire
 * 
 * 2. IMPACT SUR LA FACTURE (lors de la restauration):
 *    - Si qté retournée = qté facturée → ligne supprimée
 *    - Si qté retournée < qté facturée → quantité diminuée
 *    - Recalcul: HT = Σ(lignes restantes), TVA = Σ(ligne par ligne), TTC = HT + TVA
 *    - Timbre fiscal: JAMAIS modifié
 * 
 * 3. RETENUE À LA SOURCE:
 *    - Si TTC < 1000 DT après recalcul → proposition 0% (confirmation utilisateur)
 *    - Facture non payée: taux modifiable librement
 *    - Facture partiellement payée: taux modifiable, reste à payer recalculé
 *    - Facture totalement payée: taux modifiable UNE SEULE FOIS après restauration
 * 
 * 4. CONVERSION VERS AVOIR FINANCIER:
 *    - Conditions: avoir produit validé + restauré + paiement existant + trop-perçu réel
 *    - Montant = TTC (hors timbre), plafonné au trop-perçu
 *    - Le timbre fiscal n'entre JAMAIS dans le calcul
 */

export interface InvoiceUpdateResult {
  success: boolean;
  newSubtotalHt: number;
  newTotalVat: number;
  newTotalTtc: number;
  newNetPayable: number;
  stampDuty: number; // Always unchanged
  withholdingAmount: number;
  withholdingRate: number;
  overpayment: number; // Excess paid amount after recalculation
  shouldProposeZeroWithholding: boolean; // If TTC < 1000 DT
  deletedLines: string[];
  updatedLines: { id: string; newQuantity: number }[];
}

// Calculate invoice updates when restoring product return credit note
export const calculateInvoiceUpdates = (
  currentInvoice: {
    subtotal_ht: number;
    total_vat: number;
    total_ttc: number;
    net_payable: number;
    stamp_duty_amount: number;
    stamp_duty_enabled: boolean;
    withholding_rate: number;
    withholding_amount: number;
    paid_amount: number;
  },
  invoiceLines: {
    id: string;
    product_id: string;
    quantity: number;
    unit_price_ht: number;
    vat_rate: number;
    discount_percent: number;
  }[],
  restoredLines: {
    invoice_line_id: string;
    quantity: number;
  }[]
): InvoiceUpdateResult => {
  const deletedLines: string[] = [];
  const updatedLines: { id: string; newQuantity: number }[] = [];
  
  let newSubtotalHt = 0;
  let newTotalVat = 0;
  
  // Process each invoice line
  for (const line of invoiceLines) {
    const restored = restoredLines.find(r => r.invoice_line_id === line.id);
    const restoredQty = restored?.quantity || 0;
    const remainingQty = line.quantity - restoredQty;
    
    if (remainingQty <= 0) {
      // Line should be deleted
      deletedLines.push(line.id);
    } else if (restoredQty > 0) {
      // Line should be updated with new quantity
      updatedLines.push({ id: line.id, newQuantity: remainingQty });
      
      // Calculate new line totals
      const unitPriceAfterDiscount = line.unit_price_ht * (1 - line.discount_percent / 100);
      const lineHt = unitPriceAfterDiscount * remainingQty;
      const lineVat = lineHt * (line.vat_rate / 100);
      
      newSubtotalHt += lineHt;
      newTotalVat += lineVat;
    } else {
      // Line unchanged
      const unitPriceAfterDiscount = line.unit_price_ht * (1 - line.discount_percent / 100);
      const lineHt = unitPriceAfterDiscount * line.quantity;
      const lineVat = lineHt * (line.vat_rate / 100);
      
      newSubtotalHt += lineHt;
      newTotalVat += lineVat;
    }
  }
  
  const newTotalTtc = newSubtotalHt + newTotalVat;
  
  // Stamp duty is NEVER modified
  const stampDuty = currentInvoice.stamp_duty_enabled ? currentInvoice.stamp_duty_amount : 0;
  
  // Withholding tax is calculated on TTC (without stamp duty)
  const withholdingRate = currentInvoice.withholding_rate;
  const withholdingAmount = newTotalTtc * (withholdingRate / 100);
  
  // Net payable = (TTC - Withholding) + Stamp
  const newNetPayable = (newTotalTtc - withholdingAmount) + stampDuty;
  
  // Calculate overpayment
  const overpayment = Math.max(0, currentInvoice.paid_amount - newNetPayable);
  
  // Propose 0% withholding if TTC < 1000 DT
  const shouldProposeZeroWithholding = newTotalTtc < 1000 && withholdingRate > 0;
  
  return {
    success: true,
    newSubtotalHt,
    newTotalVat,
    newTotalTtc,
    newNetPayable,
    stampDuty,
    withholdingAmount,
    withholdingRate,
    overpayment,
    shouldProposeZeroWithholding,
    deletedLines,
    updatedLines,
  };
};
