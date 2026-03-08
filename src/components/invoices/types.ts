export type InvoiceStatus = 'created' | 'draft' | 'validated';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type DeliveryStatus = 'pending' | 'delivered';

export interface Invoice {
  id: string;
  organization_id: string;
  client_id: string;
  invoice_number: string;
  invoice_prefix: string;
  invoice_year: number;
  invoice_counter: number;
  invoice_date: string;
  due_date: string | null;
  client_type: string;
  currency: string;
  exchange_rate: number;
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  total_ttc: number;
  stamp_duty_enabled: boolean;
  stamp_duty_amount: number;
  net_payable: number;
  paid_amount: number;
  withholding_rate: number;
  withholding_amount: number;
  withholding_applied: boolean;
  total_credited: number;
  credit_note_count: number;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: {
    id: string;
    client_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  };
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  product_id: string;
  description: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  line_order: number;
  created_at: string;
  // Joined data
  product?: {
    id: string;
    name: string;
    reference: string | null;
    ean: string | null;
    price_ht: number;
    vat_rate: number;
    max_discount: number | null;
    current_stock: number | null;
    unlimited_stock: boolean;
    allow_out_of_stock_sale: boolean | null;
  };
}

export interface InvoiceLineFormData {
  id?: string;
  product_id: string;
  product_name: string;
  product_reference: string | null;
  description: string;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  max_discount: number;
  current_stock: number | null;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean;
  // Reservation tracking - when line comes from a reservation
  fromReservation?: boolean;
  reservationId?: string;
  reservationQuantity?: number; // Original reserved quantity - locked
  reserved_stock?: number; // Product's total reserved stock
}

export interface StockBubble {
  product_id: string;
  product_name: string;
  original_stock: number | null;
  quantity_used: number;
  remaining_stock: number | null;
  unlimited_stock: boolean;
}

// Common currencies
export const CURRENCIES = [
  { code: 'TND', name: { fr: 'Dinar Tunisien', en: 'Tunisian Dinar', ar: 'الدينار التونسي' }, symbol: { fr: 'DT', en: 'TND', ar: 'د.ت' } },
  { code: 'EUR', name: { fr: 'Euro', en: 'Euro', ar: 'اليورو' }, symbol: { fr: '€', en: '€', ar: '€' } },
  { code: 'USD', name: { fr: 'Dollar US', en: 'US Dollar', ar: 'الدولار الأمريكي' }, symbol: { fr: '$', en: '$', ar: '$' } },
  { code: 'GBP', name: { fr: 'Livre Sterling', en: 'Pound Sterling', ar: 'الجنيه الإسترليني' }, symbol: { fr: '£', en: '£', ar: '£' } },
  { code: 'CAD', name: { fr: 'Dollar Canadien', en: 'Canadian Dollar', ar: 'الدولار الكندي' }, symbol: { fr: 'CA$', en: 'CA$', ar: 'CA$' } },
  { code: 'CHF', name: { fr: 'Franc Suisse', en: 'Swiss Franc', ar: 'الفرنك السويسري' }, symbol: { fr: 'CHF', en: 'CHF', ar: 'فر.س' } },
  { code: 'AED', name: { fr: 'Dirham Emirats', en: 'UAE Dirham', ar: 'الدرهم الإماراتي' }, symbol: { fr: 'AED', en: 'AED', ar: 'د.إ' } },
  { code: 'SAR', name: { fr: 'Riyal Saoudien', en: 'Saudi Riyal', ar: 'الريال السعودي' }, symbol: { fr: 'SAR', en: 'SAR', ar: 'ر.س' } },
  { code: 'QAR', name: { fr: 'Riyal Qatari', en: 'Qatari Riyal', ar: 'الريال القطري' }, symbol: { fr: 'QAR', en: 'QAR', ar: 'ر.ق' } },
  { code: 'MAD', name: { fr: 'Dirham Marocain', en: 'Moroccan Dirham', ar: 'الدرهم المغربي' }, symbol: { fr: 'MAD', en: 'MAD', ar: 'د.م' } },
  { code: 'DZD', name: { fr: 'Dinar Algérien', en: 'Algerian Dinar', ar: 'الدينار الجزائري' }, symbol: { fr: 'DZD', en: 'DZD', ar: 'د.ج' } },
  { code: 'LYD', name: { fr: 'Dinar Libyen', en: 'Libyan Dinar', ar: 'الدينار الليبي' }, symbol: { fr: 'LYD', en: 'LYD', ar: 'ل.د' } },
  { code: 'EGP', name: { fr: 'Livre Égyptienne', en: 'Egyptian Pound', ar: 'الجنيه المصري' }, symbol: { fr: 'EGP', en: 'EGP', ar: 'ج.م' } },
  { code: 'TRY', name: { fr: 'Livre Turque', en: 'Turkish Lira', ar: 'الليرة التركية' }, symbol: { fr: '₺', en: '₺', ar: '₺' } },
  { code: 'CNY', name: { fr: 'Yuan Chinois', en: 'Chinese Yuan', ar: 'اليوان الصيني' }, symbol: { fr: '¥', en: '¥', ar: '¥' } },
  { code: 'JPY', name: { fr: 'Yen Japonais', en: 'Japanese Yen', ar: 'الين الياباني' }, symbol: { fr: '¥', en: '¥', ar: '¥' } },
];

// Helper to get currency name by language
export const getCurrencyName = (currency: typeof CURRENCIES[number], language: string = 'fr'): string => {
  return currency.name[language as keyof typeof currency.name] || currency.name.fr;
};

// Helper to get currency symbol by language
export const getCurrencySymbol = (currency: typeof CURRENCIES[number], language: string = 'fr'): string => {
  return currency.symbol[language as keyof typeof currency.symbol] || currency.symbol.fr;
};

// Format currency (language-aware)
export const formatCurrency = (amount: number, currency: string = 'TND', language: string = 'fr'): string => {
  const currencyInfo = CURRENCIES.find(c => c.code === currency);
  const symbol = currencyInfo ? getCurrencySymbol(currencyInfo, language) : currency;
  return `${amount.toFixed(3)} ${symbol}`;
};

// Invoice number prefixes by language
export const INVOICE_PREFIXES = {
  fr: 'FAC',
  en: 'INV',
  ar: 'فاتورة',
} as const;

// VAT rates
export const VAT_RATES = [0, 7, 13, 19];

// Calculate line totals
export const calculateLineTotal = (
  quantity: number,
  unitPriceHt: number,
  vatRate: number,
  discountPercent: number,
  isForeign: boolean
): { lineHt: number; lineVat: number; lineTtc: number } => {
  const lineHt = quantity * unitPriceHt * (1 - discountPercent / 100);
  const lineVat = isForeign ? 0 : lineHt * (vatRate / 100);
  const lineTtc = lineHt + lineVat;
  return { lineHt, lineVat, lineTtc };
};

// Generate invoice number
export const generateInvoiceNumber = (prefix: string, year: number, counter: number): string => {
  return `${prefix}-${year}-${String(counter).padStart(5, '0')}`;
};
