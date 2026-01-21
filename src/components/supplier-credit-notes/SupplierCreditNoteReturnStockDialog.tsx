import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Package,
  Unlock,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/invoices/types';

interface SupplierCreditNoteReturnStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string;
  creditBlocked: number;
  currency: string;
  onSuccess: () => void;
}

interface LineToReturn {
  id: string;
  product_id: string | null;
  product_name: string;
  product_reference: string | null;
  product_type: string | null;
  total_quantity: number;
  already_returned: number;
  remaining_quantity: number;
  quantity_to_return: number;
  selected: boolean;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
}

export const SupplierCreditNoteReturnStockDialog: React.FC<SupplierCreditNoteReturnStockDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  creditBlocked,
  currency,
  onSuccess,
}) => {
  const { t, isRTL } = useLanguage();
  const [lines, setLines] = useState<LineToReturn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLines();
    }
  }, [open, creditNoteId]);

  const fetchLines = async () => {
    setIsLoading(true);
    try {
      const { data: creditNoteLines, error } = await supabase
        .from('supplier_credit_note_lines')
        .select(`
          *,
          product:products(id, name, reference, product_type)
        `)
        .eq('supplier_credit_note_id', creditNoteId)
        .eq('stock_deducted', false)
        .order('line_order', { ascending: true });

      if (error) throw error;

      const linesToReturn: LineToReturn[] = (creditNoteLines || []).map(line => {
        const alreadyReturned = line.stock_deducted ? line.quantity : 0;
        const remaining = line.quantity - alreadyReturned;
        
        return {
          id: line.id,
          product_id: line.product_id,
          product_name: line.product?.name || line.description || '-',
          product_reference: line.product?.reference || null,
          product_type: line.product?.product_type || null,
          total_quantity: line.quantity,
          already_returned: alreadyReturned,
          remaining_quantity: remaining,
          quantity_to_return: remaining,
          selected: remaining > 0,
          line_total_ht: line.line_total_ht,
          line_vat: line.line_vat,
          line_total_ttc: line.line_total_ttc,
        };
      }).filter(l => l.remaining_quantity > 0);

      setLines(linesToReturn);
    } catch (error) {
      console.error('Error fetching lines:', error);
      toast.error(t('error_loading_data'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLineSelect = (lineId: string, selected: boolean) => {
    setLines(prev => prev.map(line => 
      line.id === lineId ? { ...line, selected } : line
    ));
  };

  const handleQuantityChange = (lineId: string, quantity: number) => {
    setLines(prev => prev.map(line => 
      line.id === lineId 
        ? { ...line, quantity_to_return: Math.min(Math.max(0, quantity), line.remaining_quantity) }
        : line
    ));
  };

  const selectedLines = lines.filter(l => l.selected && l.quantity_to_return > 0);
  
  const totalAmountToReturn = selectedLines.reduce((sum, line) => {
    const ratio = line.quantity_to_return / line.total_quantity;
    return sum + (line.line_total_ttc * ratio);
  }, 0);

  const handleSave = async () => {
    if (selectedLines.length === 0) {
      toast.error(t('select_lines_to_return'));
      return;
    }

    setIsSaving(true);
    try {
      for (const line of selectedLines) {
        // Mark line as returned
        const { error: lineError } = await supabase
          .from('supplier_credit_note_lines')
          .update({ stock_deducted: true })
          .eq('id', line.id);

        if (lineError) throw lineError;

        // Deduct stock for physical products
        if (line.product_id && line.product_type === 'physical') {
          const { data: product, error: prodError } = await supabase
            .from('products')
            .select('current_stock, unlimited_stock')
            .eq('id', line.product_id)
            .single();

          if (!prodError && product && !product.unlimited_stock) {
            const previousStock = product.current_stock ?? 0;
            const newStock = Math.max(0, previousStock - line.quantity_to_return);

            const { error: stockError } = await supabase
              .from('products')
              .update({ current_stock: newStock })
              .eq('id', line.product_id);

            if (!stockError) {
              await supabase
                .from('stock_movements')
                .insert({
                  product_id: line.product_id,
                  movement_type: 'remove',
                  quantity: line.quantity_to_return,
                  previous_stock: previousStock,
                  new_stock: newStock,
                  reason_category: t('supplier_return'),
                  reason_detail: `${t('supplier_credit_note')} ${creditNoteNumber}`,
                });
            }
          }
        }
      }

      // Update credit note amounts
      const { data: currentCN, error: cnFetchError } = await supabase
        .from('supplier_credit_notes')
        .select('credit_blocked, credit_available')
        .eq('id', creditNoteId)
        .single();

      if (cnFetchError) throw cnFetchError;

      const newBlocked = Math.max(0, currentCN.credit_blocked - totalAmountToReturn);
      const newAvailable = currentCN.credit_available + totalAmountToReturn;

      const { error: cnUpdateError } = await supabase
        .from('supplier_credit_notes')
        .update({
          credit_blocked: newBlocked,
          credit_available: newAvailable,
        })
        .eq('id', creditNoteId);

      if (cnUpdateError) throw cnUpdateError;

      toast.success(t('stock_returned_successfully'));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error returning stock:', error);
      toast.error(t('error_returning_stock'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            {t('return_stock_to_supplier')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/30 border">
            <p className="text-sm text-muted-foreground">
              {t('credit_note')}: <span className="font-mono font-medium">{creditNoteNumber}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t('blocked_amount')}: <span className="font-mono font-medium text-orange-600">{formatCurrency(creditBlocked, currency)}</span>
            </p>
          </div>

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t('loading')}...</div>
            ) : lines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('no_lines_to_return')}</div>
            ) : (
              <div className="space-y-3">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className={`p-4 rounded-lg border ${
                      line.selected ? 'border-primary bg-primary/5' : 'border-muted'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={line.selected}
                        onCheckedChange={(checked) => handleLineSelect(line.id, !!checked)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{line.product_name}</p>
                            {line.product_reference && (
                              <p className="text-xs text-muted-foreground font-mono">{line.product_reference}</p>
                            )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {t('remaining')}: {line.remaining_quantity}
                          </div>
                        </div>

                        {line.selected && (
                          <div className="mt-3 flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">{t('quantity_to_return')}:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={line.remaining_quantity}
                              value={line.quantity_to_return}
                              onChange={(e) => handleQuantityChange(line.id, parseInt(e.target.value) || 0)}
                              className="h-8 w-24 text-sm font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="font-medium">{t('total_to_unblock')}:</span>
            <span className="font-mono text-lg font-bold text-primary">
              {formatCurrency(totalAmountToReturn, currency)}
            </span>
          </div>

          {selectedLines.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              {t('select_lines_to_return')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || selectedLines.length === 0}
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            {isSaving ? t('saving') : t('confirm_return')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
