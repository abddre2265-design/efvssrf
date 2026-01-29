// Types for other import document workflow

export type OtherImportDocumentStep = 'family_selection' | 'complete';

export interface OtherImportDocumentData {
  documentCategory: string;
  documentFamilyId: string | null;
  notes?: string;
}

export interface OtherImportDocumentWorkflowData {
  pendingUploadId: string;
  storagePath: string;
  originalFilename: string;
  pdfUrl: string | null;
  
  // Import folder info
  importFolderId: string;
  importFolderNumber: string;
  
  // Selected data
  documentFamilyId: string | null;
  
  // Result
  documentId: string | null;
}
