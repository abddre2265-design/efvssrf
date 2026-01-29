import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Shield,
  Lock,
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  Check,
  X,
  Loader2,
  ExternalLink,
  Eye,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  Tags,
  ShoppingCart,
  Globe,
} from 'lucide-react';
import { PublicImportFoldersBlock, PublicPaymentRequestsBlock } from '@/components/purchases/payment-requests';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  prefixValid: boolean;
  status: 'pending' | 'analyzing' | 'analyzed' | 'validating' | 'valid' | 'duplicate' | 'error';
  supplier?: string;
  documentNumber?: string;
  documentDate?: string;
  newFilename?: string;
  previewUrl?: string;
  error?: string;
  fileHash?: string;
  duplicateReason?: 'hash' | 'metadata';
  // Customs receipt specific fields
  quittanceType?: string;
  customsOffice?: string;
  customsDeclarationNumber?: string;
  importerName?: string;
  totalAmount?: number;
  // "Autre" document specific fields
  autreDocumentType?: 'autre' | 'importation';
}

interface ImportFolder {
  id: string;
  folder_number: string;
  folder_month: number;
  folder_year: number;
  country: string;
  status: string;
}

type DocumentType = 'local' | 'import';
type DocumentCategory = 'facture_fournisseur_etranger' | 'facture_locale' | 'quittance_douaniere' | 'autre';

const DOCUMENT_CATEGORIES = [
  { value: 'facture_commerciale_etrangere', label: 'Facture commerciale étrangère', icon: Globe, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  { value: 'facture_locale', label: 'Facture locale', icon: ShoppingCart, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  { value: 'quittance_douaniere', label: 'Quittance douanière', icon: FileText, color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  { value: 'autre', label: 'Autre document', icon: Tags, color: 'bg-slate-500/10 text-slate-600 border-slate-200' },
];

// Types of customs receipts (quittances)
const QUITTANCE_TYPES = [
  { value: 'droits_taxes_importation', label: 'Quittance droits et taxes (importation)', color: 'bg-amber-500/10 text-amber-700 border-amber-300' },
  { value: 'regularisation', label: 'Quittance de régularisation', color: 'bg-blue-500/10 text-blue-700 border-blue-300' },
  { value: 'penalite_amende', label: 'Quittance de pénalité / amende', color: 'bg-red-500/10 text-red-700 border-red-300' },
  { value: 'consignation_garantie', label: 'Quittance de consignation / garantie', color: 'bg-cyan-500/10 text-cyan-700 border-cyan-300' },
  { value: 'autre', label: 'Autre quittance douanière', color: 'bg-slate-500/10 text-slate-600 border-slate-200' },
];

// Types of "Autre" documents for import folders
const AUTRE_DOCUMENT_TYPES = [
  { value: 'autre', label: 'Autre document', color: 'bg-slate-500/10 text-slate-600 border-slate-200' },
  { value: 'importation', label: 'Document d\'importation', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
];

const STEPS_LOCAL = [
  { id: 'type', label: 'Type', icon: Tags },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'prefix', label: 'Vérification', icon: FileText },
  { id: 'analyze', label: 'Analyse OCR', icon: Sparkles },
  { id: 'edit', label: 'Édition', icon: FileText },
  { id: 'validate', label: 'Validation', icon: CheckCircle2 },
  { id: 'transfer', label: 'Transfert', icon: Check },
];

const STEPS_IMPORT = [
  { id: 'type', label: 'Type', icon: Tags },
  { id: 'folder', label: 'Dossier', icon: FolderOpen },
  { id: 'category', label: 'Catégorie', icon: Tags },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'prefix', label: 'Vérification', icon: FileText },
  { id: 'analyze', label: 'Analyse OCR', icon: Sparkles },
  { id: 'edit', label: 'Édition', icon: FileText },
  { id: 'validate', label: 'Validation', icon: CheckCircle2 },
  { id: 'transfer', label: 'Transfert', icon: Check },
];

// Quittance specific steps - different from invoice workflow
const STEPS_QUITTANCE = [
  { id: 'type', label: 'Type', icon: Tags },
  { id: 'folder', label: 'Dossier', icon: FolderOpen },
  { id: 'category', label: 'Catégorie', icon: Tags },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'prefix', label: 'Vérification', icon: FileText },
  { id: 'analyze', label: 'Analyse OCR', icon: Sparkles },
  { id: 'edit', label: 'Édition', icon: FileText },
  { id: 'validate', label: 'Validation', icon: CheckCircle2 },
  { id: 'transfer', label: 'Transfert', icon: Check },
];

// "Autre" document specific steps - simplified, no OCR
const STEPS_AUTRE = [
  { id: 'type', label: 'Type', icon: Tags },
  { id: 'folder', label: 'Dossier', icon: FolderOpen },
  { id: 'category', label: 'Catégorie', icon: Tags },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'prefix', label: 'Vérification', icon: FileText },
  { id: 'edit', label: 'Saisie', icon: FileText },
  { id: 'validate', label: 'Validation', icon: CheckCircle2 },
  { id: 'transfer', label: 'Transfert', icon: Check },
];

const PublicUpload: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [linkData, setLinkData] = useState<any>(null);
  
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  
  // Document type and import context
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [selectedImportFolder, setSelectedImportFolder] = useState<string | null>(null);
  const [documentCategory, setDocumentCategory] = useState<DocumentCategory | null>(null);
  const [importFolders, setImportFolders] = useState<ImportFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Get the correct steps based on document type and category
  const getSteps = () => {
    if (documentType === 'import') {
      // Use quittance-specific steps for customs receipts
      if (documentCategory === 'quittance_douaniere') {
        return STEPS_QUITTANCE;
      }
      // Use simplified steps for "Autre" documents (no OCR)
      if (documentCategory === 'autre') {
        return STEPS_AUTRE;
      }
      return STEPS_IMPORT;
    }
    return STEPS_LOCAL;
  };

  const STEPS = getSteps();
  
  // Check if current workflow is for quittance
  const isQuittanceWorkflow = documentType === 'import' && documentCategory === 'quittance_douaniere';
  
  // Check if current workflow is for "Autre" documents
  const isAutreWorkflow = documentType === 'import' && documentCategory === 'autre';

  // Map step IDs to actual step numbers
  const getStepNumber = (stepId: string): number => {
    return STEPS.findIndex(s => s.id === stepId);
  };

  // Get the selected import folder details
  const getSelectedFolderDetails = (): ImportFolder | null => {
    if (!selectedImportFolder) return null;
    return importFolders.find(f => f.id === selectedImportFolder) || null;
  };

  // Verify token exists
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('public_upload_links')
          .select('*')
          .eq('access_token', token)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setIsVerifying(false);
          return;
        }

        setLinkData(data);
        setIsVerifying(false);
      } catch (error) {
        console.error('Error verifying token:', error);
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  // Load import folders when document type is selected
  useEffect(() => {
    const loadImportFolders = async () => {
      if (documentType !== 'import' || !linkData?.organization_id) return;
      
      setIsLoadingFolders(true);
      try {
        const { data, error } = await supabase
          .from('import_folders')
          .select('id, folder_number, folder_month, folder_year, country, status')
          .eq('organization_id', linkData.organization_id)
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setImportFolders(data || []);
      } catch (error) {
        console.error('Error loading import folders:', error);
        toast.error('Erreur lors du chargement des dossiers');
      } finally {
        setIsLoadingFolders(false);
      }
    };

    loadImportFolders();
  }, [documentType, linkData?.organization_id]);

  const verifyAccessCode = async () => {
    if (!accessCodeInput.trim() || !linkData) return;
    
    setIsCheckingCode(true);
    
    // Simple comparison (case-insensitive)
    if (accessCodeInput.toUpperCase() === linkData.access_code.toUpperCase()) {
      setIsAuthorized(true);
      toast.success('Accès autorisé');
    } else {
      toast.error('Code incorrect');
    }
    
    setIsCheckingCode(false);
  };

  // Calculate SHA-256 hash of a file
  const calculateFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const prefix = linkData?.file_prefix || '';
    
    // Create file entries with pending hash calculation
    const newFiles: UploadedFile[] = [];
    
    for (const file of Array.from(files)) {
      const fileHash = await calculateFileHash(file);
      newFiles.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        prefixValid: prefix ? file.name.toLowerCase().startsWith(prefix.toLowerCase()) : true,
        status: 'pending' as const,
        fileHash,
      });
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const allPrefixesValid = uploadedFiles.length > 0 && uploadedFiles.every(f => f.prefixValid);

  const analyzeDocuments = async () => {
    setIsAnalyzing(true);
    
    // Determine which endpoint to use based on document category
    const isQuittance = documentCategory === 'quittance_douaniere';
    const endpoint = isQuittance 
      ? 'https://uzrkeuweietxkwubhbym.supabase.co/functions/v1/analyze-customs-receipt'
      : 'https://uzrkeuweietxkwubhbym.supabase.co/functions/v1/analyze-public-upload';
    
    for (const file of uploadedFiles) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'analyzing' as const } : f
      ));

      try {
        // Create object URL for preview
        const previewUrl = URL.createObjectURL(file.file);
        
        // Call the OCR edge function
        const formData = new FormData();
        formData.append('file', file.file);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const result = await response.json();
        
        if (isQuittance) {
          // Handle quittance-specific OCR result
          const newFilename = `Douane Tunisie_Quittance_${result.documentNumber || 'N-A'}_${result.documentDate || 'N-A'}.pdf`;
          
          setUploadedFiles(prev => prev.map(f => 
            f.id === file.id ? {
              ...f,
              status: 'analyzed' as const,
              quittanceType: result.quittanceType || 'droits_taxes_importation',
              customsOffice: result.customsOffice || '',
              documentNumber: result.documentNumber || '',
              documentDate: result.documentDate || '',
              customsDeclarationNumber: result.customsDeclarationNumber || '',
              importerName: result.importerName || '',
              totalAmount: result.totalAmount || 0,
              newFilename,
              previewUrl,
            } : f
          ));
        } else {
          // Handle regular document OCR result
          setUploadedFiles(prev => prev.map(f => 
            f.id === file.id ? {
              ...f,
              status: 'analyzed' as const,
              supplier: result.supplier || '',
              documentNumber: result.documentNumber || '',
              documentDate: result.documentDate || '',
              newFilename: `${result.supplier || 'Unknown'}_${result.documentNumber || 'N/A'}_${result.documentDate || 'N/A'}.pdf`,
              previewUrl,
            } : f
          ));
        }
      } catch (error) {
        console.error('Error analyzing file:', error);
        
        if (isQuittance) {
          setUploadedFiles(prev => prev.map(f => 
            f.id === file.id ? {
              ...f,
              status: 'analyzed' as const,
              quittanceType: 'droits_taxes_importation',
              customsOffice: '',
              documentNumber: '',
              documentDate: '',
              customsDeclarationNumber: '',
              importerName: '',
              totalAmount: 0,
              newFilename: file.name,
              previewUrl: URL.createObjectURL(file.file),
            } : f
          ));
        } else {
          setUploadedFiles(prev => prev.map(f => 
            f.id === file.id ? {
              ...f,
              status: 'analyzed' as const,
              supplier: '',
              documentNumber: '',
              documentDate: '',
              newFilename: file.name,
              previewUrl: URL.createObjectURL(file.file),
            } : f
          ));
        }
      }
    }
    
    setIsAnalyzing(false);
    setCurrentStep(currentStep + 1);
  };

  const updateFileField = (id: string, field: string, value: string | number) => {
    setUploadedFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      
      const updated = { ...f, [field]: value };
      const folderDetails = getSelectedFolderDetails();
      
      // Recalculate new filename based on document type
      if (documentCategory === 'quittance_douaniere') {
        updated.newFilename = `Douane Tunisie_Quittance_${updated.documentNumber || 'N-A'}_${updated.documentDate || 'N-A'}.pdf`;
      } else if (documentCategory === 'autre') {
        // For "Autre" documents, generate a simple filename with folder number
        const docType = updated.autreDocumentType === 'importation' ? 'Import' : 'Autre';
        const timestamp = Date.now().toString().slice(-6);
        updated.newFilename = `${docType}_Dossier${folderDetails?.folder_number || 'N-A'}_${timestamp}.pdf`;
      } else {
        updated.newFilename = `${updated.supplier || 'Unknown'}_${updated.documentNumber || 'N/A'}_${updated.documentDate || 'N/A'}.pdf`;
      }
      
      return updated;
    }));
  };

  // Initialize "Autre" files with default values (skip OCR)
  const initializeAutreFiles = () => {
    const folderDetails = getSelectedFolderDetails();
    setUploadedFiles(prev => prev.map((f, index) => {
      const timestamp = Date.now().toString().slice(-6);
      return {
        ...f,
        status: 'analyzed' as const,
        autreDocumentType: 'autre' as const,
        newFilename: `Autre_Dossier${folderDetails?.folder_number || 'N-A'}_${timestamp}_${index + 1}.pdf`,
        previewUrl: URL.createObjectURL(f.file),
      };
    }));
    // Move to edit step
    setCurrentStep(getStepNumber('edit'));
  };

  const checkDuplicates = async () => {
    const isQuittance = documentCategory === 'quittance_douaniere';
    
    for (const file of uploadedFiles) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'validating' as const } : f
      ));

      try {
        let isDuplicate = false;
        let duplicateReason: 'hash' | 'metadata' | undefined;
        const docNumber = file.documentNumber?.trim() || '';
        const docDate = file.documentDate?.trim() || '';
        const supplier = file.supplier?.trim() || '';
        const customsOffice = file.customsOffice?.trim() || '';
        const fileHash = file.fileHash || '';

        // First, check for exact file duplicate by hash
        if (fileHash) {
          // Check in purchase_documents by hash
          const { data: hashDocs, error: hashError } = await supabase
            .from('purchase_documents')
            .select('id, pdf_hash')
            .eq('organization_id', linkData.organization_id)
            .eq('pdf_hash', fileHash)
            .limit(1);

          if (!hashError && hashDocs && hashDocs.length > 0) {
            isDuplicate = true;
            duplicateReason = 'hash';
          }

          // Check in pending_public_uploads by hash
          if (!isDuplicate) {
            const { data: pendingHashDocs, error: pendingHashError } = await supabase
              .from('pending_public_uploads')
              .select('id, file_hash')
              .eq('organization_id', linkData.organization_id)
              .eq('file_hash', fileHash)
              .limit(1);

            if (!pendingHashError && pendingHashDocs && pendingHashDocs.length > 0) {
              isDuplicate = true;
              duplicateReason = 'hash';
            }
          }
        }

        // If no hash duplicate, check by metadata
        if (!isDuplicate && docNumber) {
          if (isQuittance) {
            // For quittances: check by receipt number + customs office + date
            const { data: pendingQuittances, error: pendingError } = await supabase
              .from('pending_public_uploads')
              .select('id, document_number, document_date, customs_office')
              .eq('organization_id', linkData.organization_id)
              .eq('status', 'pending')
              .eq('document_category', 'quittance_douaniere')
              .ilike('document_number', docNumber);

            if (!pendingError && pendingQuittances && pendingQuittances.length > 0) {
              // Check if date AND customs office match
              if (pendingQuittances.some(doc => 
                doc.document_date === docDate && 
                doc.customs_office?.toLowerCase() === customsOffice.toLowerCase()
              )) {
                isDuplicate = true;
                duplicateReason = 'metadata';
              }
            }
          } else {
            // For regular documents: check by supplier + number + date
            // Check in purchase_documents for duplicates (number + date)
            const { data: existingDocs, error: docsError } = await supabase
              .from('purchase_documents')
              .select('id, invoice_number, invoice_date')
              .eq('organization_id', linkData.organization_id)
              .ilike('invoice_number', docNumber);

            if (!docsError && existingDocs && existingDocs.length > 0) {
              // Check if date also matches
              if (existingDocs.some(doc => doc.invoice_date === docDate)) {
                isDuplicate = true;
                duplicateReason = 'metadata';
              }
            }

            // Also check in pending_public_uploads
            if (!isDuplicate) {
              const { data: pendingDocs, error: pendingError } = await supabase
                .from('pending_public_uploads')
                .select('id, document_number, document_date, supplier_detected')
                .eq('organization_id', linkData.organization_id)
                .eq('status', 'pending')
                .ilike('document_number', docNumber);

              if (!pendingError && pendingDocs && pendingDocs.length > 0) {
                // Check if date and supplier also match
                if (pendingDocs.some(doc => 
                  doc.document_date === docDate && 
                  doc.supplier_detected?.toLowerCase() === supplier.toLowerCase()
                )) {
                  isDuplicate = true;
                  duplicateReason = 'metadata';
                }
              }
            }
          }
        }
        
        setUploadedFiles(prev => prev.map(f => 
          f.id === file.id ? {
            ...f,
            status: isDuplicate ? 'duplicate' as const : 'valid' as const,
            duplicateReason: isDuplicate ? duplicateReason : undefined,
          } : f
        ));
      } catch (error) {
        console.error('Error checking duplicates:', error);
        setUploadedFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'valid' as const } : f
        ));
      }
    }
    
    setCurrentStep(currentStep + 1);
  };

  const allFilesValid = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'valid');

  const transferDocuments = async () => {
    setIsTransferring(true);
    
    try {
      const folderDetails = getSelectedFolderDetails();
      const isQuittance = documentCategory === 'quittance_douaniere';
      const isAutre = documentCategory === 'autre';
      
      // Upload files to storage and create pending records
      for (const file of uploadedFiles.filter(f => f.status === 'valid')) {
        // Upload to storage
        const storagePath = `${linkData.organization_id}/${Date.now()}_${file.newFilename}`;
        
        const { error: uploadError } = await supabase.storage
          .from('public-uploads')
          .upload(storagePath, file.file);

        if (uploadError) throw uploadError;

        // Create pending upload record with hash and import info
        // Handle empty date strings - convert to null for database
        const documentDate = file.documentDate?.trim() || null;
        
        const insertData: any = {
          organization_id: linkData.organization_id,
          original_filename: file.name,
          storage_path: storagePath,
          supplier_detected: isQuittance ? (file.importerName || null) : (file.supplier || null),
          document_number: file.documentNumber || null,
          document_date: documentDate,
          new_filename: file.newFilename || null,
          file_hash: file.fileHash || null,
          status: 'pending',
          document_type: documentType || 'local',
          import_folder_id: documentType === 'import' ? selectedImportFolder : null,
          document_category: documentType === 'import' ? documentCategory : null,
        };
        
        // Add quittance-specific fields
        if (isQuittance) {
          insertData.quittance_type = file.quittanceType;
          insertData.customs_office = file.customsOffice;
          insertData.customs_declaration_number = file.customsDeclarationNumber;
          insertData.importer_name = file.importerName;
          insertData.total_amount = file.totalAmount;
        }
        
        insertData.analysis_data = {
          supplier: isQuittance ? file.importerName : file.supplier,
          documentNumber: file.documentNumber,
          documentDate: file.documentDate,
          fileHash: file.fileHash,
          documentType: documentType,
          importFolderId: documentType === 'import' ? selectedImportFolder : null,
          importFolderNumber: folderDetails?.folder_number || null,
          documentCategory: documentType === 'import' ? documentCategory : null,
          ...(isQuittance && {
            quittanceType: file.quittanceType,
            customsOffice: file.customsOffice,
            customsDeclarationNumber: file.customsDeclarationNumber,
            importerName: file.importerName,
            totalAmount: file.totalAmount,
          }),
          ...(isAutre && {
            autreDocumentType: file.autreDocumentType,
          }),
        };

        const { error: insertError } = await supabase
          .from('pending_public_uploads')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      toast.success('Documents transférés avec succès!');
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Error transferring:', error);
      toast.error('Erreur lors du transfert');
    } finally {
      setIsTransferring(false);
    }
  };

  const resetWorkflow = () => {
    setUploadedFiles([]);
    setDocumentType(null);
    setSelectedImportFolder(null);
    setDocumentCategory(null);
    setCurrentStep(0);
  };

  // Get category label
  const getCategoryLabel = (category: DocumentCategory | null) => {
    if (!category) return '';
    return DOCUMENT_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Invalid token
  if (!linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Lien invalide ou expiré</CardTitle>
            <CardDescription>
              Ce lien d'upload n'existe pas ou n'est plus actif.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Access code verification
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Accès sécurisé</CardTitle>
              <CardDescription>
                Entrez le code d'accès pour continuer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Code d'accès</Label>
                <Input
                  type="text"
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="font-mono text-center text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && verifyAccessCode()}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={verifyAccessCode}
                disabled={isCheckingCode || !accessCodeInput.trim()}
              >
                {isCheckingCode ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Vérifier
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Main upload interface
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Upload de documents</h1>
        </div>

        {/* New Blocks: Import Folders and Payment Requests */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PublicImportFoldersBlock organizationId={linkData?.organization_id} />
          <PublicPaymentRequestsBlock organizationId={linkData?.organization_id} />
        </div>
          {documentType === 'import' && selectedImportFolder && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-200">
                <Globe className="h-3 w-3 mr-1" />
                Importation
              </Badge>
              <Badge variant="outline">
                <FolderOpen className="h-3 w-3 mr-1" />
                Dossier #{getSelectedFolderDetails()?.folder_number}
              </Badge>
              {documentCategory && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                  {getCategoryLabel(documentCategory)}
                </Badge>
              )}
            </div>
          )}
          {documentType === 'local' && (
            <p className="text-muted-foreground mt-1">Achat indépendant local</p>
          )}
        </div>

        {/* Stepper - only show after document type selection */}
        {documentType && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isComplete = index < currentStep;
              
              return (
                <React.Fragment key={step.id}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isComplete ? 'bg-primary/10 text-primary' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* CamScanner Link */}
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <Button 
              variant="outline" 
              onClick={() => window.open('https://www.camscanner.com/file/recent', '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir CamScanner
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Numérisez vos documents avec CamScanner avant de les uploader
            </p>
          </CardContent>
        </Card>

        {/* Step 0: Document Type Selection */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Étape 1 : Type de document
              </CardTitle>
              <CardDescription>
                Sélectionnez le type de document que vous souhaitez uploader
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup 
                value={documentType || ''} 
                onValueChange={(value) => setDocumentType(value as DocumentType)}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="relative">
                  <RadioGroupItem value="local" id="local" className="peer sr-only" />
                  <Label 
                    htmlFor="local" 
                    className="flex flex-col items-center justify-center p-6 rounded-lg border-2 cursor-pointer transition-all
                      peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                      hover:border-primary/50 hover:bg-muted/50"
                  >
                    <ShoppingCart className="h-10 w-10 mb-3 text-primary" />
                    <span className="font-semibold text-lg">Achat indépendant local</span>
                    <span className="text-sm text-muted-foreground mt-1 text-center">
                      Document d'achat local sans dossier d'importation
                    </span>
                  </Label>
                </div>
                
                <div className="relative">
                  <RadioGroupItem value="import" id="import" className="peer sr-only" />
                  <Label 
                    htmlFor="import" 
                    className="flex flex-col items-center justify-center p-6 rounded-lg border-2 cursor-pointer transition-all
                      peer-data-[state=checked]:border-purple-500 peer-data-[state=checked]:bg-purple-500/5
                      hover:border-purple-500/50 hover:bg-muted/50"
                  >
                    <Globe className="h-10 w-10 mb-3 text-purple-500" />
                    <span className="font-semibold text-lg">Document lié à l'importation</span>
                    <span className="text-sm text-muted-foreground mt-1 text-center">
                      Document associé à un dossier d'importation existant
                    </span>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex justify-end">
                <Button 
                  onClick={() => {
                    if (documentType === 'local') {
                      // For local, skip to upload step (index 1 in STEPS_LOCAL)
                      setCurrentStep(1);
                    } else if (documentType === 'import') {
                      // For import, go to folder step (index 1 in STEPS_IMPORT)
                      setCurrentStep(1);
                    }
                  }} 
                  disabled={!documentType}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Folder Selection (Import only) */}
        {documentType === 'import' && currentStep === getStepNumber('folder') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Étape 2 : Sélection du dossier d'importation
              </CardTitle>
              <CardDescription>
                Sélectionnez le dossier d'importation concerné (dossiers ouverts uniquement)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingFolders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : importFolders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun dossier d'importation ouvert</p>
                  <p className="text-sm">Créez un dossier dans la page Achats</p>
                </div>
              ) : (
                <Select value={selectedImportFolder || ''} onValueChange={setSelectedImportFolder}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionnez un dossier d'importation" />
                  </SelectTrigger>
                  <SelectContent>
                    {importFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-purple-500" />
                          <span>#{folder.folder_number}</span>
                          <Badge variant="outline" className="text-xs">
                            {folder.folder_month}/{folder.folder_year}
                          </Badge>
                          <span className="text-muted-foreground">- {folder.country}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setDocumentType(null);
                  setCurrentStep(0);
                }}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button 
                  onClick={() => setCurrentStep(getStepNumber('category'))} 
                  disabled={!selectedImportFolder}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Category Selection (Import only) */}
        {documentType === 'import' && currentStep === getStepNumber('category') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Étape 3 : Catégorie de document
              </CardTitle>
              <CardDescription>
                Sélectionnez la catégorie du document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup 
                value={documentCategory || ''} 
                onValueChange={(value) => setDocumentCategory(value as DocumentCategory)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {DOCUMENT_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.value} className="relative">
                      <RadioGroupItem value={cat.value} id={cat.value} className="peer sr-only" />
                      <Label 
                        htmlFor={cat.value} 
                        className="flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                          peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                          hover:border-primary/50 hover:bg-muted/50"
                      >
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="font-medium">{cat.label}</span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(getStepNumber('folder'))}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button 
                  onClick={() => setCurrentStep(getStepNumber('upload'))} 
                  disabled={!documentCategory}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Step */}
        {documentType && currentStep === getStepNumber('upload') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {documentType === 'local' ? 'Étape 2' : 'Étape 4'} : Upload des documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">Cliquez pour sélectionner des PDF</p>
                  <p className="text-sm text-muted-foreground">ou glissez-déposez vos fichiers ici</p>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  if (documentType === 'local') {
                    setDocumentType(null);
                    setCurrentStep(0);
                  } else {
                    setCurrentStep(getStepNumber('category'));
                  }
                }}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button 
                  onClick={() => setCurrentStep(getStepNumber('prefix'))} 
                  disabled={uploadedFiles.length === 0}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prefix Verification Step */}
        {documentType && currentStep === getStepNumber('prefix') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Vérification des noms de fichiers
              </CardTitle>
              {linkData.file_prefix && (
                <CardDescription>
                  Les fichiers doivent commencer par : <strong>{linkData.file_prefix}</strong>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {uploadedFiles.map(file => (
                  <div key={file.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                    file.prefixValid ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
                  }`}>
                    <div className="flex items-center gap-3">
                      {file.prefixValid ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <span className="font-medium">{file.name}</span>
                        {!file.prefixValid && (
                          <p className="text-xs text-destructive">
                            Ce document ne commence pas par "{linkData.file_prefix}"
                          </p>
                        )}
                      </div>
                    </div>
                    {!file.prefixValid && (
                      <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(getStepNumber('upload'))}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button 
                  onClick={() => {
                    // For "Autre" category, skip OCR and go directly to edit step
                    if (isAutreWorkflow) {
                      initializeAutreFiles();
                    } else {
                      setCurrentStep(getStepNumber('analyze'));
                    }
                  }} 
                  disabled={!allPrefixesValid}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OCR Analysis Step */}
        {documentType && currentStep === getStepNumber('analyze') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Analyse OCR
              </CardTitle>
              <CardDescription>
                Aperçu des documents et lancement de l'analyse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[300px]">
                <div className="space-y-4">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{file.name}</span>
                        <Badge variant={file.status === 'analyzed' ? 'default' : 'secondary'}>
                          {file.status === 'analyzing' ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyse...</>
                          ) : file.status === 'analyzed' ? (
                            <><Check className="h-3 w-3 mr-1" /> Analysé</>
                          ) : (
                            'En attente'
                          )}
                        </Badge>
                      </div>
                      {file.previewUrl && (
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <Button variant="outline" size="sm" asChild>
                            <a href={file.previewUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4 mr-2" />
                              Aperçu
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(getStepNumber('prefix'))}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button onClick={analyzeDocuments} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyse en cours...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Analyser les documents</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Step */}
        {documentType && currentStep === getStepNumber('edit') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {isQuittanceWorkflow ? 'Édition des quittances douanières' : 
                 isAutreWorkflow ? 'Saisie des informations' : 'Édition des informations'}
              </CardTitle>
              {isQuittanceWorkflow && (
                <CardDescription>
                  Vérifiez et modifiez les informations extraites par OCR
                </CardDescription>
              )}
              {isAutreWorkflow && (
                <CardDescription>
                  Saisissez les informations pour chaque document (aucune extraction OCR)
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4 pr-4">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Original : {file.name}</span>
                        {file.previewUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={file.previewUrl} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4 mr-2" />
                              Aperçu
                            </a>
                          </Button>
                        )}
                      </div>
                      
                      {/* "Autre" document edit form - simplified, no OCR */}
                      {isAutreWorkflow ? (
                        <>
                          {/* Type de document dropdown */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-2">
                              <Tags className="h-3 w-3" />
                              Type de document
                            </Label>
                            <Select 
                              value={file.autreDocumentType || 'autre'} 
                              onValueChange={(value) => updateFileField(file.id, 'autreDocumentType', value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Sélectionnez le type" />
                              </SelectTrigger>
                              <SelectContent className="bg-background">
                                {AUTRE_DOCUMENT_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${type.color.split(' ')[0]}`}></div>
                                      <span>{type.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Numéro dossier */}
                          <div className="space-y-1">
                            <Label className="text-xs">Numéro du dossier</Label>
                            <Input
                              value={getSelectedFolderDetails()?.folder_number || ''}
                              disabled
                              className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">Pré-rempli automatiquement</p>
                          </div>

                          {/* Generated filename preview with badge */}
                          <div className="p-3 bg-slate-500/5 border border-slate-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={AUTRE_DOCUMENT_TYPES.find(t => t.value === file.autreDocumentType)?.color || 'bg-slate-500/10 text-slate-600'}>
                                {AUTRE_DOCUMENT_TYPES.find(t => t.value === file.autreDocumentType)?.label || 'Autre'}
                              </Badge>
                              <Badge variant="outline">
                                <FolderOpen className="h-3 w-3 mr-1" />
                                Dossier #{getSelectedFolderDetails()?.folder_number}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Nouveau nom : </span>
                              <code className="font-mono text-slate-700">{file.newFilename}</code>
                            </div>
                          </div>
                        </>
                      ) : isQuittanceWorkflow ? (
                        <>
                          {/* Type de quittance - Editable selector */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-2">
                              <Tags className="h-3 w-3" />
                              Type de quittance
                            </Label>
                            <Select 
                              value={file.quittanceType || 'droits_taxes_importation'} 
                              onValueChange={(value) => updateFileField(file.id, 'quittanceType', value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Sélectionnez le type" />
                              </SelectTrigger>
                              <SelectContent className="bg-background">
                                {QUITTANCE_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${type.color.split(' ')[0]}`}></div>
                                      <span>{type.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Détecté automatiquement par OCR - modifiable si incorrecte
                            </p>
                          </div>

                          {/* Row 1: Bureau des douanes + Numéro de quittance */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Bureau des douanes</Label>
                              <Input
                                value={file.customsOffice || ''}
                                onChange={(e) => updateFileField(file.id, 'customsOffice', e.target.value)}
                                placeholder="Ex: Tunis Port, Rades, Sfax..."
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Numéro de quittance</Label>
                              <Input
                                value={file.documentNumber || ''}
                                onChange={(e) => updateFileField(file.id, 'documentNumber', e.target.value)}
                                placeholder="N° quittance"
                              />
                            </div>
                          </div>

                          {/* Row 2: Date + Montant total */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                value={file.documentDate || ''}
                                onChange={(e) => updateFileField(file.id, 'documentDate', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Montant total (TND)</Label>
                              <Input
                                type="number"
                                step="0.001"
                                value={file.totalAmount || ''}
                                onChange={(e) => updateFileField(file.id, 'totalAmount', parseFloat(e.target.value) || 0)}
                                placeholder="0.000"
                              />
                            </div>
                          </div>

                          {/* Row 3: N° déclaration douanière + Raison sociale importateur */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">N° déclaration douanière</Label>
                              <Input
                                value={file.customsDeclarationNumber || ''}
                                onChange={(e) => updateFileField(file.id, 'customsDeclarationNumber', e.target.value)}
                                placeholder="N° déclaration (si présent)"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Raison sociale importateur</Label>
                              <Input
                                value={file.importerName || ''}
                                onChange={(e) => updateFileField(file.id, 'importerName', e.target.value)}
                                placeholder="Nom de l'importateur"
                              />
                            </div>
                          </div>

                          {/* Generated filename preview with badge */}
                          <div className="p-3 bg-amber-500/5 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={QUITTANCE_TYPES.find(t => t.value === file.quittanceType)?.color || 'bg-amber-500/10 text-amber-700'}>
                                {QUITTANCE_TYPES.find(t => t.value === file.quittanceType)?.label || 'Quittance'}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Nouveau nom : </span>
                              <code className="font-mono text-amber-700">{file.newFilename}</code>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Standard invoice edit form */
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Fournisseur</Label>
                              <Input
                                value={file.supplier || ''}
                                onChange={(e) => updateFileField(file.id, 'supplier', e.target.value)}
                                placeholder="Nom fournisseur"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Numéro</Label>
                              <Input
                                value={file.documentNumber || ''}
                                onChange={(e) => updateFileField(file.id, 'documentNumber', e.target.value)}
                                placeholder="N° document"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                value={file.documentDate || ''}
                                onChange={(e) => updateFileField(file.id, 'documentDate', e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="p-2 bg-muted/50 rounded text-sm">
                            <span className="text-muted-foreground">Nouveau nom : </span>
                            <code className="font-mono">{file.newFilename}</code>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  // For "Autre" workflow, go back to prefix step (skipping OCR)
                  if (isAutreWorkflow) {
                    setCurrentStep(getStepNumber('prefix'));
                  } else {
                    setCurrentStep(getStepNumber('analyze'));
                  }
                }}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button onClick={checkDuplicates}>
                  {isQuittanceWorkflow ? 'Vérifier les doublons (quittances)' : 
                   isAutreWorkflow ? 'Vérifier et continuer' : 'Vérifier les doublons'}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Step */}
        {documentType && currentStep === getStepNumber('validate') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Validation des doublons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {uploadedFiles.map(file => (
                  <div key={file.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                    file.status === 'valid' ? 'border-primary/30 bg-primary/5' : 
                    file.status === 'duplicate' ? 'border-destructive/30 bg-destructive/5' : 
                    'border-muted'
                  }`}>
                    <div className="flex items-center gap-3">
                      {file.status === 'valid' ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : file.status === 'duplicate' ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      )}
                      <div>
                        <span className="font-medium">{file.newFilename}</span>
                        {file.status === 'duplicate' && (
                          <p className="text-xs text-destructive">
                            {file.duplicateReason === 'hash' 
                              ? '🔒 Fichier identique déjà uploadé (même contenu)' 
                              : '📋 Même numéro et date de document'}
                          </p>
                        )}
                      </div>
                    </div>
                    {file.status === 'duplicate' && (
                      <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Import context summary */}
              {documentType === 'import' && (
                <div className={`p-4 border rounded-lg ${
                  isAutreWorkflow 
                    ? 'bg-slate-500/5 border-slate-200' 
                    : 'bg-purple-500/5 border-purple-200'
                }`}>
                  <p className={`text-sm font-medium mb-2 ${
                    isAutreWorkflow ? 'text-slate-700' : 'text-purple-700'
                  }`}>
                    Contexte d'importation
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {isAutreWorkflow ? (
                      <Badge className="bg-slate-500/10 text-slate-600 border-slate-200">
                        <Tags className="h-3 w-3 mr-1" />
                        Autre
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">
                        <Globe className="h-3 w-3 mr-1" />
                        Importation
                      </Badge>
                    )}
                    <Badge variant="outline">
                      <FolderOpen className="h-3 w-3 mr-1" />
                      Dossier #{getSelectedFolderDetails()?.folder_number}
                    </Badge>
                    {!isAutreWorkflow && (
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
                        {getCategoryLabel(documentCategory)}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(getStepNumber('edit'))}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button onClick={transferDocuments} disabled={!allFilesValid || isTransferring}>
                  {isTransferring ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transfert...</>
                  ) : (
                    <>Valider et transférer</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {documentType && currentStep === getStepNumber('transfer') && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Transfert terminé !</CardTitle>
              <CardDescription>
                Vos documents ont été envoyés vers la page "Documents en attente"
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {documentType === 'import' && (
                <div className="flex justify-center gap-2 flex-wrap">
                  {isAutreWorkflow ? (
                    <Badge className="bg-slate-500/10 text-slate-600 border-slate-200">
                      <Tags className="h-3 w-3 mr-1" />
                      Autre
                    </Badge>
                  ) : (
                    <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">
                      <Globe className="h-3 w-3 mr-1" />
                      Importation
                    </Badge>
                  )}
                  <Badge variant="outline">
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Dossier #{getSelectedFolderDetails()?.folder_number}
                  </Badge>
                  {!isAutreWorkflow && (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
                      {getCategoryLabel(documentCategory)}
                    </Badge>
                  )}
                </div>
              )}
              <Button onClick={resetWorkflow}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Nouveau transfert
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PublicUpload;
