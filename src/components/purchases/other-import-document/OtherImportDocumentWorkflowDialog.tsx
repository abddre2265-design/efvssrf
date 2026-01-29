import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { OtherImportDocumentStep, OtherImportDocumentData } from './types';
import { OtherImportDocumentFamilyStep } from './OtherImportDocumentFamilyStep';
import { OtherImportDocumentCompletionStep } from './OtherImportDocumentCompletionStep';

interface PendingUploadForOtherDocument {
  id: string;
  organization_id: string;
  original_filename: string;
  storage_path: string;
  document_type: string | null;
  document_category: string | null;
  import_folder_id: string | null;
  import_folder_number?: string | null;
}

interface OtherImportDocumentWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUpload: PendingUploadForOtherDocument;
  organizationId: string;
  onComplete: () => void;
}

export const OtherImportDocumentWorkflowDialog: React.FC<OtherImportDocumentWorkflowDialogProps> = ({
  open,
  onOpenChange,
  pendingUpload,
  organizationId,
  onComplete,
}) => {
  const { language, isRTL } = useLanguage();
  const [currentStep, setCurrentStep] = useState<OtherImportDocumentStep>('family_selection');
  const [validatedData, setValidatedData] = useState<OtherImportDocumentData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const isFr = language === 'fr';

  // Get import folder number from props or fetch it
  const [importFolderNumber, setImportFolderNumber] = useState<string>(
    pendingUpload.import_folder_number || ''
  );

  useEffect(() => {
    const loadData = async () => {
      // Get PDF URL
      const { data: signedData } = await supabase.storage
        .from('public-uploads')
        .createSignedUrl(pendingUpload.storage_path, 3600);
      
      if (signedData?.signedUrl) {
        setPdfUrl(signedData.signedUrl);
      }

      // Fetch import folder number if not provided
      if (!importFolderNumber && pendingUpload.import_folder_id) {
        const { data: folder } = await supabase
          .from('import_folders')
          .select('folder_number')
          .eq('id', pendingUpload.import_folder_id)
          .single();
        
        if (folder) {
          setImportFolderNumber(folder.folder_number);
        }
      }
    };

    if (open) {
      loadData();
    }
  }, [open, pendingUpload.storage_path, pendingUpload.import_folder_id, importFolderNumber]);

  const handleFamilyValidation = (data: OtherImportDocumentData) => {
    setValidatedData(data);
    setCurrentStep('complete');
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'family_selection':
        return isFr ? 'Sélection de la famille' : 'Family Selection';
      case 'complete':
        return isFr ? 'Finalisation' : 'Completion';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isFr ? 'Traitement du document' : 'Document Processing'}
          </DialogTitle>
          {/* Context info */}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              #{importFolderNumber}
            </Badge>
            <Badge variant="secondary">
              {getStepTitle()}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-1">
            {currentStep === 'family_selection' && pendingUpload.import_folder_id && (
              <OtherImportDocumentFamilyStep
                documentCategory={pendingUpload.document_category || 'autre'}
                importFolderNumber={importFolderNumber}
                originalFilename={pendingUpload.original_filename}
                organizationId={organizationId}
                onValidate={handleFamilyValidation}
                onCancel={handleCancel}
              />
            )}

            {currentStep === 'complete' && validatedData && pendingUpload.import_folder_id && (
              <OtherImportDocumentCompletionStep
                validatedData={validatedData}
                organizationId={organizationId}
                importFolderId={pendingUpload.import_folder_id}
                importFolderNumber={importFolderNumber}
                pendingUploadId={pendingUpload.id}
                storagePath={pendingUpload.storage_path}
                originalFilename={pendingUpload.original_filename}
                onComplete={handleComplete}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
