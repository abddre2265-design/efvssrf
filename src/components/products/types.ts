export interface Product {
  id: string;
  organization_id: string;
  reference: string | null;
  ean: string | null;
  name: string;
  product_type: 'physical' | 'service';
  vat_rate: number;
  price_ht: number;
  price_ttc: number;
  unit: string | null;
  purchase_year: number;
  max_discount: number | null;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean | null;
  current_stock: number | null;
  reserved_stock: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'add' | 'remove';
  quantity: number;
  reason_category: string;
  reason_detail: string;
  previous_stock: number;
  new_stock: number;
  created_at: string;
}

export interface ProductFormData {
  reference: string;
  ean: string;
  name: string;
  productType: 'physical' | 'service';
  vatRate: number | null;
  priceHt: string;
  priceTtc: string;
  unit: string;
  purchaseYear: number;
  maxDiscount: string;
  unlimitedStock: boolean;
  allowOutOfStockSale: boolean;
  currentStock: string;
}

export const UNITS = [
  'piece', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'm2', 'm3', 
  'hour', 'day', 'week', 'month', 'year', 'pack', 'box', 
  'pallet', 'roll', 'sheet', 'unit'
];

export const VAT_RATES = [0, 7, 13, 19];

export const STOCK_ADD_REASONS = {
  production: ['manufactured', 'assembly', 'transformation', 'reconditioning', 'repair', 'endCycle'],
  internalTransfer: ['otherWarehouse', 'storeReturn', 'rebalancing', 'stockMerge'],
  manualAdjustment: ['inventory', 'inputError', 'excelImport', 'audit'],
  otherEntries: ['supplierGift', 'bonus', 'samples', 'donation'],
  specialCases: ['foundProduct', 'exitCancellation', 'systemBug'],
  technical: ['supabaseSync', 'backupRestore', 'dataMigration']
};

export const STOCK_REMOVE_REASONS = {
  supplierReturns: ['defective', 'deliveryError', 'credit'],
  production: ['consumption', 'manufacturing', 'qualityTest'],
  transfers: ['toWarehouse', 'pointOfSale'],
  losses: ['breakage', 'theft', 'expiration', 'disaster'],
  commercial: ['clientGift', 'demo', 'test'],
  specialCases: ['bugCorrection', 'accountingAdjustment'],
  technical: ['wrongImport', 'migration']
};
