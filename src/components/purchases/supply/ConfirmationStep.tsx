import React, { useRef, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2,
  Package,
  FileText,
  Truck,
  Globe,
  Printer,
  Download,
  Building,
  User,
  Calendar,
  Hash,
  Banknote,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { ConfirmedPurchase } from './TotalsStep';
import { VerifiedProduct } from './ProductVerificationStep';

interface ConfirmationStepProps {
  confirmedPurchase: ConfirmedPurchase;
  verifiedProducts: VerifiedProduct[];
  onNewPurchase: () => void;
  onBack: () => void;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  confirmedPurchase,
  verifiedProducts,
  onNewPurchase,
  onBack,
}) => {
  const { t, isRTL, language } = useLanguage();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Calculate VAT breakdown
  const vatBreakdown = useMemo(() => {
    const breakdown: Record<number, { baseHt: number; vatAmount: number }> = {};
    
    verifiedProducts.forEach(vp => {
      const pd = vp.productDetails;
      const rate = pd.vat_rate || 0;
      const lineHt = pd.line_total_ht || (pd.unit_price_ht * pd.quantity);
      const lineVat = pd.line_vat || (lineHt * (rate / 100));
      
      if (!breakdown[rate]) {
        breakdown[rate] = { baseHt: 0, vatAmount: 0 };
      }
      breakdown[rate].baseHt += lineHt;
      breakdown[rate].vatAmount += lineVat;
    });
    
    return Object.entries(breakdown)
      .map(([rate, data]) => ({
        rate: parseFloat(rate),
        ...data,
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [verifiedProducts]);
  
  // Format amount with currency
  const formatAmount = (amount: number, currency: string = confirmedPurchase.currency): string => {
    const formatted = amount.toLocaleString('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    if (currency === 'TND') return `${formatted} DT`;
    return `${formatted} ${currency}`;
  };
  
  // Format date
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'fr-TN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };
  
  // Get purchase type badge
  const getPurchaseTypeBadge = () => {
    if (confirmedPurchase.supplierType === 'foreign') {
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
  
  // Handle print
  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(t('purchase_popup_blocked'));
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${language}" dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${t('purchase_receipt_title')} - ${confirmedPurchase.invoiceNumber || confirmedPurchase.id.slice(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 20px;
            color: #333;
            line-height: 1.5;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
            margin-bottom: 20px; 
          }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header .subtitle { color: #666; font-size: 14px; }
          .badge { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: 600;
            margin-top: 10px;
          }
          .badge-local { background: #d1fae5; color: #047857; }
          .badge-import { background: #ede9fe; color: #7c3aed; }
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px; 
            margin-bottom: 30px; 
          }
          .info-box { 
            border: 1px solid #e5e7eb; 
            padding: 15px; 
            border-radius: 8px; 
          }
          .info-box h3 { 
            font-size: 12px; 
            text-transform: uppercase; 
            color: #6b7280; 
            margin-bottom: 8px; 
          }
          .info-box p { font-size: 14px; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px; 
          }
          th, td { 
            border: 1px solid #e5e7eb; 
            padding: 10px; 
            text-align: ${isRTL ? 'right' : 'left'}; 
          }
          th { 
            background: #f9fafb; 
            font-weight: 600; 
            font-size: 12px; 
            text-transform: uppercase; 
          }
          td { font-size: 13px; }
          .totals-table { width: 50%; margin-${isRTL ? 'right' : 'left'}: auto; }
          .totals-table td:first-child { text-align: ${isRTL ? 'left' : 'right'}; }
          .totals-table td:last-child { font-weight: 600; }
          .total-row { background: #f3f4f6; }
          .grand-total { background: #3b82f6; color: white; font-size: 16px; }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            display: flex; 
            justify-content: space-between; 
          }
          .signature-box { 
            width: 200px; 
            text-align: center; 
          }
          .signature-line { 
            border-bottom: 1px solid #333; 
            margin-top: 50px; 
            margin-bottom: 5px; 
          }
          .signature-label { font-size: 12px; color: #666; }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${t('purchase_receipt_title')}</h1>
          <p class="subtitle">${t('purchase_receipt_number')}: ${confirmedPurchase.id.slice(0, 8).toUpperCase()}</p>
          <span class="badge ${confirmedPurchase.supplierType === 'foreign' ? 'badge-import' : 'badge-local'}">
            ${confirmedPurchase.supplierType === 'foreign' ? t('purchase_importation') : t('purchase_local_purchase')}
          </span>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <h3>${t('purchase_supplier')}</h3>
            <p><strong>${confirmedPurchase.supplierName}</strong></p>
          </div>
          <div class="info-box">
            <h3>${t('purchase_invoice_info')}</h3>
            <p>${t('purchase_invoice_number')}: ${confirmedPurchase.invoiceNumber || '-'}</p>
            <p>${t('purchase_invoice_date')}: ${formatDate(confirmedPurchase.invoiceDate)}</p>
            <p>${t('purchase_currency')}: ${confirmedPurchase.currency}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${t('purchase_reference')}</th>
              <th>${t('purchase_designation')}</th>
              <th>${t('purchase_quantity')}</th>
              <th>${t('purchase_unit_price_ht')}</th>
              <th>${t('purchase_vat_rate')}</th>
              <th>${t('purchase_total_ht')}</th>
            </tr>
          </thead>
          <tbody>
            ${verifiedProducts.map((vp, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${vp.productDetails.reference || '-'}</td>
                <td>${vp.productDetails.name}</td>
                <td>${vp.productDetails.quantity}</td>
                <td>${formatAmount(vp.productDetails.unit_price_ht)}</td>
                <td>${vp.productDetails.vat_rate || 0}%</td>
                <td>${formatAmount(vp.productDetails.line_total_ht || (vp.productDetails.unit_price_ht * vp.productDetails.quantity))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <table class="totals-table">
          <tbody>
            <tr>
              <td>${t('purchase_subtotal_ht')}</td>
              <td>${formatAmount(confirmedPurchase.subtotalHt)}</td>
            </tr>
            ${vatBreakdown.map(vat => `
              <tr>
                <td>${t('purchase_vat')} ${vat.rate}%</td>
                <td>${formatAmount(vat.vatAmount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>${t('purchase_total_ttc')}</td>
              <td>${formatAmount(confirmedPurchase.totalTtc)}</td>
            </tr>
            ${confirmedPurchase.stampDutyAmount > 0 ? `
              <tr>
                <td>${t('purchase_stamp_duty')}</td>
                <td>${formatAmount(confirmedPurchase.stampDutyAmount)}</td>
              </tr>
            ` : ''}
            <tr class="grand-total">
              <td>${t('purchase_net_payable')}</td>
              <td>${formatAmount(confirmedPurchase.netPayable)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <div class="signature-box">
            <div class="signature-line"></div>
            <span class="signature-label">${t('purchase_supplier_signature')}</span>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <span class="signature-label">${t('purchase_receiver_signature')}</span>
          </div>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
  
  // Handle download as HTML (simple approach without external library)
  const handleDownload = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}" dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${t('purchase_receipt_title')} - ${confirmedPurchase.invoiceNumber || confirmedPurchase.id.slice(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
          .header h1 { font-size: 28px; margin-bottom: 10px; }
          .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; }
          .badge-local { background: #d1fae5; color: #047857; }
          .badge-import { background: #ede9fe; color: #7c3aed; }
          .info-section { display: flex; gap: 40px; margin-bottom: 30px; }
          .info-box { flex: 1; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
          .info-box h3 { font-size: 14px; color: #666; margin-bottom: 10px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #f5f5f5; font-size: 13px; }
          .totals { width: 40%; margin-left: auto; }
          .grand-total { background: #3b82f6; color: white; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${t('purchase_receipt_title')}</h1>
          <p>${t('purchase_receipt_number')}: ${confirmedPurchase.id.slice(0, 8).toUpperCase()}</p>
          <span class="badge ${confirmedPurchase.supplierType === 'foreign' ? 'badge-import' : 'badge-local'}">
            ${confirmedPurchase.supplierType === 'foreign' ? t('purchase_importation') : t('purchase_local_purchase')}
          </span>
        </div>
        
        <div class="info-section">
          <div class="info-box">
            <h3>${t('purchase_supplier')}</h3>
            <p><strong>${confirmedPurchase.supplierName}</strong></p>
          </div>
          <div class="info-box">
            <h3>${t('purchase_invoice_info')}</h3>
            <p>${t('purchase_invoice_number')}: ${confirmedPurchase.invoiceNumber || '-'}</p>
            <p>${t('purchase_invoice_date')}: ${formatDate(confirmedPurchase.invoiceDate)}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${t('purchase_reference')}</th>
              <th>${t('purchase_designation')}</th>
              <th>${t('purchase_quantity')}</th>
              <th>${t('purchase_unit_price_ht')}</th>
              <th>${t('purchase_vat_rate')}</th>
              <th>${t('purchase_total_ht')}</th>
            </tr>
          </thead>
          <tbody>
            ${verifiedProducts.map((vp, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${vp.productDetails.reference || '-'}</td>
                <td>${vp.productDetails.name}</td>
                <td>${vp.productDetails.quantity}</td>
                <td>${formatAmount(vp.productDetails.unit_price_ht)}</td>
                <td>${vp.productDetails.vat_rate || 0}%</td>
                <td>${formatAmount(vp.productDetails.line_total_ht || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <table class="totals">
          <tr><td>${t('purchase_subtotal_ht')}</td><td>${formatAmount(confirmedPurchase.subtotalHt)}</td></tr>
          <tr><td>${t('purchase_total_vat')}</td><td>${formatAmount(confirmedPurchase.totalVat)}</td></tr>
          <tr><td>${t('purchase_total_ttc')}</td><td>${formatAmount(confirmedPurchase.totalTtc)}</td></tr>
          <tr class="grand-total"><td>${t('purchase_net_payable')}</td><td>${formatAmount(confirmedPurchase.netPayable)}</td></tr>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bon-reception-${confirmedPurchase.invoiceNumber || confirmedPurchase.id.slice(0, 8)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const newProductsCount = verifiedProducts.filter(vp => vp.decision === 'create_new').length;
  const existingProductsCount = verifiedProducts.length - newProductsCount;
  
  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="bg-emerald-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {t('purchase_confirmed')}
              </CardTitle>
              <CardDescription>
                {t('purchase_confirmation_description')}
              </CardDescription>
            </div>
          </div>
          {getPurchaseTypeBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Receipt Preview Reference (hidden but used for printing) */}
        <div ref={receiptRef} className="hidden" />
        
        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            {t('purchase_print_receipt')}
          </Button>
          <Button onClick={handleDownload} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {t('purchase_download_receipt')}
          </Button>
          {confirmedPurchase.pdfUrl && (
            <Button 
              onClick={() => window.open(confirmedPurchase.pdfUrl!, '_blank')} 
              variant="outline" 
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {t('purchase_view_original_pdf')}
            </Button>
          )}
        </div>
        
        <Separator />
        
        {/* Summary grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building className="h-4 w-4" />
              <span className="text-xs">{t('purchase_supplier')}</span>
            </div>
            <p className="font-medium truncate">{confirmedPurchase.supplierName}</p>
          </div>
          
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Hash className="h-4 w-4" />
              <span className="text-xs">{t('purchase_invoice_number')}</span>
            </div>
            <p className="font-medium">{confirmedPurchase.invoiceNumber || '-'}</p>
          </div>
          
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">{t('purchase_invoice_date')}</span>
            </div>
            <p className="font-medium">{formatDate(confirmedPurchase.invoiceDate)}</p>
          </div>
          
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs">{t('purchase_products')}</span>
            </div>
            <p className="font-medium">{confirmedPurchase.productCount}</p>
          </div>
        </div>
        
        {/* Products summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            {t('purchase_products_summary')}
          </h4>
          <div className="flex gap-3">
            {existingProductsCount > 0 && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                {existingProductsCount} {t('purchase_stock_updated')}
              </Badge>
            )}
            {newProductsCount > 0 && (
              <Badge variant="outline" className="bg-sky-500/10 text-sky-700 border-sky-500/30">
                {newProductsCount} {t('purchase_products_created')}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Products table */}
        <ScrollArea className="max-h-[300px]">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-start p-3 font-medium">#</th>
                  <th className="text-start p-3 font-medium">{t('purchase_reference')}</th>
                  <th className="text-start p-3 font-medium">{t('purchase_designation')}</th>
                  <th className="text-end p-3 font-medium">{t('purchase_quantity')}</th>
                  <th className="text-end p-3 font-medium">{t('purchase_unit_price')}</th>
                  <th className="text-end p-3 font-medium">{t('purchase_total_ht')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {verifiedProducts.map((vp, index) => (
                  <tr key={index} className="hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground">{index + 1}</td>
                    <td className="p-3">{vp.productDetails.reference || '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{vp.productDetails.name}</span>
                        {vp.decision === 'create_new' && (
                          <Badge variant="outline" className="text-xs bg-sky-500/10 text-sky-600">
                            {t('purchase_new')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-end">{vp.productDetails.quantity}</td>
                    <td className="p-3 text-end">{formatAmount(vp.productDetails.unit_price_ht)}</td>
                    <td className="p-3 text-end font-medium">
                      {formatAmount(vp.productDetails.line_total_ht || (vp.productDetails.unit_price_ht * vp.productDetails.quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
        
        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full md:w-1/2 lg:w-2/5 border rounded-lg overflow-hidden">
            <div className="divide-y">
              <div className="flex justify-between p-3">
                <span className="text-muted-foreground">{t('purchase_subtotal_ht')}</span>
                <span className="font-medium">{formatAmount(confirmedPurchase.subtotalHt)}</span>
              </div>
              
              {vatBreakdown.map((vat, index) => (
                <div key={index} className="flex justify-between p-3">
                  <span className="text-muted-foreground">{t('purchase_vat')} {vat.rate}%</span>
                  <span className="font-medium">{formatAmount(vat.vatAmount)}</span>
                </div>
              ))}
              
              <div className="flex justify-between p-3 bg-muted/30">
                <span className="font-medium">{t('purchase_total_ttc')}</span>
                <span className="font-bold">{formatAmount(confirmedPurchase.totalTtc)}</span>
              </div>
              
              {confirmedPurchase.stampDutyAmount > 0 && (
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">{t('purchase_stamp_duty')}</span>
                  <span className="font-medium">{formatAmount(confirmedPurchase.stampDutyAmount)}</span>
                </div>
              )}
              
              <div className="flex justify-between p-4 bg-primary/10">
                <span className="font-bold text-primary">{t('purchase_net_payable')}</span>
                <span className="font-bold text-lg text-primary">{formatAmount(confirmedPurchase.netPayable)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Footer actions */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('purchase_back')}
          </Button>
          <Button onClick={onNewPurchase} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('purchase_new_purchase')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
