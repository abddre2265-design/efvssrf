export interface ProductReservation {
  id: string;
  organization_id: string;
  product_id: string;
  client_id: string;
  quantity: number;
  expiration_date: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'converted';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    client_type: string;
  };
  product?: {
    id: string;
    name: string;
    reference: string | null;
  };
}

export interface ReservationFormData {
  client_id: string;
  quantity: number;
  expiration_date: Date | null;
  notes: string;
}
