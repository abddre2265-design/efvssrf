export interface Store {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  governorate: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  google_maps_link: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreFormData {
  name: string;
  address: string;
  city: string;
  governorate: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  google_maps_link: string;
}
