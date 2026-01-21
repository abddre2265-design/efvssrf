import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Upload, 
  FileText,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { PendingUploadForProcessing, LocalPurchaseWorkflowData } from './types';

interface TransferStepProps {
  pendingUpload: PendingUploadForProcessing;
  organizationId: string;
  onAnalysisComplete: (data: Partial<LocalPurchaseWorkflowData>) => void;
  onContinue: () => void;
}

export const TransferStep: React.FC<TransferStepProps> = ({
  pendingUpload,
  organizationId,
  onAnalysisComplete,
  onContinue,
}) => {
  const { t, isRTL } = useLanguage();
  const [isTransferring, setIsTransferring] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transferComplete, setTransferComplete] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Transfer the file to purchase-documents bucket
  const handleTransfer = async () => {
    setIsTransferring(true);
    try {
      // Download file from public-uploads
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('public-uploads')
        .download(pendingUpload.storage_path);

      if (downloadError) throw downloadError;

      // Generate new path in purchase-documents bucket
      const timestamp = Date.now();
      const safeName = pendingUpload.original_filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const newStoragePath = `${organizationId}/${timestamp}-${safeName}`;

      // Upload to purchase-documents
      const { error: uploadError } = await supabase.storage
        .from('purchase-documents')
        .upload(newStoragePath, fileData, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get signed URL
      const { data: signedUrlData } = await supabase.storage
        .from('purchase-documents')
        .createSignedUrl(newStoragePath, 3600);

      const url = signedUrlData?.signedUrl || null;
      setPdfUrl(url);
      setTransferComplete(true);
      
      toast.success('Fichier transféré avec succès');
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error('Erreur lors du transfert du fichier');
    } finally {
      setIsTransferring(false);
    }
  };

  // Analyze the PDF
  const handleAnalyze = async () => {
    if (!pdfUrl) {
      toast.error('Veuillez d\'abord transférer le fichier');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-purchase-pdf', {
        body: {
          pdf_url: pdfUrl,
          organization_id: organizationId,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erreur d\'analyse');
      }

      // Check for duplicate
      if (data.data.is_duplicate) {
        toast.warning('Document déjà traité');
        // Still allow to continue but warn the user
      }

      setAnalysisResult(data.data);
      
      // Pass data to parent (don't navigate yet - user will click Continue)
      onAnalysisComplete({
        pdfUrl,
        pdfHash: data.pdf_hash || null,
        extractedSupplier: data.data.supplier || null,
        extractedProducts: data.data.products || [],
        extractedTotals: data.data.totals || {},
        invoiceNumber: data.data.invoice_number || pendingUpload.document_number,
        invoiceDate: data.data.invoice_date || pendingUpload.document_date,
      });

      toast.success('Analyse terminée avec succès');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenPdf = async () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      // Open from public-uploads
      const { data } = await supabase.storage
        .from('public-uploads')
        .createSignedUrl(pendingUpload.storage_path, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Transfert et analyse du document
        </CardTitle>
        <CardDescription>
          Le document sera transféré et analysé pour extraction automatique
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* File Info */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{pendingUpload.original_filename}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                  Achat local
                </span>
                {pendingUpload.supplier_detected && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-background">
                    {pendingUpload.supplier_detected}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenPdf}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          {pendingUpload.document_number && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">N° Document:</span>{' '}
                <span className="font-mono font-medium">{pendingUpload.document_number}</span>
              </div>
              {pendingUpload.document_date && (
                <div>
                  <span className="text-muted-foreground">Date:</span>{' '}
                  <span className="font-medium">{pendingUpload.document_date}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transfer Status */}
        {!transferComplete ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-muted-foreground text-center">
              Cliquez pour transférer le fichier vers le stockage des achats
            </p>
            <Button
              onClick={handleTransfer}
              disabled={isTransferring}
              className="gap-2"
              size="lg"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transfert en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Transférer le fichier
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertTitle className="font-semibold text-green-700 dark:text-green-400">
                Fichier transféré
              </AlertTitle>
              <AlertDescription className="text-green-700/80 dark:text-green-400/80">
                Le fichier a été transféré avec succès vers le stockage des achats.
              </AlertDescription>
            </Alert>

            {!analysisResult ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <p className="text-muted-foreground text-center">
                  Analysez le document pour extraire automatiquement les informations
                </p>
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="gap-2"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyser le document
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <AlertTitle className="font-semibold text-green-700 dark:text-green-400">
                    Analyse terminée
                  </AlertTitle>
                  <AlertDescription className="text-green-700/80 dark:text-green-400/80">
                    Les données ont été extraites. Cliquez sur Continuer pour passer à l'étape suivante.
                  </AlertDescription>
                </Alert>
                
                <div className="flex justify-end">
                  <Button
                    onClick={onContinue}
                    className="gap-2"
                    size="lg"
                  >
                    Continuer
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
