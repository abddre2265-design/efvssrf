import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Loader2, 
  FileText, 
  FolderOpen, 
  Tags
} from 'lucide-react';
import { OtherImportDocumentData } from './types';

interface OtherImportDocumentCompletionStepProps {
  validatedData: OtherImportDocumentData;
  organizationId: string;
  importFolderId: string;
  importFolderNumber: string;
  pendingUploadId: string;
  storagePath: string;
  originalFilename: string;
  onComplete: (documentId: string) => void;
}

const DOCUMENT_CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  facture_commerciale_etrangere: { fr: 'Facture commerciale étrangère', en: 'Foreign commercial invoice' },
  facture_locale: { fr: 'Facture locale', en: 'Local invoice' },
  quittance_douaniere: { fr: 'Quittance douanière', en: 'Customs receipt' },
  autre: { fr: 'Autre document', en: 'Other document' },
};

export const OtherImportDocumentCompletionStep: React.FC<OtherImportDocumentCompletionStepProps> = ({
  validatedData,
  organizationId,
  importFolderId,
  importFolderNumber,
  pendingUploadId,
  storagePath,
  originalFilename,
  onComplete,
}) => {
  const { language, isRTL } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string>('');

  const isFr = language === 'fr';

  const getCategoryLabel = () => {
    const labels = DOCUMENT_CATEGORY_LABELS[validatedData.documentCategory];
    return labels ? labels[language as keyof typeof labels] : validatedData.documentCategory;
  };

  const createDocument = async () => {
    setIsCreating(true);
    try {
      // Get PDF signed URL for storage
      const { data: signedData } = await supabase.storage
        .from('public-uploads')
        .createSignedUrl(storagePath, 86400 * 365); // 1 year validity

      // Get family name
      if (validatedData.documentFamilyId) {
        const { data: familyData } = await supabase
          .from('document_families')
          .select('name')
          .eq('id', validatedData.documentFamilyId)
          .single();
        
        if (familyData) {
          setFamilyName(familyData.name);
        }
      }

      // Create import folder document
      const { data: doc, error: docError } = await supabase
        .from('import_folder_documents')
        .insert({
          organization_id: organizationId,
          import_folder_id: importFolderId,
          pending_upload_id: pendingUploadId,
          document_family_id: validatedData.documentFamilyId,
          document_type: 'import',
          document_category: validatedData.documentCategory,
          original_filename: originalFilename,
          storage_path: storagePath,
          pdf_url: signedData?.signedUrl || null,
          status: 'validated',
          notes: validatedData.notes || null,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Delete the pending upload record
      await supabase
        .from('pending_public_uploads')
        .delete()
        .eq('id', pendingUploadId);

      // Add log to import folder
      await supabase
        .from('import_folder_logs')
        .insert({
          import_folder_id: importFolderId,
          action: 'document_added',
          details: {
            document_id: doc.id,
            document_category: validatedData.documentCategory,
            document_family_id: validatedData.documentFamilyId,
            original_filename: originalFilename,
          },
        });

      setDocumentId(doc.id);
      setIsCreated(true);
      toast.success(isFr ? 'Document ajouté au dossier d\'importation' : 'Document added to import folder');
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error(isFr ? 'Erreur lors de la création' : 'Error creating document');
    } finally {
      setIsCreating(false);
    }
  };

  // Auto-create on mount
  useEffect(() => {
    createDocument();
  }, []);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className={isCreated ? 'border-primary/30 bg-primary/5' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isCreating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isCreated ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            {isCreating 
              ? (isFr ? 'Création en cours...' : 'Creating...') 
              : isCreated 
                ? (isFr ? 'Document ajouté' : 'Document added')
                : (isFr ? 'Finalisation' : 'Finalization')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isCreating && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground">
                {isFr ? 'Ajout du document au dossier d\'importation...' : 'Adding document to import folder...'}
              </p>
            </div>
          )}

          {isCreated && (
            <>
              {/* Success message */}
              <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-primary">
                    {isFr ? 'Document ajouté avec succès !' : 'Document added successfully!'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isFr 
                      ? `Le document a été ajouté au dossier d'importation #${importFolderNumber}` 
                      : `The document has been added to import folder #${importFolderNumber}`}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {isFr ? 'Catégorie' : 'Category'}
                  </p>
                  <Badge className="mt-1 bg-purple-500/10 text-purple-700">
                    {getCategoryLabel()}
                  </Badge>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    {isFr ? 'Dossier' : 'Folder'}
                  </p>
                  <p className="font-mono font-medium">#{importFolderNumber}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg col-span-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Tags className="h-3 w-3" />
                    {isFr ? 'Famille' : 'Family'}
                  </p>
                  <p className="font-medium">{familyName || '—'}</p>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/20 text-primary">
                  {isFr ? 'Validé' : 'Validated'}
                </Badge>
              </div>

              <Button 
                onClick={() => documentId && onComplete(documentId)} 
                className="w-full"
              >
                {isFr ? 'Terminer' : 'Finish'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
