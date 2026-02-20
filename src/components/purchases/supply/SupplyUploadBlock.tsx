import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  FileText,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  XCircle,
  Package,
  Truck,
  Globe,
  Eye,
  Calendar,
  Hash
} from 'lucide-react';
import { UploadedFile, ExtractionResult, AnalysisStatus, ExtractedProduct } from './types';
import { SupplierIdentificationStep } from './SupplierIdentificationStep';
import { ProductsAnalysisStep } from './ProductsAnalysisStep';
import { ProductDetailsStep, ProductDetailData } from './ProductDetailsStep';
import { ProductVerificationStep, VerifiedProduct } from './ProductVerificationStep';
import { TotalsStep, ConfirmedPurchase } from './TotalsStep';
import { ConfirmationStep } from './ConfirmationStep';
import { WorkflowStepper, WorkflowStep } from './WorkflowStepper';

export interface PreloadedPdfData {
  pdfUrl: string | null;
  storagePath: string | null;
  originalFilename: string;
  extractedSupplier: any | null;
  extractedProducts: any[];
  extractedTotals: any;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  exchangeRate: number;
}

interface SupplyUploadBlockProps {
  onRefresh: () => void;
  preloadedPdf?: PreloadedPdfData | null;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const SupplyUploadBlock: React.FC<SupplyUploadBlockProps> = ({
  onRefresh,
  preloadedPdf,
}) => {
  const { t, isRTL } = useLanguage();

  // Build initial state from preloadedPdf if provided
  const initialUploadedFile: UploadedFile | null = preloadedPdf?.pdfUrl
    ? {
        file: new File([], preloadedPdf.originalFilename || 'facture.pdf', { type: 'application/pdf' }),
        url: preloadedPdf.pdfUrl,
        storagePath: preloadedPdf.storagePath,
        status: 'uploaded',
      }
    : null;

  const initialExtractionResult: ExtractionResult | null = preloadedPdf
    ? {
        invoice_number: preloadedPdf.invoiceNumber,
        invoice_date: preloadedPdf.invoiceDate,
        supplier: preloadedPdf.extractedSupplier,
        products: preloadedPdf.extractedProducts || [],
        totals: preloadedPdf.extractedTotals || { subtotal_ht: 0, total_vat: 0, total_discount: 0, ht_after_discount: 0, total_ttc: 0, stamp_duty_amount: 0, net_payable: 0, currency: 'TND', vat_breakdown: [] },
        is_duplicate: false,
        duplicate_reason: null,
      }
    : null;

  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(initialUploadedFile);
  const [isDragging, setIsDragging] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Workflow state - if preloaded, start directly at supplier step
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(preloadedPdf?.pdfUrl ? 'supplier' : 'upload');
  const [confirmedSupplierId, setConfirmedSupplierId] = useState<string | null>(null);
  const [confirmedSupplierType, setConfirmedSupplierType] = useState<'individual_local' | 'business_local' | 'foreign' | null>(null);
  const [confirmedProducts, setConfirmedProducts] = useState<ExtractedProduct[]>(preloadedPdf?.extractedProducts || []);
  const [confirmedCurrency, setConfirmedCurrency] = useState<string>(preloadedPdf?.currency || 'TND');
  const [confirmedExchangeRate, setConfirmedExchangeRate] = useState<number>(preloadedPdf?.exchangeRate || 1.0);
  const [confirmedProductDetails, setConfirmedProductDetails] = useState<ProductDetailData[]>([]);
  const [verifiedProducts, setVerifiedProducts] = useState<VerifiedProduct[]>([]);
  
  // Confirmed purchases list (real-time additions)
  const [confirmedPurchases, setConfirmedPurchases] = useState<ConfirmedPurchase[]>([]);
  
  // Last confirmed purchase for confirmation step
  const [lastConfirmedPurchase, setLastConfirmedPurchase] = useState<ConfirmedPurchase | null>(null);
  
  // Analysis states
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(preloadedPdf?.pdfUrl ? 'success' : 'idle');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(initialExtractionResult);
  const [pdfHash, setPdfHash] = useState<string | null>(null);

  // Load organization on mount
  useEffect(() => {
    const loadOrganization = async () => {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .single();
      if (org) {
        setOrganizationId(org.id);
      }
    };
    loadOrganization();
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (file.type !== 'application/pdf') {
      return { valid: false, error: t('only_pdf_allowed') || 'Seuls les fichiers PDF sont autorisés' };
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: t('file_too_large') || 'Le fichier dépasse 20 Mo' };
    }
    
    return { valid: true };
  };

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploadedFile({
      file,
      url: null,
      storagePath: null,
      status: 'pending',
    });
    
    // Reset analysis state when new file selected
    setAnalysisStatus('idle');
    setExtractionResult(null);
    setPdfHash(null);
    
    toast.success(t('file_selected') || 'Fichier sélectionné');
  }, [t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!uploadedFile || !organizationId) return;

    setUploadedFile(prev => prev ? { ...prev, status: 'uploading' } : null);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const safeName = uploadedFile.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${organizationId}/${timestamp}-${safeName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('purchase-documents')
        .upload(storagePath, uploadedFile.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the file URL (signed URL for private bucket)
      const { data: signedUrlData } = await supabase.storage
        .from('purchase-documents')
        .createSignedUrl(storagePath, 3600); // 1 hour validity

      const fileUrl = signedUrlData?.signedUrl || null;

      setUploadedFile(prev => prev ? { 
        ...prev, 
        status: 'uploaded',
        url: fileUrl,
        storagePath,
      } : null);

      toast.success(t('file_uploaded') || 'Fichier uploadé avec succès');

    } catch (error) {
      console.error('Upload error:', error);
      setUploadedFile(prev => prev ? { 
        ...prev, 
        status: 'error',
        error: t('upload_error') || 'Erreur lors de l\'upload',
      } : null);
      toast.error(t('upload_error') || 'Erreur lors de l\'upload');
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile?.url || !organizationId) {
      toast.error(t('upload_first') || 'Veuillez d\'abord uploader le fichier');
      return;
    }

    setAnalysisStatus('analyzing');

    try {
      const { data, error } = await supabase.functions.invoke('analyze-purchase-pdf', {
        body: {
          pdf_url: uploadedFile.url,
          organization_id: organizationId,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erreur d\'analyse');
      }

      // Store the PDF hash
      if (data.pdf_hash) {
        setPdfHash(data.pdf_hash);
      }

      // Store extraction result (always continue, duplicate check happens at last step)
      setExtractionResult(data.data);
      setAnalysisStatus('success');
      toast.success(t('analysis_complete') || 'Analyse terminée avec succès');

    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisStatus('error');
      toast.error(t('analysis_error') || 'Erreur lors de l\'analyse');
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setAnalysisStatus('idle');
    setExtractionResult(null);
    setPdfHash(null);
    setCurrentStep('upload');
    setConfirmedSupplierId(null);
    setConfirmedSupplierType(null);
    setConfirmedProducts([]);
    setConfirmedCurrency('TND');
    setConfirmedExchangeRate(1.0);
    setConfirmedProductDetails([]);
    setVerifiedProducts([]);
  };

  const handleSupplierConfirmed = (supplierId: string, isNew: boolean, supplierType?: 'individual_local' | 'business_local' | 'foreign') => {
    setConfirmedSupplierId(supplierId);
    setConfirmedSupplierType(supplierType || null);
    setCurrentStep('products');
    toast.success(
      isNew 
        ? (t('supplier_created_and_assigned') || 'Fournisseur créé et assigné')
        : (t('supplier_assigned') || 'Fournisseur assigné')
    );
  };

  const handleProductsConfirmed = (products: ExtractedProduct[], currency: string, exchangeRate: number) => {
    setConfirmedProducts(products);
    setConfirmedCurrency(currency);
    setConfirmedExchangeRate(exchangeRate);
    setCurrentStep('product_details');
    toast.success(t('products_analysis_confirmed') || 'Analyse des produits confirmée');
  };

  const handleProductDetailsConfirmed = (productDetails: ProductDetailData[]) => {
    setConfirmedProductDetails(productDetails);
    setCurrentStep('verification');
    toast.success(t('product_details_confirmed') || 'Détails des produits confirmés');
  };

  const handleVerificationComplete = (verified: VerifiedProduct[]) => {
    setVerifiedProducts(verified);
    setCurrentStep('totals');
    toast.success(t('verification_complete') || 'Vérification des produits terminée');
  };

  const handlePurchaseConfirmed = (confirmedPurchase: ConfirmedPurchase) => {
    // Store the confirmed purchase for the confirmation step
    setLastConfirmedPurchase(confirmedPurchase);
    // Add to the list in real-time
    setConfirmedPurchases(prev => [confirmedPurchase, ...prev]);
    // Move to confirmation step
    setCurrentStep('confirm');
    // Refresh parent data
    onRefresh();
  };

  const handleNewPurchase = () => {
    // Reset the form for a new upload
    clearFile();
    setLastConfirmedPurchase(null);
    setCurrentStep('upload');
  };

  const handleBackFromConfirmation = () => {
    // Go back to totals but keep data
    setCurrentStep('totals');
  };

  const openPdfInNewTab = () => {
    if (uploadedFile?.url) {
      window.open(uploadedFile.url, '_blank');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatAmount = (amount: number, currency: string): string => {
    const formatted = amount.toLocaleString('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    if (currency === 'TND') return `${formatted} DT`;
    return `${formatted} ${currency}`;
  };

  const getPurchaseTypeBadge = (supplierType: 'individual_local' | 'business_local' | 'foreign') => {
    if (supplierType === 'foreign') {
      return (
        <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400 gap-1">
          <Globe className="h-3 w-3" />
          {t('importation') || 'Importation'}
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400 gap-1">
        <Truck className="h-3 w-3" />
        {t('local_purchase') || 'Achat local'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t('supply') || 'Approvisionnement'}
        </CardTitle>
        <CardDescription>
          {t('supply_upload_description') || 'Uploadez une facture PDF pour extraction automatique'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {preloadedPdf?.pdfUrl && currentStep !== 'confirm' && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Document d'achat créé avec succès</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Facture <span className="font-mono font-semibold">{preloadedPdf.originalFilename}</span> prête pour l'approvisionnement. Identifiez le fournisseur pour continuer.
              </p>
            </div>
          </div>
        )}
        {/* Workflow Stepper */}
        <WorkflowStepper
          currentStep={currentStep}
          analysisComplete={analysisStatus === 'success'}
        />
        {/* Upload Zone - hidden when PDF is preloaded from local purchase workflow */}
        {!preloadedPdf?.pdfUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all
            ${isDragging 
              ? 'border-primary bg-primary/10' 
              : uploadedFile 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
            }
          `}
        >
          {uploadedFile ? (
            // File Selected State
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className={`p-3 rounded-full ${
                  uploadedFile.status === 'uploaded' 
                    ? 'bg-green-500/10' 
                    : uploadedFile.status === 'error'
                      ? 'bg-destructive/10'
                      : 'bg-primary/10'
                }`}>
                  {uploadedFile.status === 'uploaded' ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  ) : uploadedFile.status === 'error' ? (
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  ) : uploadedFile.status === 'uploading' ? (
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="text-start">
                  <p className="font-medium text-foreground">{uploadedFile.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(uploadedFile.file.size)}
                    {uploadedFile.status === 'uploading' && (
                      <span className="ml-2 text-primary">
                        {t('uploading') || 'Upload en cours...'}
                      </span>
                    )}
                    {uploadedFile.status === 'uploaded' && (
                      <span className="ml-2 text-green-600">
                        {t('uploaded') || 'Uploadé'}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  disabled={uploadedFile.status === 'uploading' || analysisStatus === 'analyzing'}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {uploadedFile.status === 'error' && uploadedFile.error && (
                <div className="flex items-center justify-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{uploadedFile.error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {uploadedFile.status === 'pending' && (
                  <Button 
                    onClick={handleUpload} 
                    className="gap-2"
                    disabled={!organizationId}
                  >
                    <Upload className="h-4 w-4" />
                    {t('upload') || 'Uploader'}
                  </Button>
                )}

                {uploadedFile.status === 'uploaded' && analysisStatus === 'idle' && (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={openPdfInNewTab}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('view_pdf') || 'Voir le PDF'}
                    </Button>
                    <Button 
                      onClick={handleAnalyze}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      {t('analyze') || 'Analyser'}
                    </Button>
                  </>
                )}

                {analysisStatus === 'analyzing' && (
                  <Button disabled className="gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('analyzing') || 'Analyse en cours...'}
                  </Button>
                )}

                {uploadedFile.status === 'error' && (
                  <Button 
                    onClick={handleUpload} 
                    variant="outline"
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {t('retry') || 'Réessayer'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Empty State - Upload Zone
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleInputChange}
                className="hidden"
              />
              <div className="space-y-3">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {t('drop_or_click') || 'Glissez-déposez ou cliquez pour sélectionner'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('pdf_only_max_20mb') || 'PDF uniquement • Maximum 20 Mo'}
                  </p>
                </div>
              </div>
            </label>
          )}
        </div>
        )}

        {/* Duplicate detection moved to last step (TotalsStep) */}

        {/* Analysis Error Alert */}
        {analysisStatus === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-semibold">
              {t('analysis_error') || 'Erreur d\'analyse'}
            </AlertTitle>
            <AlertDescription>
              {t('analysis_error_description') || 'Une erreur est survenue lors de l\'analyse du document. Veuillez réessayer.'}
              <div className="mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAnalyze}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('retry') || 'Réessayer'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Analysis Success - Move to supplier step */}
        {analysisStatus === 'success' && currentStep === 'upload' && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <AlertTitle className="font-semibold text-green-700 dark:text-green-400">
              {t('analysis_complete') || 'Analyse terminée'}
            </AlertTitle>
            <AlertDescription className="text-green-700/80 dark:text-green-400/80 mt-2">
              {t('analysis_complete_description') || 'Les données ont été extraites avec succès.'}
              <div className="mt-3">
                <Button 
                  onClick={() => setCurrentStep('supplier')}
                  className="gap-2"
                >
                  {t('continue_to_supplier') || 'Continuer vers le fournisseur'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Supplier Identification Step */}
        {currentStep === 'supplier' && organizationId && (
          <SupplierIdentificationStep
            extractedSupplier={extractionResult?.supplier || null}
            organizationId={organizationId}
            onSupplierConfirmed={handleSupplierConfirmed}
          />
        )}

        {/* Products Analysis Step */}
        {currentStep === 'products' && organizationId && confirmedSupplierId && extractionResult && (
          <ProductsAnalysisStep
            extractedProducts={extractionResult.products || []}
            extractedTotals={extractionResult.totals}
            supplierId={confirmedSupplierId}
            organizationId={organizationId}
            onProductsConfirmed={handleProductsConfirmed}
          />
        )}

        {/* Product Details Step */}
        {currentStep === 'product_details' && organizationId && extractionResult && (
          <ProductDetailsStep
            extractedProducts={confirmedProducts}
            invoiceDate={extractionResult.invoice_date}
            organizationId={organizationId}
            currency={confirmedCurrency}
            exchangeRate={confirmedExchangeRate}
            isForeignSupplier={confirmedSupplierType === 'foreign'}
            onProductsDetailsConfirmed={handleProductDetailsConfirmed}
          />
        )}

        {/* Product Verification Step */}
        {currentStep === 'verification' && organizationId && (
          <ProductVerificationStep
            productDetails={confirmedProductDetails}
            organizationId={organizationId}
            onVerificationComplete={handleVerificationComplete}
          />
        )}

        {/* Totals Step */}
        {currentStep === 'totals' && organizationId && extractionResult && confirmedSupplierId && confirmedSupplierType && (
          <TotalsStep
            verifiedProducts={verifiedProducts}
            extractionResult={extractionResult}
            supplierId={confirmedSupplierId}
            supplierType={confirmedSupplierType}
            organizationId={organizationId}
            currency={confirmedCurrency}
            exchangeRate={confirmedExchangeRate}
            pdfUrl={uploadedFile?.url || null}
            pdfHash={pdfHash}
            onConfirm={handlePurchaseConfirmed}
          />
        )}

        {/* Confirmation Step */}
        {currentStep === 'confirm' && lastConfirmedPurchase && (
          <ConfirmationStep
            confirmedPurchase={lastConfirmedPurchase}
            verifiedProducts={verifiedProducts}
            onNewPurchase={handleNewPurchase}
            onBack={handleBackFromConfirmation}
          />
        )}

        {/* Confirmed Purchases List */}
        {confirmedPurchases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5" />
                {t('confirmed_purchases') || 'Approvisionnements confirmés'}
                <Badge variant="secondary">{confirmedPurchases.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-3">
                  {confirmedPurchases.map((purchase, index) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{purchase.supplierName}</span>
                            {getPurchaseTypeBadge(purchase.supplierType)}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            {purchase.invoiceNumber && (
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {purchase.invoiceNumber}
                              </span>
                            )}
                            {purchase.invoiceDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {purchase.invoiceDate}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {purchase.productCount} {t('products') || 'produits'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-end">
                          <p className="font-bold text-lg">
                            {formatAmount(purchase.netPayable, purchase.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('net_payable') || 'Net à payer'}
                          </p>
                        </div>
                        {purchase.pdfUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(purchase.pdfUrl!, '_blank')}
                            title={t('view_pdf') || 'Voir le PDF'}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
