export interface QuoteRequest {
  id: string;
  organization_id: string;
  request_number: string;
  request_date: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  
  client_id?: string;
  client_type: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  identifier_type?: string;
  identifier_value?: string;
  country?: string;
  governorate?: string;
  address?: string;
  postal_code?: string;
  phone_prefix?: string;
  phone?: string;
  whatsapp_prefix?: string;
  whatsapp?: string;
  email?: string;
  
  ai_conversation_summary?: string;
  ai_extracted_needs?: string;
  notes?: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  items?: QuoteRequestItem[];
  messages?: QuoteRequestMessage[];
}

export interface QuoteRequestItem {
  id: string;
  quote_request_id: string;
  item_order: number;
  description: string;
  quantity?: number;
  notes?: string;
  created_at: string;
}

export interface QuoteRequestMessage {
  id: string;
  quote_request_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface QuoteRequestLink {
  id: string;
  organization_id: string;
  access_token: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ExtractedItem {
  description: string;
  quantity?: number;
  notes?: string;
}

export interface ConfirmedRequest {
  items: ExtractedItem[];
  summary: string;
}
