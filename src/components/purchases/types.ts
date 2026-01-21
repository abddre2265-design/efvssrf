export type PurchaseStatus = 'pending' | 'validated' | 'cancelled';
export type PurchasePaymentStatus = 'unpaid' | 'partial' | 'paid';
export type ImportFolderStatus = 'open' | 'closed';

export interface DocumentFamily {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportFolder {
  id: string;
  organization_id: string;
  folder_number: string;
  folder_month: number;
  folder_year: number;
  country: string;
  status: ImportFolderStatus;
  created_at: string;
  updated_at: string;
}

export interface ImportFolderLog {
  id: string;
  import_folder_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface PurchaseDocument {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  import_folder_id: string | null;
  document_family_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string;
  exchange_rate: number;
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_payable: number;
  paid_amount: number;
  status: PurchaseStatus;
  payment_status: PurchasePaymentStatus;
  pdf_url: string | null;
  pdf_hash: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseLine {
  id: string;
  purchase_document_id: string;
  product_id: string | null;
  reference: string | null;
  ean: string | null;
  name: string;
  product_type: string;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  is_new_product: boolean;
  is_existing_product: boolean;
  line_order: number;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  organization_id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const CURRENCIES = [
  { code: 'TND', symbol: 'DT', name: 'Dinar Tunisien' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 3.1,
  EUR: 3.4,
  GBP: 3.9,
  CNY: 0.43,
  AED: 0.84,
};

export const COUNTRIES = [
  { code: 'TN', name: { fr: 'Tunisie', en: 'Tunisia', ar: 'تونس' } },
  { code: 'CN', name: { fr: 'Chine', en: 'China', ar: 'الصين' } },
  { code: 'TR', name: { fr: 'Turquie', en: 'Turkey', ar: 'تركيا' } },
  { code: 'FR', name: { fr: 'France', en: 'France', ar: 'فرنسا' } },
  { code: 'DE', name: { fr: 'Allemagne', en: 'Germany', ar: 'ألمانيا' } },
  { code: 'IT', name: { fr: 'Italie', en: 'Italy', ar: 'إيطاليا' } },
  { code: 'ES', name: { fr: 'Espagne', en: 'Spain', ar: 'إسبانيا' } },
  { code: 'US', name: { fr: 'États-Unis', en: 'United States', ar: 'الولايات المتحدة' } },
  { code: 'AE', name: { fr: 'Émirats Arabes Unis', en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' } },
  { code: 'SA', name: { fr: 'Arabie Saoudite', en: 'Saudi Arabia', ar: 'المملكة العربية السعودية' } },
  { code: 'EG', name: { fr: 'Égypte', en: 'Egypt', ar: 'مصر' } },
  { code: 'MA', name: { fr: 'Maroc', en: 'Morocco', ar: 'المغرب' } },
  { code: 'DZ', name: { fr: 'Algérie', en: 'Algeria', ar: 'الجزائر' } },
  { code: 'LY', name: { fr: 'Libye', en: 'Libya', ar: 'ليبيا' } },
];

export const MONTHS = [
  { value: 1, fr: 'Janvier', en: 'January', ar: 'يناير' },
  { value: 2, fr: 'Février', en: 'February', ar: 'فبراير' },
  { value: 3, fr: 'Mars', en: 'March', ar: 'مارس' },
  { value: 4, fr: 'Avril', en: 'April', ar: 'أبريل' },
  { value: 5, fr: 'Mai', en: 'May', ar: 'مايو' },
  { value: 6, fr: 'Juin', en: 'June', ar: 'يونيو' },
  { value: 7, fr: 'Juillet', en: 'July', ar: 'يوليو' },
  { value: 8, fr: 'Août', en: 'August', ar: 'أغسطس' },
  { value: 9, fr: 'Septembre', en: 'September', ar: 'سبتمبر' },
  { value: 10, fr: 'Octobre', en: 'October', ar: 'أكتوبر' },
  { value: 11, fr: 'Novembre', en: 'November', ar: 'نوفمبر' },
  { value: 12, fr: 'Décembre', en: 'December', ar: 'ديسمبر' },
];
