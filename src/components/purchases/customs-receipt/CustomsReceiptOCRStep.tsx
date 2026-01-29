import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSearch, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { CustomsReceiptData, PendingUploadForCustomsReceipt, QUITTANCE_TYPES } from './types';

interface CustomsReceiptOCRStepProps {
  pendingUpload: PendingUploadForCustomsReceipt;
  onExtractionComplete: (data: CustomsReceiptData) => void;
}

export const CustomsReceiptOCRStep: React.FC<CustomsReceiptOCRStepProps> = ({
  pendingUpload,
  onExtractionComplete,
}) => {
  const { language, isRTL } = useLanguage();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<CustomsReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFr = language === 'fr';

  // Auto-start analysis on mount
  useEffect(() => {
    startAnalysis();
  }, []);

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Get signed URL for the PDF
      const { data: signedData, error: urlError } = await supabase.storage
        .from('public-uploads')
        .createSignedUrl(pendingUpload.storage_path, 3600);

      if (urlError || !signedData?.signedUrl) {
        throw new Error('Impossible de récupérer le fichier');
      }

      // Fetch the PDF file
      const pdfResponse = await fetch(signedData.signedUrl);
      if (!pdfResponse.ok) {
        throw new Error('Erreur lors du téléchargement du PDF');
      }

      const pdfBlob = await pdfResponse.blob();
      const formData = new FormData();
      formData.append('file', pdfBlob, pendingUpload.original_filename);

      // Call the analyze-customs-receipt edge function
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        'analyze-customs-receipt',
        { body: formData }
      );

      if (analysisError) {
        console.error('Analysis error:', analysisError);
        throw new Error('Erreur lors de l\'analyse OCR');
      }

      const extracted: CustomsReceiptData = {
        quittanceType: analysisResult.quittanceType || 'droits_taxes_importation',
        customsOffice: analysisResult.customsOffice || '',
        documentNumber: analysisResult.documentNumber || '',
        documentDate: analysisResult.documentDate || new Date().toISOString().split('T')[0],
        totalAmount: analysisResult.totalAmount || 0,
        customsDeclarationNumber: analysisResult.customsDeclarationNumber || '',
        importerName: analysisResult.importerName || '',
      };

      setExtractedData(extracted);
      toast.success('Données extraites avec succès');
    } catch (err) {
      console.error('OCR extraction error:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      toast.error('Erreur lors de l\'extraction des données');
      
      // Provide default fallback data
      setExtractedData({
        quittanceType: pendingUpload.quittance_type || 'droits_taxes_importation',
        customsOffice: pendingUpload.customs_office || '',
        documentNumber: pendingUpload.document_number || '',
        documentDate: pendingUpload.document_date || new Date().toISOString().split('T')[0],
        totalAmount: pendingUpload.total_amount || 0,
        customsDeclarationNumber: pendingUpload.customs_declaration_number || '',
        importerName: pendingUpload.importer_name || '',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContinue = () => {
    if (extractedData) {
      onExtractionComplete(extractedData);
    }
  };

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

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isFr ? 'Extraction OCR - Quittance douanière' : 'OCR Extraction - Customs Receipt'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileSearch className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-medium">{isFr ? 'Analyse en cours...' : 'Analyzing...'}</p>
                <p className="text-sm text-muted-foreground">
                  {isFr 
                    ? 'Extraction des données de la quittance douanière' 
                    : 'Extracting customs receipt data'}
                </p>
              </div>
            </div>
          )}

          {error && !isAnalyzing && (
            <div className="flex items-center gap-3 p-4 border border-orange-200 bg-orange-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-orange-700">
                  {isFr ? 'Avertissement' : 'Warning'}
                </p>
                <p className="text-sm text-orange-600">{error}</p>
                <p className="text-sm text-orange-600 mt-1">
                  {isFr 
                    ? 'Des valeurs par défaut ont été utilisées. Vous pourrez les modifier à l\'étape suivante.' 
                    : 'Default values were used. You can modify them in the next step.'}
                </p>
              </div>
            </div>
          )}

          {extractedData && !isAnalyzing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  {isFr ? 'Données extraites' : 'Extracted data'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'Type de quittance' : 'Receipt type'}
                  </p>
                  <Badge className="mt-1 bg-amber-500/10 text-amber-700">
                    {getQuittanceTypeLabel(extractedData.quittanceType)}
                  </Badge>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'Bureau des douanes' : 'Customs office'}
                  </p>
                  <p className="font-medium">{extractedData.customsOffice || '—'}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'N° Quittance' : 'Receipt number'}
                  </p>
                  <p className="font-mono font-medium">{extractedData.documentNumber || '—'}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'Date' : 'Date'}
                  </p>
                  <p className="font-medium">{extractedData.documentDate || '—'}</p>
                </div>

                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'Montant total' : 'Total amount'}
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {formatAmount(extractedData.totalAmount)}
                  </p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'N° Déclaration' : 'Declaration number'}
                  </p>
                  <p className="font-mono font-medium">
                    {extractedData.customsDeclarationNumber || '—'}
                  </p>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg col-span-2">
                  <p className="text-xs text-muted-foreground">
                    {isFr ? 'Raison sociale importateur' : 'Importer name'}
                  </p>
                  <p className="font-medium">{extractedData.importerName || '—'}</p>
                </div>
              </div>

              <Button onClick={handleContinue} className="w-full mt-4">
                {isFr ? 'Continuer vers la validation' : 'Continue to validation'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
