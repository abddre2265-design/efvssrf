import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calculator,
  CheckCircle2,
  Package,
  Loader2,
  ArrowRight,
  FileText,
  Truck,
  Globe
} from 'lucide-react';
import { VerifiedProduct } from './ProductVerificationStep';
import { ExtractionResult } from './types';

// VAT breakdown for display
interface VATBreakdownDisplay {
  rate: number;
  baseHt: number;
  vatAmount: number;
}

// Confirmed purchase data to be added to the list
export interface ConfirmedPurchase {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierType: 'individual_local' | 'business_local' | 'foreign';
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string;
  exchangeRate: number;
  subtotalHt: number;
  totalVat: number;
  totalDiscount: number;
  totalTtc: number;
  stampDutyAmount: number;
  netPayable: number;
  productCount: number;
  pdfUrl: string | null;
  pdfHash: string | null;
  createdAt: string;
}

interface TotalsStepProps {
  verifiedProducts: VerifiedProduct[];
  extractionResult: ExtractionResult;
  supplierId: string;
  supplierType: 'individual_local' | 'business_local' | 'foreign';
  organizationId: string;
  currency: string;
  exchangeRate: number;
  pdfUrl: string | null;
  pdfHash: string | null;
  onConfirm: (confirmedPurchase: ConfirmedPurchase) => void;
}

export const TotalsStep: React.FC<TotalsStepProps> = ({
  verifiedProducts,
  extractionResult,
  supplierId,
  supplierType,
  organizationId,
  currency,
  exchangeRate,
  pdfUrl,
  pdfHash,
  onConfirm,
}) => {
  const { t, isRTL } = useLanguage();
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Calculate totals from verified products
  const calculatedTotals = useMemo(() => {
    let subtotalHt = 0;
    let totalVat = 0;
    let totalDiscount = 0;
    let totalTtc = 0;
    const vatBreakdown: Record<number, { baseHt: number; vatAmount: number }> = {};
    
    verifiedProducts.forEach(vp => {
      const pd = vp.productDetails;
      const lineHt = pd.line_total_ht || (pd.unit_price_ht * pd.quantity);
      const lineVat = pd.line_vat || (lineHt * (pd.vat_rate / 100));
      const lineTtc = pd.line_total_ttc || (lineHt + lineVat);
      const lineDiscount = pd.discount_percent > 0 ? (pd.unit_price_ht * pd.quantity * pd.discount_percent / 100) : 0;
      
      subtotalHt += lineHt;
      totalVat += lineVat;
      totalTtc += lineTtc;
      totalDiscount += lineDiscount;
      
      // VAT breakdown
      const rate = pd.vat_rate || 0;
      if (!vatBreakdown[rate]) {
        vatBreakdown[rate] = { baseHt: 0, vatAmount: 0 };
      }
      vatBreakdown[rate].baseHt += lineHt;
      vatBreakdown[rate].vatAmount += lineVat;
    });
    
    // Use extracted totals if available and different
    const extracted = extractionResult.totals;
    const finalSubtotalHt = extracted.subtotal_ht || subtotalHt;
    const finalTotalVat = extracted.total_vat || totalVat;
    const finalTotalTtc = extracted.total_ttc || totalTtc;
    const finalTotalDiscount = extracted.total_discount || totalDiscount;
    const stampDuty = extracted.stamp_duty_amount || 0;
    const netPayable = extracted.net_payable || (finalTotalTtc + stampDuty);
    
    // Convert VAT breakdown to array
    const vatBreakdownArray: VATBreakdownDisplay[] = Object.entries(vatBreakdown)
      .map(([rate, data]) => ({
        rate: parseFloat(rate),
        baseHt: data.baseHt,
        vatAmount: data.vatAmount,
      }))
      .sort((a, b) => a.rate - b.rate);
    
    return {
      subtotalHt: finalSubtotalHt,
      totalVat: finalTotalVat,
      totalDiscount: finalTotalDiscount,
      totalTtc: finalTotalTtc,
      stampDuty,
      netPayable,
      vatBreakdown: vatBreakdownArray,
    };
  }, [verifiedProducts, extractionResult]);
  
  // Format amount with currency
  const formatAmount = (amount: number): string => {
    const formatted = amount.toLocaleString('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    
    if (currency === 'TND') {
      return `${formatted} DT`;
    }
    return `${formatted} ${currency}`;
  };
  
  // Get purchase type badge
  const getPurchaseTypeBadge = () => {
    if (supplierType === 'foreign') {
      return (
        <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400 gap-1">
          <Globe className="h-3 w-3" />
          {t('purchase_importation')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400 gap-1">
        <Truck className="h-3 w-3" />
        {t('purchase_local_purchase')}
      </Badge>
    );
  };
  
  // Handle confirmation
  const handleConfirm = async () => {
    setIsConfirming(true);
    
    try {
      // Get supplier name
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('company_name, first_name, last_name')
        .eq('id', supplierId)
        .single();
      
      const supplierName = supplierData?.company_name || 
        `${supplierData?.first_name || ''} ${supplierData?.last_name || ''}`.trim() ||
        t('purchase_unknown_supplier');
      
      // Create purchase document
      const { data: purchaseDoc, error: purchaseError } = await supabase
        .from('purchase_documents')
        .insert({
          organization_id: organizationId,
          supplier_id: supplierId,
          invoice_number: extractionResult.invoice_number,
          invoice_date: extractionResult.invoice_date,
          currency,
          exchange_rate: exchangeRate,
          subtotal_ht: calculatedTotals.subtotalHt,
          total_vat: calculatedTotals.totalVat,
          total_discount: calculatedTotals.totalDiscount,
          total_ttc: calculatedTotals.totalTtc,
          stamp_duty_amount: calculatedTotals.stampDuty,
          net_payable: calculatedTotals.netPayable,
          pdf_url: pdfUrl,
          pdf_hash: pdfHash,
          status: 'validated',
          payment_status: 'unpaid',
        })
        .select()
        .single();
      
      if (purchaseError) throw purchaseError;
      
      // Create purchase lines
      const purchaseLines = verifiedProducts.map((vp, index) => ({
        purchase_document_id: purchaseDoc.id,
        product_id: vp.existingProductId,
        reference: vp.productDetails.reference,
        ean: vp.productDetails.ean,
        name: vp.productDetails.name,
        product_type: vp.productDetails.product_type || 'physical',
        quantity: vp.productDetails.quantity,
        unit_price_ht: vp.productDetails.unit_price_ht,
        vat_rate: vp.productDetails.vat_rate,
        discount_percent: vp.productDetails.discount_percent || 0,
        line_total_ht: vp.productDetails.line_total_ht,
        line_vat: vp.productDetails.line_vat,
        line_total_ttc: vp.productDetails.line_total_ttc,
        is_new_product: vp.decision === 'create_new',
        is_existing_product: vp.decision !== 'create_new',
        line_order: index,
      }));
      
      const { error: linesError } = await supabase
        .from('purchase_lines')
        .insert(purchaseLines);
      
      if (linesError) throw linesError;
      
      // Build confirmed purchase object
      const confirmedPurchase: ConfirmedPurchase = {
        id: purchaseDoc.id,
        supplierId,
        supplierName,
        supplierType,
        invoiceNumber: extractionResult.invoice_number,
        invoiceDate: extractionResult.invoice_date,
        currency,
        exchangeRate,
        subtotalHt: calculatedTotals.subtotalHt,
        totalVat: calculatedTotals.totalVat,
        totalDiscount: calculatedTotals.totalDiscount,
        totalTtc: calculatedTotals.totalTtc,
        stampDutyAmount: calculatedTotals.stampDuty,
        netPayable: calculatedTotals.netPayable,
        productCount: verifiedProducts.length,
        pdfUrl,
        pdfHash,
        createdAt: purchaseDoc.created_at,
      };
      
      toast.success(t('purchase_confirmed'));
      onConfirm(confirmedPurchase);
      
    } catch (error) {
      console.error('Confirmation error:', error);
      toast.error(t('purchase_confirmation_error'));
    }
    
    setIsConfirming(false);
  };
  
  const productCount = verifiedProducts.length;
  const newProductsCount = verifiedProducts.filter(vp => vp.decision === 'create_new').length;
  const existingProductsCount = productCount - newProductsCount;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {t('purchase_totals_summary')}
            </CardTitle>
            <CardDescription>
              {t('purchase_totals_description')}
            </CardDescription>
          </div>
          {getPurchaseTypeBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Purchase info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">{t('purchase_invoice_number')}</p>
            <p className="font-medium">{extractionResult.invoice_number || '-'}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">{t('purchase_invoice_date')}</p>
            <p className="font-medium">{extractionResult.invoice_date || '-'}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">{t('purchase_currency')}</p>
            <p className="font-medium">{currency}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">{t('purchase_exchange_rate')}</p>
            <p className="font-medium">{exchangeRate.toFixed(4)}</p>
          </div>
        </div>
        
        {/* Products summary */}
        <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
          <Package className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">{productCount} {t('purchase_products')}</p>
            <div className="flex gap-3 text-sm text-muted-foreground">
              {existingProductsCount > 0 && (
                <span>{existingProductsCount} {t('purchase_existing')}</span>
              )}
              {newProductsCount > 0 && (
                <span>{newProductsCount} {t('purchase_new_created')}</span>
              )}
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* VAT breakdown */}
        {calculatedTotals.vatBreakdown.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              {t('purchase_vat_breakdown')}
            </h4>
            <div className="border rounded-lg divide-y">
              {calculatedTotals.vatBreakdown.map((vat, index) => (
                <div key={index} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{vat.rate}%</Badge>
                    <span className="text-sm text-muted-foreground">
                      {t('purchase_base_ht')}: {formatAmount(vat.baseHt)}
                    </span>
                  </div>
                  <span className="font-medium">{formatAmount(vat.vatAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Totals */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2">
            <h4 className="font-medium">{t('purchase_amounts')}</h4>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between p-4">
              <span className="text-muted-foreground">{t('purchase_subtotal_ht')}</span>
              <span className="font-medium">{formatAmount(calculatedTotals.subtotalHt)}</span>
            </div>
            
            {calculatedTotals.totalDiscount > 0 && (
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">{t('purchase_total_discount')}</span>
                <span className="font-medium text-orange-600">-{formatAmount(calculatedTotals.totalDiscount)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between p-4">
              <span className="text-muted-foreground">{t('purchase_total_vat')}</span>
              <span className="font-medium">{formatAmount(calculatedTotals.totalVat)}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-muted/20">
              <span className="font-medium">{t('purchase_total_ttc')}</span>
              <span className="font-bold text-lg">{formatAmount(calculatedTotals.totalTtc)}</span>
            </div>
            
            {calculatedTotals.stampDuty > 0 && (
              <div className="flex items-center justify-between p-4">
                <span className="text-muted-foreground">{t('purchase_stamp_duty')}</span>
                <span className="font-medium">{formatAmount(calculatedTotals.stampDuty)}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between p-4 bg-primary/5 border-t-2 border-primary">
              <span className="font-bold text-primary">{t('purchase_net_payable')}</span>
              <span className="font-bold text-xl text-primary">{formatAmount(calculatedTotals.netPayable)}</span>
            </div>
          </div>
        </div>
        
        {/* Confirm button */}
        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="gap-2"
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('purchase_confirming')}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {t('purchase_confirm_purchase')}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
