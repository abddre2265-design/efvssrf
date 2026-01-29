export type PaymentRequestStatus = 'pending' | 'awaiting_approval' | 'approved' | 'rejected' | 'cancelled';

export interface PurchasePaymentRequest {
  id: string;
  organization_id: string;
  purchase_document_id: string;
  request_number: string;
  request_date: string;
  
  // Request details
  requested_amount: number;
  withholding_rate: number;
  withholding_amount: number;
  net_requested_amount: number;
  
  // Payment response
  paid_amount: number | null;
  payment_method: string | null;
  payment_methods: PaymentMethodLine[] | null;
  reference_number: string | null;
  payment_date: string | null;
  payment_notes: string | null;
  
  // Status
  status: PaymentRequestStatus;
  rejection_reason: string | null;
  
  // Timestamps
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations (optional, for joins)
  purchase_document?: {
    id: string;
    invoice_number: string | null;
    invoice_date: string | null;
    net_payable: number;
    currency: string;
    supplier?: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      supplier_type: string;
    };
  };
}

export interface PaymentMethodLine {
  id: string;
  method: string;
  amount: number;
  referenceNumber: string;
}

export const PAYMENT_REQUEST_STATUSES = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  awaiting_approval: { label: 'En attente d\'approbation', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  approved: { label: 'Validé', color: 'bg-green-100 text-green-800 border-green-300' },
  rejected: { label: 'Refusé', color: 'bg-red-100 text-red-800 border-red-300' },
  cancelled: { label: 'Annulé', color: 'bg-gray-100 text-gray-800 border-gray-300' },
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces', requiresReference: false },
  { value: 'card', label: 'Carte', requiresReference: false },
  { value: 'check', label: 'Chèque', requiresReference: true },
  { value: 'draft', label: 'Traite', requiresReference: true },
  { value: 'iban_transfer', label: 'Virement IBAN', requiresReference: true },
  { value: 'swift_transfer', label: 'Virement SWIFT', requiresReference: true },
  { value: 'bank_deposit', label: 'Versement', requiresReference: true },
  { value: 'mixed', label: 'Mixte', requiresReference: false },
];
