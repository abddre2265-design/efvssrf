export interface VatRate {
  id: string;
  organization_id: string;
  rate: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WithholdingRate {
  id: string;
  organization_id: string;
  rate: number;
  name: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface StampDutySetting {
  id: string;
  organization_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface CustomTaxType {
  id: string;
  organization_id: string;
  name: string;
  application_type: 'add' | 'deduct';
  application_order: 'before_stamp' | 'after_stamp';
  applies_to_payment: boolean;
  value_type: 'fixed' | 'percentage';
  created_at: string;
  updated_at: string;
  values?: CustomTaxValue[];
}

export interface CustomTaxValue {
  id: string;
  tax_type_id: string;
  value: number;
  label: string | null;
  created_at: string;
  updated_at: string;
  in_use?: boolean;
}

// Default values that cannot be modified or deleted
export const DEFAULT_VAT_RATES = [0, 7, 13, 19];
export const DEFAULT_WITHHOLDING_RATES = [1.5, 3, 5, 10, 15, 25];
export const DEFAULT_STAMP_DUTY = 1.000;
