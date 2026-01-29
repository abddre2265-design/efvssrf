import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  ExternalLink, 
  Play,
  ShoppingCart,
  Globe,
  Loader2,
  Tags
} from 'lucide-react';

interface PendingUpload {
  id: string;
  organization_id: string;
  original_filename: string;
  storage_path: string;
  supplier_detected: string | null;
  document_number: string | null;
  document_date: string | null;
  status: string;
  document_type: string | null;
  document_category: string | null;
}

interface ProcessingInitialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUpload: PendingUpload;
  onStartProcessing: (documentType: string, documentCategory: string | null) => void;
}

const DOCUMENT_TYPES = [
  { value: 'local_purchase', labelFr: 'Achat indépendant local', labelEn: 'Local Independent Purchase', icon: ShoppingCart },
  { value: 'import', labelFr: 'Importation', labelEn: 'Import', icon: Globe },
];

const DOCUMENT_CATEGORIES = [
  { value: 'facture_commerciale_etrangere', labelFr: 'Facture commerciale étrangère', labelEn: 'Foreign Commercial Invoice' },
  { value: 'facture_locale', labelFr: 'Facture locale', labelEn: 'Local Invoice' },
  { value: 'quittance_douaniere', labelFr: 'Quittance douanière', labelEn: 'Customs Receipt' },
  { value: 'autre', labelFr: 'Autre document', labelEn: 'Other Document' },
];

export const ProcessingInitialDialog: React.FC<ProcessingInitialDialogProps> = ({
  open,
  onOpenChange,
  pendingUpload,
  onStartProcessing,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [documentType, setDocumentType] = useState<string>(
    pendingUpload.document_type || 'local_purchase'
  );
  const [documentCategory, setDocumentCategory] = useState<string | null>(
    pendingUpload.document_category
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);

  useEffect(() => {
    const loadPdfUrl = async () => {
      setIsLoadingPdf(true);
      try {
        const { data } = await supabase.storage
          .from('public-uploads')
          .createSignedUrl(pendingUpload.storage_path, 3600);
        
        if (data?.signedUrl) {
          setPdfUrl(data.signedUrl);
        }
      } catch (error) {
        console.error('Error loading PDF URL:', error);
      } finally {
        setIsLoadingPdf(false);
      }
    };

    if (open) {
      loadPdfUrl();
    }
  }, [open, pendingUpload.storage_path]);

  const handleOpenPdf = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleStart = () => {
    onStartProcessing(documentType, documentCategory);
  };

  const isFr = language === 'fr';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('process_document') || 'Traitement du document'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
          {/* Left side - PDF Preview */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
              <span className="font-medium text-sm">{t('document_preview') || 'Aperçu du document'}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenPdf}
                disabled={!pdfUrl}
                className="gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                {t('open_in_new_tab') || 'Ouvrir'}
              </Button>
            </div>
            <div className="flex-1 bg-muted/20 min-h-[400px]">
              {isLoadingPdf ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full min-h-[400px]"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('pdf_load_error') || 'Impossible de charger le PDF'}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Document info and type selection */}
          <div className="space-y-6 overflow-y-auto">
            {/* File info */}
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pendingUpload.original_filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(pendingUpload.storage_path.split('/')[1]?.split('-')[0] || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Detected info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {pendingUpload.supplier_detected && (
                  <div>
                    <span className="text-muted-foreground">{t('supplier_detected') || 'Fournisseur détecté'}:</span>
                    <p className="font-medium">{pendingUpload.supplier_detected}</p>
                  </div>
                )}
                {pendingUpload.document_number && (
                  <div>
                    <span className="text-muted-foreground">{t('document_number') || 'N° Document'}:</span>
                    <p className="font-mono font-medium">{pendingUpload.document_number}</p>
                  </div>
                )}
                {pendingUpload.document_date && (
                  <div>
                    <span className="text-muted-foreground">{t('document_date') || 'Date'}:</span>
                    <p className="font-medium">{pendingUpload.document_date}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Document Type Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">
                {t('document_type') || 'Type de document'}
              </Label>
              
              <div className="grid grid-cols-1 gap-3">
                {DOCUMENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = documentType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setDocumentType(type.value);
                        // Reset category when changing type
                        if (type.value === 'local_purchase') {
                          setDocumentCategory(null);
                        }
                      }}
                      className={`flex items-center gap-3 p-4 border rounded-lg transition-all text-left ${
                        isSelected 
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                          : 'hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${isSelected ? 'bg-primary/20' : 'bg-muted'}`}>
                        <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{isFr ? type.labelFr : type.labelEn}</p>
                      </div>
                      {isSelected && (
                        <Badge className="bg-primary/20 text-primary border-0">
                          {t('selected') || 'Sélectionné'}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Document Category (only for import type) */}
            {documentType === 'import' && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Tags className="h-4 w-4" />
                  {t('document_category') || 'Catégorie du document'}
                </Label>
                <Select
                  value={documentCategory || ''}
                  onValueChange={(value) => setDocumentCategory(value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_category') || 'Sélectionner une catégorie'} />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {isFr ? cat.labelFr : cat.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Info box */}
            <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
              <p className="text-sm text-primary">
                {documentType === 'local_purchase' 
                  ? (t('local_purchase_info') || 'Le système analysera le document pour extraire les informations du fournisseur et les lignes de facture.')
                  : (t('import_info') || 'Pour les importations, vous devrez également sélectionner un dossier d\'import.')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel') || 'Annuler'}
          </Button>
          <Button onClick={handleStart} className="gap-2">
            <Play className="h-4 w-4" />
            {t('start_processing') || 'Démarrer le traitement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
