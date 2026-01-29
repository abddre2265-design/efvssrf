import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { LocalPurchaseWorkflowStep, LocalPurchaseWorkflowData, PendingUploadForProcessing } from './types';
import { LocalPurchaseWorkflowStepper } from './LocalPurchaseWorkflowStepper';
import { TransferStep } from './TransferStep';
import { FamilyAssignmentStep } from './FamilyAssignmentStep';
import { CompletionStep } from './CompletionStep';

// Import from supply workflow for reuse
import { SupplierIdentificationStep } from '../supply/SupplierIdentificationStep';
import { ProductsAnalysisStep } from '../supply/ProductsAnalysisStep';
import { ProductDetailsStep, ProductDetailData } from '../supply/ProductDetailsStep';
import { CurrencySelectionStep } from './CurrencySelectionStep';

interface LocalPurchaseWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUpload: PendingUploadForProcessing;
  organizationId: string;
  onComplete: () => void;
}

export const LocalPurchaseWorkflowDialog: React.FC<LocalPurchaseWorkflowDialogProps> = ({
  open,
  onOpenChange,
  pendingUpload,
  organizationId,
  onComplete,
}) => {
  const { isRTL } = useLanguage();
  const [currentStep, setCurrentStep] = useState<LocalPurchaseWorkflowStep>('transfer');
  
  // Default extracted totals
  const defaultExtractedTotals = {
    subtotal_ht: 0,
    total_vat: 0,
    total_discount: 0,
    ht_after_discount: 0,
    total_ttc: 0,
    stamp_duty_amount: 0,
    net_payable: 0,
    currency: 'TND',
    vat_breakdown: [],
  };

  // Workflow data
  const [workflowData, setWorkflowData] = useState<LocalPurchaseWorkflowData>({
    pendingUploadId: pendingUpload.id,
    storagePath: pendingUpload.storage_path,
    originalFilename: pendingUpload.original_filename,
    pdfUrl: null,
    pdfHash: null,
    documentType: (pendingUpload.document_type as 'local_purchase' | 'import') || 'local_purchase',
    documentCategory: pendingUpload.document_category || null,
    importFolderId: pendingUpload.import_folder_id || null,
    importFolderNumber: pendingUpload.import_folder_number || null,
    extractedSupplier: null,
    extractedProducts: [],
    extractedTotals: defaultExtractedTotals,
    invoiceNumber: pendingUpload.document_number,
    invoiceDate: pendingUpload.document_date,
    supplierId: null,
    supplierType: null,
    supplierName: null,
    currency: 'TND',
    exchangeRate: 1.0,
    productDetails: [],
    verifiedProducts: [],
    subtotalHt: 0,
    totalVat: 0,
    totalDiscount: 0,
    totalTtc: 0,
    stampDutyAmount: 0,
    netPayable: 0,
    documentFamilyId: null,
    documentFamilyName: null,
    creationMode: null,
    purchaseDocumentId: null,
  });

  // Dynamic step order based on supplier type
  const getStepOrder = (): LocalPurchaseWorkflowStep[] => {
    const baseSteps: LocalPurchaseWorkflowStep[] = ['transfer', 'supplier'];
    
    // Add currency step only for foreign suppliers
    if (workflowData.supplierType === 'foreign') {
      baseSteps.push('currency' as LocalPurchaseWorkflowStep);
    }
    
    baseSteps.push('products', 'product_details', 'totals', 'family', 'complete');
    return baseSteps;
  };

  const stepOrder = getStepOrder();

  const currentStepIndex = stepOrder.indexOf(currentStep);

  // Navigation helpers
  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextIndex]);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(stepOrder[prevIndex]);
    }
  };

  // Handle analysis complete (saves data but doesn't navigate)
  const handleAnalysisComplete = (data: Partial<LocalPurchaseWorkflowData>) => {
    setWorkflowData(prev => ({ ...prev, ...data }));
  };

  // Handle supplier confirmed
  const handleSupplierConfirmed = async (
    supplierId: string, 
    isNew: boolean, 
    supplierType?: 'individual_local' | 'business_local' | 'foreign'
  ) => {
    // Get supplier name
    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('company_name, first_name, last_name')
      .eq('id', supplierId)
      .single();

    const supplierName = supplierData?.company_name || 
      `${supplierData?.first_name || ''} ${supplierData?.last_name || ''}`.trim() ||
      'Fournisseur inconnu';

    setWorkflowData(prev => ({
      ...prev,
      supplierId,
      supplierType: supplierType || 'individual_local',
      supplierName,
    }));
    goToNextStep();
    toast.success(isNew ? 'Fournisseur créé et assigné' : 'Fournisseur assigné');
  };

  // Handle currency confirmed (for foreign suppliers)
  const handleCurrencyConfirmed = (currency: string, exchangeRate: number) => {
    setWorkflowData(prev => ({
      ...prev,
      currency,
      exchangeRate,
    }));
    goToNextStep();
    toast.success('Devise et taux de change confirmés');
  };

  // Handle products confirmed
  const handleProductsConfirmed = (products: any[], currency: string, exchangeRate: number) => {
    setWorkflowData(prev => ({
      ...prev,
      extractedProducts: products,
      currency,
      exchangeRate,
    }));
    goToNextStep();
    toast.success('Analyse des produits confirmée');
  };

  // Handle product details confirmed
  const handleProductDetailsConfirmed = (productDetails: ProductDetailData[]) => {
    // Create verified products from product details
    const verifiedProducts = productDetails.map((pd) => ({
      productDetails: pd,
      decision: 'create_new',
      existingProductId: null,
    }));
    
    setWorkflowData(prev => ({
      ...prev,
      productDetails,
      verifiedProducts,
    }));
    goToNextStep();
    toast.success('Détails des produits confirmés');
  };

  // Handle totals confirmed
  const handleTotalsConfirmed = (confirmedData: any) => {
    setWorkflowData(prev => ({
      ...prev,
      subtotalHt: confirmedData.subtotalHt,
      totalVat: confirmedData.totalVat,
      totalDiscount: confirmedData.totalDiscount,
      totalTtc: confirmedData.totalTtc,
      stampDutyAmount: confirmedData.stampDutyAmount,
      netPayable: confirmedData.netPayable,
    }));
    goToNextStep();
  };

  // Handle family confirmed
  const handleFamilyConfirmed = (familyId: string | null, familyName: string | null) => {
    setWorkflowData(prev => ({
      ...prev,
      documentFamilyId: familyId,
      documentFamilyName: familyName,
    }));
    goToNextStep();
  };

  // Handle complete
  const handleComplete = (mode: 'without_supply' | 'with_supply', purchaseDocId: string) => {
    setWorkflowData(prev => ({
      ...prev,
      creationMode: mode,
      purchaseDocumentId: purchaseDocId,
    }));
    onComplete();
    onOpenChange(false);
  };

  const handleClose = () => {
    if (currentStep !== 'transfer') {
      if (!confirm('Voulez-vous vraiment fermer ? Les données non sauvegardées seront perdues.')) {
        return;
      }
    }
    onOpenChange(false);
  };

  // Check if we can proceed from current step
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'transfer':
        return true; // Always allow - user can skip analysis
      case 'supplier':
        return !!workflowData.supplierId;
      case 'currency':
        return true; // Currency has default values
      case 'products':
        return true; // Products are optional
      case 'product_details':
        return true; // Details are optional
      case 'totals':
        return true; // Totals calculated automatically
      case 'family':
        return true; // Family is optional
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0 flex flex-row items-center justify-between border-b">
          <DialogTitle className="text-xl">
            Traitement d'achat local
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Stepper */}
        <div className="px-6 py-2 border-b bg-muted/30 flex-shrink-0">
          <LocalPurchaseWorkflowStepper currentStep={currentStep} />
        </div>

        {/* Content - Scrollable area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-6 py-4">
              {currentStep === 'transfer' && (
                <TransferStep
                  pendingUpload={pendingUpload}
                  organizationId={organizationId}
                  onAnalysisComplete={handleAnalysisComplete}
                  onContinue={goToNextStep}
                />
              )}

              {currentStep === 'supplier' && (
                <SupplierIdentificationStep
                  extractedSupplier={workflowData.extractedSupplier}
                  organizationId={organizationId}
                  onSupplierConfirmed={handleSupplierConfirmed}
                />
              )}

              {currentStep === 'currency' && workflowData.supplierType === 'foreign' && (
                <CurrencySelectionStep
                  organizationId={organizationId}
                  defaultCurrency={workflowData.currency}
                  onCurrencyConfirmed={handleCurrencyConfirmed}
                />
              )}

              {currentStep === 'products' && workflowData.supplierId && (
                <ProductsAnalysisStep
                  extractedProducts={workflowData.extractedProducts || []}
                  extractedTotals={workflowData.extractedTotals || defaultExtractedTotals}
                  supplierId={workflowData.supplierId}
                  organizationId={organizationId}
                  onProductsConfirmed={handleProductsConfirmed}
                />
              )}

              {currentStep === 'product_details' && (
                <ProductDetailsStep
                  extractedProducts={workflowData.extractedProducts}
                  invoiceDate={workflowData.invoiceDate}
                  organizationId={organizationId}
                  currency={workflowData.currency}
                  exchangeRate={workflowData.exchangeRate}
                  isForeignSupplier={workflowData.supplierType === 'foreign'}
                  onProductsDetailsConfirmed={handleProductDetailsConfirmed}
                />
              )}

              {currentStep === 'totals' && (
                <SimplifiedTotalsStep
                  workflowData={workflowData}
                  onConfirm={handleTotalsConfirmed}
                />
              )}

              {currentStep === 'family' && (
                <FamilyAssignmentStep
                  organizationId={organizationId}
                  onFamilyConfirmed={handleFamilyConfirmed}
                />
              )}

              {currentStep === 'complete' && (
                <CompletionStep
                  workflowData={workflowData}
                  organizationId={organizationId}
                  pendingUploadId={pendingUpload.id}
                  onComplete={handleComplete}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer with navigation */}
        <div className="px-6 py-4 border-t bg-background flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              {currentStepIndex > 0 && currentStep !== 'complete' && (
                <Button
                  variant="outline"
                  onClick={goToPreviousStep}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Précédent
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Show Continue button for steps that don't have their own navigation */}
              {currentStep === 'transfer' && (
                <Button onClick={goToNextStep} className="gap-2">
                  Continuer
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              
              {currentStep === 'products' && !workflowData.supplierId && (
                <Button onClick={goToNextStep} className="gap-2">
                  Passer cette étape
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Simplified totals step for this workflow
const SimplifiedTotalsStep: React.FC<{
  workflowData: LocalPurchaseWorkflowData;
  onConfirm: (data: any) => void;
}> = ({ workflowData, onConfirm }) => {
  const { isRTL } = useLanguage();
  
  // Calculate totals from product details (or use extracted totals)
  const calculateTotals = () => {
    let subtotalHt = 0;
    let totalVat = 0;
    let totalDiscount = 0;
    let totalTtc = 0;

    // Use productDetails if available (more reliable), otherwise use verifiedProducts
    const products = workflowData.productDetails.length > 0 
      ? workflowData.productDetails 
      : workflowData.verifiedProducts.map((vp: any) => vp.productDetails);

    products.forEach((pd: any) => {
      if (!pd) return;
      subtotalHt += pd.line_total_ht || 0;
      totalVat += pd.line_vat || 0;
      totalTtc += pd.line_total_ttc || 0;
      const discountAmt = pd.discount_percent > 0 
        ? ((pd.unit_price_ht || 0) * (pd.quantity || 1) * (pd.discount_percent || 0) / 100) 
        : 0;
      totalDiscount += discountAmt;
    });

    // Use extracted totals if available and products are empty
    const extracted = workflowData.extractedTotals;
    const stampDuty = extracted?.stamp_duty_amount || 0;
    
    // If no products calculated, use extracted values
    if (subtotalHt === 0 && extracted?.subtotal_ht) {
      subtotalHt = extracted.subtotal_ht || 0;
      totalVat = extracted.total_vat || 0;
      totalDiscount = extracted.total_discount || 0;
      totalTtc = extracted.total_ttc || 0;
    }

    const netPayable = (extracted?.net_payable || totalTtc) + stampDuty;

    return {
      subtotalHt,
      totalVat,
      totalDiscount,
      totalTtc,
      stampDutyAmount: stampDuty,
      netPayable,
    };
  };

  const totals = calculateTotals();

  const formatAmount = (amount: number): string => {
    return (amount || 0).toLocaleString('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + ' TND';
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p-6 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Récapitulatif des totaux</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Total HT</span>
            <span className="font-medium">{formatAmount(totals.subtotalHt)}</span>
          </div>
          
          {totals.totalDiscount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Remise totale</span>
              <span className="font-medium text-orange-600">-{formatAmount(totals.totalDiscount)}</span>
            </div>
          )}
          
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">TVA</span>
            <span className="font-medium">{formatAmount(totals.totalVat)}</span>
          </div>
          
          <div className="flex justify-between py-2 border-t pt-3">
            <span className="font-medium">Total TTC</span>
            <span className="font-bold text-lg">{formatAmount(totals.totalTtc)}</span>
          </div>
          
          {totals.stampDutyAmount > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Timbre fiscal</span>
              <span className="font-medium">{formatAmount(totals.stampDutyAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between py-3 bg-primary/10 rounded-lg px-3 mt-2">
            <span className="font-bold text-primary">Net à payer</span>
            <span className="font-bold text-xl text-primary">{formatAmount(totals.netPayable)}</span>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={() => onConfirm(totals)} className="gap-2">
            Confirmer et continuer
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
