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
import { toast } from 'sonner';
import { 
  Package,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CreditNoteLine } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface CreditUnblockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string;
  creditBlocked: number;
  currency: string;
  clientId: string;
  organizationId: string;
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

interface LineUnblockData {
  lineId: string;
  maxQuantity: number;
  quantityToUnblock: number;
}

export const CreditUnblockDialog: React.FC<CreditUnblockDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  creditBlocked,
  currency,
  clientId,
  organizationId,
  onSuccess,
}) => {
  const { t, isRTL } = useLanguage();
  const [lines, setLines] = useState<LineWithProduct[]>([]);
  const [lineUnblockData, setLineUnblockData] = useState<Map<string, LineUnblockData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchLines = async () => {
      if (!open || !creditNoteId) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('credit_note_lines')
          .select(`
            *,
            product:products(id, name, reference, product_type, current_stock, unlimited_stock)
          `)
          .eq('credit_note_id', creditNoteId)
          .eq('stock_restored', false)
          .order('line_order', { ascending: true });

        if (error) throw error;
        
        const lineData = (data || []) as LineWithProduct[];
        setLines(lineData);
        
        // Initialize unblock data with full quantities by default
        const initialData = new Map<string, LineUnblockData>();
        lineData.forEach(line => {
          initialData.set(line.id, {
            lineId: line.id,
            maxQuantity: line.quantity,
            quantityToUnblock: line.quantity,
          });
        });
        setLineUnblockData(initialData);
      } catch (error) {
        console.error('Error fetching lines:', error);
        toast.error(t('error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLines();
  }, [open, creditNoteId, t]);

  const handleQuantityChange = (lineId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const currentData = lineUnblockData.get(lineId);
    if (!currentData) return;

    const clampedValue = Math.max(0, Math.min(numValue, currentData.maxQuantity));
    
    const newData = new Map(lineUnblockData);
    newData.set(lineId, {
      ...currentData,
      quantityToUnblock: clampedValue,
    });
    setLineUnblockData(newData);
  };

  // Calculate totals based on partial quantities
  const calculatedTotals = useMemo(() => {
    let totalQuantity = 0;
    let totalAmount = 0;
    let physicalProductsCount = 0;
    let stockToRestore = 0;

    lines.forEach(line => {
      const unblockData = lineUnblockData.get(line.id);
      if (!unblockData || unblockData.quantityToUnblock <= 0) return;

      const qtyToUnblock = unblockData.quantityToUnblock;
      totalQuantity += qtyToUnblock;

      // Calculate proportional amount for this line
      const pricePerUnit = line.line_total_ttc / line.quantity;
      totalAmount += pricePerUnit * qtyToUnblock;

      if (line.product?.product_type === 'physical' && !line.product?.unlimited_stock) {
        physicalProductsCount++;
        stockToRestore += qtyToUnblock;
      }
    });

    return { totalQuantity, totalAmount, physicalProductsCount, stockToRestore };
  }, [lines, lineUnblockData]);

  const hasAnyQuantity = calculatedTotals.totalQuantity > 0;

  const handleUnblock = async () => {
    if (!hasAnyQuantity) {
      toast.error(t('select_lines_to_unblock'));
      return;
    }

    setIsProcessing(true);
    try {
      let amountToUnblock = 0;

      // Process each line with quantity to unblock
      for (const line of lines) {
        const unblockData = lineUnblockData.get(line.id);
        if (!unblockData || unblockData.quantityToUnblock <= 0) continue;

        const qtyToUnblock = unblockData.quantityToUnblock;
        const isFullLine = qtyToUnblock === line.quantity;

        // Calculate proportional amount
        const pricePerUnit = line.line_total_ttc / line.quantity;
        const lineAmount = pricePerUnit * qtyToUnblock;
        amountToUnblock += lineAmount;

        // 1. Restore stock for physical products
        if (line.product && line.product.product_type === 'physical' && !line.product.unlimited_stock) {
          const previousStock = line.product.current_stock ?? 0;
          const newStock = previousStock + qtyToUnblock;

          // Update product stock
          const { error: stockError } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', line.product.id);

          if (stockError) throw stockError;

          // Create stock movement
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert({
              product_id: line.product.id,
              movement_type: 'add',
              quantity: qtyToUnblock,
              previous_stock: previousStock,
              new_stock: newStock,
              reason_category: t('credit_note_return'),
              reason_detail: `${t('credit_note')} ${creditNoteNumber}`,
            });

          if (movementError) throw movementError;
        }

        // 2. Update credit note line
        if (isFullLine) {
          // Full line - mark as stock_restored
          const { error: lineError } = await supabase
            .from('credit_note_lines')
            .update({ stock_restored: true })
            .eq('id', line.id);

          if (lineError) throw lineError;
        } else {
          // Partial line - update the quantity and create a new restored line
          const remainingQty = line.quantity - qtyToUnblock;
          
          // Update existing line with remaining quantity
          const remainingAmount = pricePerUnit * remainingQty;
          const vatRate = line.vat_rate;
          const remainingHt = remainingAmount / (1 + vatRate / 100);
          const remainingVat = remainingAmount - remainingHt;
          
          const { error: updateError } = await supabase
            .from('credit_note_lines')
            .update({
              quantity: remainingQty,
              line_total_ht: remainingHt,
              line_vat: remainingVat,
              line_total_ttc: remainingAmount,
            })
            .eq('id', line.id);

          if (updateError) throw updateError;

          // Insert new line for restored portion
          const restoredHt = lineAmount / (1 + vatRate / 100);
          const restoredVat = lineAmount - restoredHt;
          
          const { error: insertError } = await supabase
            .from('credit_note_lines')
            .insert({
              credit_note_id: creditNoteId,
              product_id: line.product_id,
              invoice_line_id: line.invoice_line_id,
              description: line.description,
              quantity: qtyToUnblock,
              unit_price_ht: line.unit_price_ht,
              vat_rate: line.vat_rate,
              discount_percent: line.discount_percent,
              line_total_ht: restoredHt,
              line_vat: restoredVat,
              line_total_ttc: lineAmount,
              return_reason: line.return_reason,
              stock_restored: true,
              line_order: line.line_order,
            });

          if (insertError) throw insertError;
        }
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

      const { error: cnUpdateError } = await supabase
        .from('credit_notes')
        .update({
          credit_blocked: newBlocked,
          credit_available: newAvailable,
        })
        .eq('id', creditNoteId);

      if (cnUpdateError) throw cnUpdateError;

      // 4. Add credit to client account
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('account_balance')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      const currentBalance = client.account_balance || 0;
      const newBalance = currentBalance + amountToUnblock;

      const { error: movementError } = await supabase
        .from('client_account_movements')
        .insert({
          organization_id: organizationId,
          client_id: clientId,
          amount: amountToUnblock,
          balance_after: newBalance,
          movement_type: 'credit',
          source_type: 'credit_note_unblock',
          source_id: creditNoteId,
          notes: `${t('credit_unblocked')} - ${t('credit_note')} ${creditNoteNumber}`,
        });

      if (movementError) throw movementError;

      // 5. Update client account balance
      const { error: balanceError } = await supabase
        .from('clients')
        .update({ account_balance: newBalance })
        .eq('id', clientId);

      if (balanceError) throw balanceError;

      toast.success(t('credit_unblocked_success'));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error unblocking credit:', error);
      toast.error(t('error_unblocking_credit'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" 
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-primary" />
            {t('unblock_credit')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="space-y-4 pb-4">
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
                {/* Info Banner */}
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-orange-700 dark:text-orange-400">
                        {t('credit_blocked')}: {formatCurrency(creditBlocked, currency)}
                      </p>
                      <p className="text-muted-foreground mt-1">
                        {t('unblock_credit_description')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lines List with Quantity Inputs */}
                <div className="space-y-3">
                  {lines.map((line) => {
                    const unblockData = lineUnblockData.get(line.id);
                    const qtyToUnblock = unblockData?.quantityToUnblock || 0;
                    const maxQty = unblockData?.maxQuantity || line.quantity;
                    const pricePerUnit = line.line_total_ttc / line.quantity;
                    const lineAmount = pricePerUnit * qtyToUnblock;

                    return (
                      <motion.div
                        key={line.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border transition-colors ${
                          qtyToUnblock > 0
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-muted/30 border-muted'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Product info */}
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
                          
                          {/* Quantity input */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm text-muted-foreground whitespace-nowrap">
                                {t('quantity_to_unblock')}:
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                max={maxQty}
                                value={qtyToUnblock}
                                onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                                className="w-20 h-8"
                              />
                              <span className="text-xs text-muted-foreground">
                                / {maxQty} {t('max_quantity')}
                              </span>
                            </div>
                          </div>
                          
                          {/* Stock restore badge */}
                          {line.product?.product_type === 'physical' && !line.product?.unlimited_stock && qtyToUnblock > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              {t('stock_will_restore')}: +{qtyToUnblock}
                            </Badge>
                          )}
                          
                          {line.return_reason && (
                            <p className="text-xs text-orange-600">{t(line.return_reason)}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <Separator />

                {/* Summary */}
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{t('quantity_unblocked')}</span>
                    <span className="font-medium">{calculatedTotals.totalQuantity}</span>
                  </div>
                  
                  {calculatedTotals.physicalProductsCount > 0 && (
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <RotateCcw className="h-3 w-3" />
                        {t('stock_to_restore')}
                      </span>
                      <span className="text-green-600">+{calculatedTotals.stockToRestore} {t('products_count')}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="font-medium">{t('credit_to_unblock')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-orange-600 line-through text-sm">
                        {formatCurrency(creditBlocked, currency)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-green-600 font-semibold">
                        {formatCurrency(calculatedTotals.totalAmount, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            {t('cancel')}
          </Button>
          {lines.length > 0 && (
            <Button 
              onClick={handleUnblock} 
              disabled={isProcessing || !hasAnyQuantity}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" />
                  {t('confirm_unblock')}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};