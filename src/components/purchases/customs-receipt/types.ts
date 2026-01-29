// Types for customs receipt workflow

export type CustomsReceiptWorkflowStep = 'extraction' | 'validation' | 'complete';

export interface CustomsReceiptData {
  quittanceType: string;
  customsOffice: string;
  documentNumber: string;
  documentDate: string;
  totalAmount: number;
  customsDeclarationNumber: string;
  importerName: string;
  notes?: string;
}

export interface CustomsReceiptWorkflowData {
  pendingUploadId: string;
  storagePath: string;
  originalFilename: string;
  pdfUrl: string | null;
  
  // Import folder info
  importFolderId: string;
  importFolderNumber: string;
  
  // Extracted/validated data
  extractedData: CustomsReceiptData | null;
  validatedData: CustomsReceiptData | null;
  
  // Result
  customsReceiptId: string | null;
}

export interface PendingUploadForCustomsReceipt {
  id: string;
  organization_id: string;
  original_filename: string;
  storage_path: string;
  status: string;
  document_type: string | null;
  document_category: string | null;
  import_folder_id: string | null;
  import_folder_number?: string | null;
  quittance_type: string | null;
  customs_office: string | null;
  document_number: string | null;
  document_date: string | null;
  total_amount: number | null;
  customs_declaration_number: string | null;
  importer_name: string | null;
}

export const QUITTANCE_TYPES = [
  { value: 'droits_taxes_importation', labelFr: 'Droits et taxes (importation)', labelEn: 'Import duties and taxes' },
  { value: 'regularisation', labelFr: 'Régularisation', labelEn: 'Regularization' },
  { value: 'penalite_amende', labelFr: 'Pénalité / Amende', labelEn: 'Penalty / Fine' },
  { value: 'consignation_garantie', labelFr: 'Consignation / Garantie', labelEn: 'Deposit / Guarantee' },
  { value: 'autre', labelFr: 'Autre quittance', labelEn: 'Other receipt' },
];
