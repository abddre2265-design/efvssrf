import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { recalculateFinancialCredit } from '@/utils/financialCreditUtils';
import { CreditNote, CreditNoteLine } from './types';
import { formatCurrency } from '@/components/invoices/types';
import { toast } from 'sonner';

interface ProductReturnValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNote: CreditNote | null;
  onComplete?: () => void;
}

interface ValidationLine extends CreditNoteLine {
  quantityToValidate: number;
  maxValidatable: number;
}

export const ProductReturnValidationDialog: React.FC<ProductReturnValidationDialogProps> = ({
  open,
  onOpenChange,
  creditNote,
  onComplete,
}) => {
  const { t, isRTL } = useLanguage();
  const [lines, setLines] = useState<ValidationLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchLines = async () => {
      if (!creditNote || !open) return;
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('credit_note_lines')
          .select('*')
          .eq('credit_note_id', creditNote.id)
          .order('line_order', { ascending: true });

        const fetchedLines = (data || []) as unknown as CreditNoteLine[];
        setLines(fetchedLines.map(l => ({
          ...l,
          maxValidatable: l.returned_quantity - l.validated_quantity,
          quantityToValidate: l.returned_quantity - l.validated_quantity, // default: validate all remaining
        })));
      } catch (error) {
        console.error('Error fetching lines:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLines();
  }, [creditNote, open]);

  const updateQty = (lineId: string, qty: number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const clamped = Math.min(Math.max(0, qty), l.maxValidatable);
      return { ...l, quantityToValidate: clamped };
    }));
  };

  const totalToValidate = lines.reduce((sum, l) => sum + l.quantityToValidate, 0);
  const hasValidation = totalToValidate > 0;

  // Calculate the financial impact of this validation batch
  const validationTotalHt = lines.reduce((sum, l) => {
    if (l.quantityToValidate <= 0 || l.returned_quantity <= 0) return sum;
    const unitHt = l.discount_ht / l.returned_quantity;
    return sum + (l.quantityToValidate * unitHt);
  }, 0);

  const validationTotalTtc = lines.reduce((sum, l) => {
    if (l.quantityToValidate <= 0 || l.returned_quantity <= 0) return sum;
    const unitTtc = l.discount_ttc / l.returned_quantity;
    return sum + (l.quantityToValidate * unitTtc);
  }, 0);

  const isFullValidation = lines.every(l => l.quantityToValidate === l.maxValidatable);

  const handleValidate = async () => {
    if (!creditNote || !hasValidation) return;
    setIsSaving(true);
    try {
      // 1. Update each credit_note_line's validated_quantity
      for (const line of lines) {
        if (line.quantityToValidate <= 0) continue;
        const newValidated = line.validated_quantity + line.quantityToValidate;
        await supabase
          .from('credit_note_lines')
          .update({ validated_quantity: newValidated } as any)
          .eq('id', line.id);

        // Restore stock for validated quantities
        const { data: product } = await supabase
          .from('products')
          .select('current_stock, unlimited_stock')
          .eq('id', line.product_id)
          .maybeSingle();

        if (product && !product.unlimited_stock) {
          const previousStock = product.current_stock ?? 0;
          const newStock = previousStock + line.quantityToValidate;
          await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', line.product_id);

          await supabase
            .from('stock_movements')
            .insert([{
              product_id: line.product_id,
              movement_type: 'add' as const,
              quantity: line.quantityToValidate,
              previous_stock: previousStock,
              new_stock: newStock,
              reason_category: 'commercial',
              reason_detail: `${t('product_return_credit_note') || 'Avoir produit'} ${creditNote.credit_note_number}`,
            }]);
        }
      }

      // 2. Update invoice: total_credited
      const { data: invoice } = await supabase
        .from('invoices')
        .select('total_credited, credit_note_count, paid_amount, net_payable')
        .eq('id', creditNote.invoice_id)
        .single();

      if (invoice) {
        // Credit amount = validated TTC adjusted for withholding
        const withholdingRate = creditNote.withholding_rate || 0;
        const validationWithholding = validationTotalTtc * (withholdingRate / 100);
        const creditAmount = validationTotalTtc - validationWithholding;

        const newTotalCredited = (invoice.total_credited || 0) + creditAmount;
        const isFirstValidation = creditNote.status === 'created';

        await supabase
          .from('invoices')
          .update({
            total_credited: newTotalCredited,
            credit_note_count: (invoice.credit_note_count || 0) + (isFirstValidation ? 1 : 0),
          })
          .eq('id', creditNote.invoice_id);
      }

      // 3. Update credit note status
      const newStatus = isFullValidation ? 'validated' : 'validated_partial';
      await supabase
        .from('credit_notes')
        .update({ status: newStatus })
        .eq('id', creditNote.id);

      // 4. Recalculate financial credit
      const fcResult = await recalculateFinancialCredit(creditNote.invoice_id, t);
      if (fcResult && fcResult.delta > 0) {
        toast.info(`${t('financial_credit_created') || 'Avoir financier créé'}: ${fcResult.financialCredit.toFixed(3)} TND`);
      }

      toast.success(
        isFullValidation
          ? (t('credit_note_validated') || 'Avoir validé totalement')
          : (t('credit_note_partially_validated') || 'Avoir validé partiellement')
      );
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      console.error('Error validating product return:', error);
      toast.error(t('error_creating_credit_note'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!creditNote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] max-h-[80vh] p-0 overflow-hidden grid grid-rows-[auto,1fr,auto]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            {t('validate_product_return') || 'Valider le retour produit'}
            <Badge variant="outline" className="font-mono">{creditNote.credit_note_number}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('select_quantities_to_validate') || 'Sélectionnez les quantités à valider. Vous pouvez valider partiellement ou totalement.'}
            </p>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-start p-3 font-medium">{t('product')}</th>
                    <th className="text-center p-3 font-medium">{t('return_qty') || 'Qté retour'}</th>
                    <th className="text-center p-3 font-medium">{t('already_validated') || 'Déjà validée'}</th>
                    <th className="text-center p-3 font-medium">{t('remaining') || 'Restant'}</th>
                    <th className="text-center p-3 font-medium">{t('qty_to_validate') || 'Qté à valider'}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="p-3">
                        <div className="font-medium">{l.product_name || '-'}</div>
                        {l.product_reference && (
                          <div className="text-xs text-muted-foreground font-mono">{l.product_reference}</div>
                        )}
                      </td>
                      <td className="text-center p-3 font-mono">{l.returned_quantity}</td>
                      <td className="text-center p-3 font-mono">
                        {l.validated_quantity > 0 ? (
                          <Badge variant="secondary">{l.validated_quantity}</Badge>
                        ) : '0'}
                      </td>
                      <td className="text-center p-3 font-mono font-medium">
                        {l.maxValidatable > 0 ? l.maxValidatable : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                            {t('fully_validated') || 'Validée'}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {l.maxValidatable > 0 ? (
                          <Input
                            type="number"
                            step="1"
                            min={0}
                            max={l.maxValidatable}
                            value={l.quantityToValidate || ''}
                            onChange={(e) => updateQty(l.id, parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-sm mx-auto text-center"
                          />
                        ) : (
                          <span className="text-muted-foreground text-center block">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator />

            <div className="border rounded-lg p-4 space-y-2 bg-primary/5">
              <h4 className="font-semibold text-sm">{t('validation_summary') || 'Résumé de la validation'}</h4>
              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('total_qty_to_validate') || 'Quantité totale à valider'}</span>
                  <span className="font-mono font-medium">{totalToValidate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('amount_to_credit') || 'Montant à créditer'}</span>
                  <span className="font-mono font-medium">{formatCurrency(validationTotalTtc, 'TND')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('validation_type') || 'Type de validation'}</span>
                  <Badge variant={isFullValidation ? 'default' : 'secondary'}>
                    {isFullValidation
                      ? (t('total_validation') || 'Validation totale')
                      : (t('partial_validation') || 'Validation partielle')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleValidate} disabled={!hasValidation || isSaving}>
            {isSaving
              ? (t('saving') || 'Validation...')
              : isFullValidation
                ? (t('validate_all') || 'Valider tout')
                : (t('validate_selected') || 'Valider la sélection')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
