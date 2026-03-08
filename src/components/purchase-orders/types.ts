export interface PurchaseOrder {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  order_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  currency: string;
  exchange_rate: number;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  notes: string | null;
  status: PurchaseOrderStatus;
  created_at: string;
  updated_at: string;
  // Joined
  supplier?: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  name: string;
  reference: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  line_order: number;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'cancelled';

export interface PurchaseOrderFormData {
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  currency: string;
  notes: string;
  lines: PurchaseOrderLineForm[];
}

export interface PurchaseOrderLineForm {
  productId: string;
  name: string;
  reference: string;
  quantity: number;
  unitPriceHt: number;
  vatRate: number;
  discountPercent: number;
}
