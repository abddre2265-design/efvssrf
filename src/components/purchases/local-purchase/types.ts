// Types for the local purchase processing workflow from pending uploads
import { ExtractedProduct, ExtractedSupplier, ExtractedTotals } from '../supply/types';

export type LocalPurchaseWorkflowStep = 
  | 'transfer' 
  | 'supplier' 
  | 'products' 
  | 'product_details' 
  | 'totals' 
  | 'family' 
  | 'complete';

export interface LocalPurchaseWorkflowData {
  // Source data
  pendingUploadId: string;
  storagePath: string;
  originalFilename: string;
  pdfUrl: string | null;
  pdfHash: string | null;
  
  // Extracted data
  extractedSupplier: ExtractedSupplier | null;
  extractedProducts: ExtractedProduct[];
  extractedTotals: ExtractedTotals;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  
  // Confirmed data
  supplierId: string | null;
  supplierType: 'individual_local' | 'business_local' | 'foreign' | null;
  supplierName: string | null;
  currency: string;
  exchangeRate: number;
  productDetails: any[];
  verifiedProducts: any[];
  
  // Totals
  subtotalHt: number;
  totalVat: number;
  totalDiscount: number;
  totalTtc: number;
  stampDutyAmount: number;
  netPayable: number;
  
  // Family assignment
  documentFamilyId: string | null;
  documentFamilyName: string | null;
  
  // Final creation mode
  creationMode: 'without_supply' | 'with_supply' | null;
  purchaseDocumentId: string | null;
}

export interface PendingUploadForProcessing {
  id: string;
  organization_id: string;
  original_filename: string;
  storage_path: string;
  supplier_detected: string | null;
  document_number: string | null;
  document_date: string | null;
  new_filename: string | null;
  status: string;
  analysis_data: any;
  created_at: string;
  document_type: string | null;
  import_folder_id: string | null;
  document_category: string | null;
}
