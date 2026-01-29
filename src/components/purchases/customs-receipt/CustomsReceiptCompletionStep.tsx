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
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { CustomsReceiptData, QUITTANCE_TYPES } from './types';

interface CustomsReceiptCompletionStepProps {
  validatedData: CustomsReceiptData;
  organizationId: string;
  importFolderId: string;
  importFolderNumber: string;
  pendingUploadId: string;
  storagePath: string;
  onComplete: (customsReceiptId: string) => void;
}

export const CustomsReceiptCompletionStep: React.FC<CustomsReceiptCompletionStepProps> = ({
  validatedData,
  organizationId,
  importFolderId,
  importFolderNumber,
  pendingUploadId,
  storagePath,
  onComplete,
}) => {
  const { language, isRTL } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const isFr = language === 'fr';

  const getQuittanceTypeLabel = (value: string): string => {
    const type = QUITTANCE_TYPES.find(t => t.value === value);
    return isFr ? (type?.labelFr || value) : (type?.labelEn || value);
  };

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + ' TND';
  };

  const createCustomsReceipt = async () => {
    setIsCreating(true);
    try {
      // Get PDF signed URL for storage
      const { data: signedData } = await supabase.storage
        .from('public-uploads')
        .createSignedUrl(storagePath, 86400 * 365); // 1 year validity

      // Create customs receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('customs_receipts')
        .insert({
          organization_id: organizationId,
          import_folder_id: importFolderId,
          pending_upload_id: pendingUploadId,
          quittance_type: validatedData.quittanceType,
          customs_office: validatedData.customsOffice || null,
          document_number: validatedData.documentNumber,
          document_date: validatedData.documentDate || null,
          total_amount: validatedData.totalAmount,
          customs_declaration_number: validatedData.customsDeclarationNumber || null,
          importer_name: validatedData.importerName || null,
          pdf_url: signedData?.signedUrl || null,
          storage_path: storagePath,
          status: 'validated',
          payment_status: 'unpaid',
          notes: validatedData.notes || null,
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

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
          action: 'customs_receipt_added',
          details: {
            receipt_id: receipt.id,
            document_number: validatedData.documentNumber,
            quittance_type: validatedData.quittanceType,
            total_amount: validatedData.totalAmount,
          },
        });

      setReceiptId(receipt.id);
      setIsCreated(true);
      toast.success(isFr ? 'Quittance douanière créée avec succès' : 'Customs receipt created successfully');
    } catch (error) {
      console.error('Error creating customs receipt:', error);
      toast.error(isFr ? 'Erreur lors de la création' : 'Error creating receipt');
    } finally {
      setIsCreating(false);
    }
  };

  // Auto-create on mount
  useEffect(() => {
    createCustomsReceipt();
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
                ? (isFr ? 'Quittance créée' : 'Receipt created')
                : (isFr ? 'Finalisation' : 'Finalization')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isCreating && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground">
                {isFr ? 'Création de la quittance douanière...' : 'Creating customs receipt...'}
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
                    {isFr ? 'Quittance douanière créée avec succès !' : 'Customs receipt created successfully!'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isFr 
                      ? `La quittance a été ajoutée au dossier d'importation #${importFolderNumber}` 
                      : `The receipt has been added to import folder #${importFolderNumber}`}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {isFr ? 'Type' : 'Type'}
                  </p>
                  <Badge className="mt-1 bg-amber-500/10 text-amber-700">
                    {getQuittanceTypeLabel(validatedData.quittanceType)}
                  </Badge>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {isFr ? 'Bureau' : 'Office'}
                  </p>
                  <p className="font-medium">{validatedData.customsOffice || '—'}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'N° Quittance' : 'Receipt #'}
                  </p>
                  <p className="font-mono font-medium">{validatedData.documentNumber}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {isFr ? 'Date' : 'Date'}
                  </p>
                  <p className="font-medium">{validatedData.documentDate}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    {isFr ? 'Dossier' : 'Folder'}
                  </p>
                  <p className="font-mono font-medium">#{importFolderNumber}</p>
                </div>

                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {isFr ? 'Montant' : 'Amount'}
                  </p>
                  <p className="font-bold text-primary">{formatAmount(validatedData.totalAmount)}</p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/20 text-primary">
                  {isFr ? 'Validée' : 'Validated'}
                </Badge>
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  {isFr ? 'Impayée' : 'Unpaid'}
                </Badge>
              </div>

              <Button 
                onClick={() => receiptId && onComplete(receiptId)} 
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
