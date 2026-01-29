import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  Package,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ArrowRight,
  Receipt,
  Calculator,
  Banknote,
  AlertTriangle,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreditNoteLine, calculateInvoiceUpdates } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface ProductReturnRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string;
  creditBlocked: number;
  currency: string;
  clientId: string;
  organizationId: string;
  invoiceId: string;
  onSuccess: () => void;
}

interface LineWithProduct extends CreditNoteLine {
  product: {
    id: string;
    name: string;
    reference: string | null;
    product_type: string;
    current_stock: number | null;
    unlimited_stock: boolean;
  } | null;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  total_discount: number;
  stamp_duty_amount: number;
  stamp_duty_enabled: boolean;
  withholding_rate: number;
  withholding_amount: number;
  withholding_applied: boolean;
  net_payable: number;
  paid_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  total_credited: number;
}

interface InvoiceLine {
  id: string;
  product_id: string;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
}

interface LineRestoreData {
  lineId: string;
  maxQuantity: number;
  quantityToRestore: number;
  invoiceLineId: string | null;
}

type Step = 'lines' | 'preview' | 'withholding';

export const ProductReturnRestoreDialog: React.FC<ProductReturnRestoreDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  creditBlocked,
  currency,
  clientId,
  organizationId,
  invoiceId,
  onSuccess,
}) => {
  const { t, isRTL } = useLanguage();
  const [step, setStep] = useState<Step>('lines');
  const [lines, setLines] = useState<LineWithProduct[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [lineRestoreData, setLineRestoreData] = useState<Map<string, LineRestoreData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Withholding options
  const [proposeZeroWithholding, setProposeZeroWithholding] = useState(false);
  const [selectedWithholdingRate, setSelectedWithholdingRate] = useState<number>(0);
  const [showWithholdingChoice, setShowWithholdingChoice] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !creditNoteId || !invoiceId) return;

      setIsLoading(true);
      setStep('lines');
      try {
        // Fetch credit note lines
        const { data: linesData, error: linesError } = await supabase
          .from('credit_note_lines')
          .select(`
            *,
            product:products(id, name, reference, product_type, current_stock, unlimited_stock)
          `)
          .eq('credit_note_id', creditNoteId)
          .eq('stock_restored', false)
          .order('line_order', { ascending: true });

        if (linesError) throw linesError;
        
        const lineData = (linesData || []) as LineWithProduct[];
        setLines(lineData);
        
        // Initialize restore data with full quantities by default
        const initialData = new Map<string, LineRestoreData>();
        lineData.forEach(line => {
          const quantityRestored = (line as any).quantity_restored || 0;
          const remainingQty = line.quantity - quantityRestored;
          initialData.set(line.id, {
            lineId: line.id,
            maxQuantity: remainingQty,
            quantityToRestore: remainingQty,
            invoiceLineId: line.invoice_line_id,
          });
        });
        setLineRestoreData(initialData);

        // Fetch invoice
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single();

        if (invoiceError) throw invoiceError;
        setInvoice(invoiceData as InvoiceData);
        setSelectedWithholdingRate(invoiceData.withholding_rate || 0);

        // Fetch invoice lines
        const { data: invLinesData, error: invLinesError } = await supabase
          .from('invoice_lines')
          .select('*')
          .eq('invoice_id', invoiceId);

        if (invLinesError) throw invLinesError;
        setInvoiceLines((invLinesData || []) as InvoiceLine[]);

      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(t('error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [open, creditNoteId, invoiceId, t]);

  const handleQuantityChange = (lineId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const currentData = lineRestoreData.get(lineId);
    if (!currentData) return;

    const clampedValue = Math.max(0, Math.min(numValue, currentData.maxQuantity));
    
    const newData = new Map(lineRestoreData);
    newData.set(lineId, {
      ...currentData,
      quantityToRestore: clampedValue,
    });
    setLineRestoreData(newData);
  };

  // Calculate invoice updates preview
  const invoiceUpdatePreview = useMemo(() => {
    if (!invoice || invoiceLines.length === 0) return null;

    const restoredLines: { invoice_line_id: string; quantity: number }[] = [];
    
    lines.forEach(line => {
      const restoreData = lineRestoreData.get(line.id);
      if (!restoreData || restoreData.quantityToRestore <= 0 || !restoreData.invoiceLineId) return;
      restoredLines.push({
        invoice_line_id: restoreData.invoiceLineId,
        quantity: restoreData.quantityToRestore,
      });
    });

    if (restoredLines.length === 0) return null;

    return calculateInvoiceUpdates(
      {
        subtotal_ht: invoice.subtotal_ht,
        total_vat: invoice.total_vat,
        total_ttc: invoice.total_ttc,
        net_payable: invoice.net_payable,
        stamp_duty_amount: invoice.stamp_duty_amount,
        stamp_duty_enabled: invoice.stamp_duty_enabled,
        withholding_rate: selectedWithholdingRate,
        withholding_amount: invoice.withholding_amount,
        paid_amount: invoice.paid_amount,
      },
      invoiceLines.map(l => ({
        id: l.id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price_ht: l.unit_price_ht,
        vat_rate: l.vat_rate,
        discount_percent: l.discount_percent,
      })),
      restoredLines
    );
  }, [invoice, invoiceLines, lines, lineRestoreData, selectedWithholdingRate]);

  // Calculate totals
  const calculatedTotals = useMemo(() => {
    let totalQuantity = 0;
    let totalAmount = 0;
    let physicalProductsCount = 0;
    let stockToRestore = 0;

    lines.forEach(line => {
      const restoreData = lineRestoreData.get(line.id);
      if (!restoreData || restoreData.quantityToRestore <= 0) return;

      const qtyToRestore = restoreData.quantityToRestore;
      totalQuantity += qtyToRestore;

      const pricePerUnit = line.line_total_ttc / line.quantity;
      totalAmount += pricePerUnit * qtyToRestore;

      if (line.product?.product_type === 'physical' && !line.product?.unlimited_stock) {
        physicalProductsCount++;
        stockToRestore += qtyToRestore;
      }
    });

    return { totalQuantity, totalAmount, physicalProductsCount, stockToRestore };
  }, [lines, lineRestoreData]);

  const hasAnyQuantity = calculatedTotals.totalQuantity > 0;

  // Check if we should propose 0% withholding
  useEffect(() => {
    if (invoiceUpdatePreview?.shouldProposeZeroWithholding) {
      setProposeZeroWithholding(true);
      setShowWithholdingChoice(true);
    }
  }, [invoiceUpdatePreview]);

  const handleProceedToPreview = () => {
    if (!hasAnyQuantity) {
      toast.error(t('select_lines_to_restore'));
      return;
    }
    setStep('preview');
  };

  const handleProceedToWithholding = () => {
    if (showWithholdingChoice) {
      setStep('withholding');
    } else {
      handleRestore();
    }
  };

  const handleRestore = async () => {
    if (!hasAnyQuantity || !invoice) {
      toast.error(t('select_lines_to_restore'));
      return;
    }

    setIsProcessing(true);
    try {
      let amountToUnblock = 0;

      // 1. Process each line with quantity to restore
      for (const line of lines) {
        const restoreData = lineRestoreData.get(line.id);
        if (!restoreData || restoreData.quantityToRestore <= 0) continue;

        const qtyToRestore = restoreData.quantityToRestore;
        const pricePerUnit = line.line_total_ttc / line.quantity;
        const lineAmount = pricePerUnit * qtyToRestore;
        amountToUnblock += lineAmount;

        // 1a. Restore stock for physical products
        if (line.product && line.product.product_type === 'physical' && !line.product.unlimited_stock) {
          const previousStock = line.product.current_stock ?? 0;
          const newStock = previousStock + qtyToRestore;

          const { error: stockError } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', line.product.id);

          if (stockError) throw stockError;

          await supabase
            .from('stock_movements')
            .insert({
              product_id: line.product.id,
              movement_type: 'add',
              quantity: qtyToRestore,
              previous_stock: previousStock,
              new_stock: newStock,
              reason_category: t('credit_note_return'),
              reason_detail: `${t('credit_note')} ${creditNoteNumber}`,
            });
        }

        // 1b. Mark credit note line as restored
        const isFullRestore = qtyToRestore === restoreData.maxQuantity;
        if (isFullRestore) {
          await supabase
            .from('credit_note_lines')
            .update({ stock_restored: true })
            .eq('id', line.id);
        } else {
          // Partial restore - update quantity_restored (if column exists)
          // For now, we'll track via stock_restored flag
          await supabase
            .from('credit_note_lines')
            .update({ stock_restored: true })
            .eq('id', line.id);
        }
      }

      // 2. Update invoice lines and totals
      if (invoiceUpdatePreview) {
        // Delete lines that are fully returned
        for (const lineId of invoiceUpdatePreview.deletedLines) {
          await supabase
            .from('invoice_lines')
            .delete()
            .eq('id', lineId);
        }

        // Update lines with reduced quantities
        for (const { id, newQuantity } of invoiceUpdatePreview.updatedLines) {
          const originalLine = invoiceLines.find(l => l.id === id);
          if (!originalLine) continue;

          const unitPriceAfterDiscount = originalLine.unit_price_ht * (1 - originalLine.discount_percent / 100);
          const newLineHt = unitPriceAfterDiscount * newQuantity;
          const newLineVat = newLineHt * (originalLine.vat_rate / 100);
          const newLineTtc = newLineHt + newLineVat;

          await supabase
            .from('invoice_lines')
            .update({
              quantity: newQuantity,
              line_total_ht: newLineHt,
              line_vat: newLineVat,
              line_total_ttc: newLineTtc,
            })
            .eq('id', id);
        }

        // Calculate withholding with potentially updated rate
        const finalWithholdingRate = selectedWithholdingRate;
        const finalWithholdingAmount = invoiceUpdatePreview.newTotalTtc * (finalWithholdingRate / 100);
        const finalNetPayable = (invoiceUpdatePreview.newTotalTtc - finalWithholdingAmount) + invoiceUpdatePreview.stampDuty;

        // Update invoice totals
        await supabase
          .from('invoices')
          .update({
            subtotal_ht: invoiceUpdatePreview.newSubtotalHt,
            total_vat: invoiceUpdatePreview.newTotalVat,
            total_ttc: invoiceUpdatePreview.newTotalTtc,
            withholding_rate: finalWithholdingRate,
            withholding_amount: finalWithholdingAmount,
            net_payable: finalNetPayable,
          })
          .eq('id', invoiceId);
      }

      // 3. Update credit note - move from blocked to available
      const { data: currentCN, error: cnFetchError } = await supabase
        .from('credit_notes')
        .select('credit_blocked, credit_available')
        .eq('id', creditNoteId)
        .single();

      if (cnFetchError) throw cnFetchError;

      const newBlocked = Math.max(0, (currentCN.credit_blocked || 0) - amountToUnblock);
      const newAvailable = (currentCN.credit_available || 0) + amountToUnblock;

      await supabase
        .from('credit_notes')
        .update({
          credit_blocked: newBlocked,
          credit_available: newAvailable,
        })
        .eq('id', creditNoteId);

      // 4. Handle overpayment - create client credit if applicable
      const overpayment = invoiceUpdatePreview?.overpayment || 0;
      if (overpayment > 0) {
        // Get current client balance
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('account_balance')
          .eq('id', clientId)
          .single();

        if (clientError) throw clientError;

        const currentBalance = client.account_balance || 0;
        const newBalance = currentBalance + overpayment;

        // Create client credit movement
        await supabase
          .from('client_account_movements')
          .insert({
            organization_id: organizationId,
            client_id: clientId,
            amount: overpayment,
            balance_after: newBalance,
            movement_type: 'credit',
            source_type: 'credit_note_overpayment',
            source_id: creditNoteId,
            notes: `${t('overpayment_from_return')} - ${t('credit_note')} ${creditNoteNumber}`,
          });

        // Update client balance
        await supabase
          .from('clients')
          .update({ account_balance: newBalance })
          .eq('id', clientId);

        toast.success(`${t('credit_restored_success')} - ${t('client_credit')}: ${formatCurrency(overpayment, currency)}`);
      } else {
        toast.success(t('credit_restored_success'));
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error restoring credit:', error);
      toast.error(t('error_restoring_credit'));
    } finally {
      setIsProcessing(false);
    }
  };

  const renderLinesStep = () => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Info Banner */}
      <Alert className="border-orange-500/30 bg-orange-500/10">
        <AlertCircle className="h-4 w-4 text-orange-500" />
        <AlertTitle className="text-orange-700 dark:text-orange-400">
          {t('credit_blocked')}: {formatCurrency(creditBlocked, currency)}
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          {t('restore_products_description')}
        </AlertDescription>
      </Alert>

      {/* Lines List */}
      <ScrollArea className="h-[300px]">
        <div className="space-y-3 pr-4">
          {lines.map((line) => {
            const restoreData = lineRestoreData.get(line.id);
            const qtyToRestore = restoreData?.quantityToRestore || 0;
            const maxQty = restoreData?.maxQuantity || line.quantity;
            const pricePerUnit = line.line_total_ttc / line.quantity;
            const lineAmount = pricePerUnit * qtyToRestore;

            return (
              <div
                key={line.id}
                className={`p-4 rounded-lg border transition-colors ${
                  qtyToRestore > 0
                    ? 'bg-primary/5 border-primary/30'
                    : 'bg-muted/30 border-muted'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{line.product?.name || line.description}</p>
                      {line.product?.reference && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {line.product.reference}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-primary whitespace-nowrap">
                      {formatCurrency(lineAmount, currency)}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">
                        {t('quantity_to_restore')}:
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max={maxQty}
                        value={qtyToRestore}
                        onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground">
                        / {maxQty} {t('max_quantity')}
                      </span>
                    </div>
                  </div>
                  
                  {line.product?.product_type === 'physical' && !line.product?.unlimited_stock && qtyToRestore > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Package className="h-3 w-3 mr-1" />
                      {t('stock_will_restore')}: +{qtyToRestore}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Separator />

      {/* Summary */}
      <div className="p-4 rounded-lg bg-muted/30 border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{t('quantity_to_restore')}</span>
          <span className="font-medium">{calculatedTotals.totalQuantity}</span>
        </div>
        
        {calculatedTotals.physicalProductsCount > 0 && (
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              {t('stock_to_restore')}
            </span>
            <span className="text-green-600">+{calculatedTotals.stockToRestore}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="font-medium">{t('amount_to_unblock')}</span>
          <span className="font-mono font-bold text-primary">
            {formatCurrency(calculatedTotals.totalAmount, currency)}
          </span>
        </div>
      </div>
    </motion.div>
  );

  const renderPreviewStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <Alert>
        <Receipt className="h-4 w-4" />
        <AlertTitle>{t('invoice_will_be_updated')}</AlertTitle>
        <AlertDescription>
          {t('invoice_update_warning')}
        </AlertDescription>
      </Alert>

      {invoice && invoiceUpdatePreview && (
        <div className="p-4 rounded-lg bg-muted/30 border space-y-4">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Calculator className="h-4 w-4" />
            {t('invoice_recalculation')}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Before */}
            <div className="p-3 rounded bg-muted/50 space-y-2">
              <p className="font-medium text-muted-foreground">{t('before')}</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>{t('subtotal_ht')}:</span>
                  <span className="font-mono">{formatCurrency(invoice.subtotal_ht, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('total_vat')}:</span>
                  <span className="font-mono">{formatCurrency(invoice.total_vat, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('total_ttc')}:</span>
                  <span className="font-mono font-semibold">{formatCurrency(invoice.total_ttc, currency)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between">
                  <span>{t('net_payable')}:</span>
                  <span className="font-mono font-semibold">{formatCurrency(invoice.net_payable, currency)}</span>
                </div>
              </div>
            </div>

            {/* After */}
            <div className="p-3 rounded bg-primary/10 border border-primary/30 space-y-2">
              <p className="font-medium text-primary">{t('after')}</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>{t('subtotal_ht')}:</span>
                  <span className="font-mono">{formatCurrency(invoiceUpdatePreview.newSubtotalHt, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('total_vat')}:</span>
                  <span className="font-mono">{formatCurrency(invoiceUpdatePreview.newTotalVat, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('total_ttc')}:</span>
                  <span className="font-mono font-semibold">{formatCurrency(invoiceUpdatePreview.newTotalTtc, currency)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between">
                  <span>{t('net_payable')}:</span>
                  <span className="font-mono font-semibold">{formatCurrency(invoiceUpdatePreview.newNetPayable, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lines changes */}
          {(invoiceUpdatePreview.deletedLines.length > 0 || invoiceUpdatePreview.updatedLines.length > 0) && (
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 space-y-2">
              <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('invoice_line_changes')}
              </p>
              {invoiceUpdatePreview.deletedLines.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  • {invoiceUpdatePreview.deletedLines.length} {t('lines_will_be_deleted')}
                </p>
              )}
              {invoiceUpdatePreview.updatedLines.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  • {invoiceUpdatePreview.updatedLines.length} {t('lines_will_be_updated')}
                </p>
              )}
            </div>
          )}

          {/* Overpayment info */}
          {invoiceUpdatePreview.overpayment > 0 && (
            <div className="p-3 rounded bg-green-500/10 border border-green-500/30 space-y-2">
              <p className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                {t('overpayment_detected')}
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('paid_amount')}:</span>
                <span className="font-mono">{formatCurrency(invoice.paid_amount, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('new_net_payable')}:</span>
                <span className="font-mono">{formatCurrency(invoiceUpdatePreview.newNetPayable, currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span className="text-green-700 dark:text-green-400">{t('client_credit_to_generate')}:</span>
                <span className="font-mono text-green-700 dark:text-green-400">
                  +{formatCurrency(invoiceUpdatePreview.overpayment, currency)}
                </span>
              </div>
            </div>
          )}

          {/* Withholding proposal */}
          {invoiceUpdatePreview.shouldProposeZeroWithholding && (
            <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30 space-y-2">
              <p className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('withholding_proposal')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('ttc_below_threshold')} ({formatCurrency(invoiceUpdatePreview.newTotalTtc, currency)} &lt; 1000 DT)
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  const renderWithholdingStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <Alert className="border-blue-500/30 bg-blue-500/10">
        <Calculator className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-700 dark:text-blue-400">
          {t('adjust_withholding_rate')}
        </AlertTitle>
        <AlertDescription>
          {t('withholding_adjustment_description')}
        </AlertDescription>
      </Alert>

      <div className="p-4 rounded-lg bg-muted/30 border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('current_withholding_rate')}</p>
            <p className="text-sm text-muted-foreground">{invoice?.withholding_rate || 0}%</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Label>{t('new_rate')}:</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={selectedWithholdingRate}
              onChange={(e) => setSelectedWithholdingRate(parseFloat(e.target.value) || 0)}
              className="w-24"
            />
            <span>%</span>
          </div>
        </div>

        {proposeZeroWithholding && (
          <div className="flex items-center justify-between p-3 rounded bg-blue-500/10 border border-blue-500/30">
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-400">
                {t('set_zero_withholding')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('ttc_below_threshold_explanation')}
              </p>
            </div>
            <Switch
              checked={selectedWithholdingRate === 0}
              onCheckedChange={(checked) => setSelectedWithholdingRate(checked ? 0 : (invoice?.withholding_rate || 0))}
            />
          </div>
        )}

        {invoiceUpdatePreview && (
          <div className="pt-3 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('total_ttc')}:</span>
              <span className="font-mono">{formatCurrency(invoiceUpdatePreview.newTotalTtc, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('withholding')} ({selectedWithholdingRate}%):</span>
              <span className="font-mono text-red-600">
                -{formatCurrency(invoiceUpdatePreview.newTotalTtc * (selectedWithholdingRate / 100), currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('stamp_duty')}:</span>
              <span className="font-mono">+{formatCurrency(invoiceUpdatePreview.stampDuty, currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>{t('net_payable')}:</span>
              <span className="font-mono text-primary">
                {formatCurrency(
                  (invoiceUpdatePreview.newTotalTtc - invoiceUpdatePreview.newTotalTtc * (selectedWithholdingRate / 100)) + invoiceUpdatePreview.stampDuty,
                  currency
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" 
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-primary" />
            {t('restore_products_and_update_invoice')}
          </DialogTitle>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0">
          {(['lines', 'preview', 'withholding'] as Step[]).map((s, index) => {
            const stepIndex = ['lines', 'preview', 'withholding'].indexOf(step);
            const isActive = step === s;
            const isCompleted = stepIndex > index;
            
            // Skip withholding step indicator if not needed
            if (s === 'withholding' && !showWithholdingChoice) return null;
            
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  isActive ? 'bg-primary text-primary-foreground' : 
                  isCompleted ? 'bg-primary/20 text-primary' : 'bg-muted'
                }`}>
                  <span className="font-medium">{index + 1}</span>
                  <span className="hidden sm:inline">{t(`step_${s}`)}</span>
                </div>
                {index < (showWithholdingChoice ? 2 : 1) && <div className="w-8 h-0.5 bg-muted" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="pb-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                <p>{t('all_products_received')}</p>
              </div>
            ) : (
              <>
                {step === 'lines' && renderLinesStep()}
                {step === 'preview' && renderPreviewStep()}
                {step === 'withholding' && renderWithholdingStep()}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step !== 'lines' && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 'withholding' ? 'preview' : 'lines')}
              disabled={isProcessing}
            >
              {t('back')}
            </Button>
          )}

          {step === 'lines' && hasAnyQuantity && (
            <Button onClick={handleProceedToPreview}>
              {t('preview_changes')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 'preview' && (
            <Button 
              onClick={handleProceedToWithholding}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {showWithholdingChoice ? t('next') : t('confirm_restore')}
              {!showWithholdingChoice && <CheckCircle2 className="h-4 w-4 ml-2" />}
            </Button>
          )}

          {step === 'withholding' && (
            <Button 
              onClick={handleRestore}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {t('confirm_restore')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};