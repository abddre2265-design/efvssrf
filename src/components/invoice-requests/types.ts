export interface InvoiceRequest {
  id: string;
  organization_id: string;
  request_number: string;
  request_date: string;
  
  // Client info
  client_type: 'company' | 'individual' | 'individual_local' | 'business_local' | 'foreign';
  company_name?: string;
  first_name?: string;
  last_name?: string;
  identifier_type: string;
  identifier_value: string;
  email?: string;
  phone?: string;
  phone_prefix?: string;
  whatsapp?: string;
  whatsapp_prefix?: string;
  address?: string;
  governorate?: string;
  postal_code?: string;
  country?: string;
  
  // Transaction info
  purchase_date: string;
  store_id?: string;
  transaction_number: string;
  receipt_number?: string;
  order_number?: string;
  total_ttc: number;
  
  // Payment info
  payment_status: 'paid' | 'partial' | 'unpaid';
  paid_amount: number;
  payment_methods: PaymentMethod[];
  
  // Status
  status: 'pending' | 'processed' | 'rejected' | 'converted';
  
  // Linked client
  linked_client_id?: string;
  
  // Generated invoice
  generated_invoice_id?: string;
  
  // AI
  ai_conversation: AiMessage[];
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  store?: {
    id: string;
    name: string;
  };
}

export interface PaymentMethod {
  method: string;
  amount: number;
  reference?: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface InvoiceRequestLink {
  id: string;
  organization_id: string;
  access_token: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
