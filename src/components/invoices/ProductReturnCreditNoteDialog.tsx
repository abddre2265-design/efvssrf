import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, InvoiceLine, formatCurrency } from './types';
import { toast } from 'sonner';

interface ProductReturnCreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  editCreditNoteId?: string | null;
  onComplete?: () => void;
}

interface InvoiceLineWithProduct extends Omit<InvoiceLine, 'product'> {
  product: {
    id: string;
    name: string;
    reference: string | null;
    ean: string | null;
  } | null;
}

interface ReturnLine {
  lineId: string;
  productId: string;
  productName: string;
  productReference: string | null;
  invoicedQuantity: number;
  alreadyReturnedQuantity: number;
  returnableQuantity: number;
  returnQuantity: number;
  originalUnitPriceHt: number;
  adjustedUnitPriceHt: number; // after commercial credit notes
  vatRate: number;
  lineHt: number;
  lineVat: number;
  lineTtc: number;
  validatedQuantity: number; // locked validated qty in edit mode
  isLocked: boolean; // true if fully validated (no editable remainder)
}

interface InvoiceReturnDetails {
  invoice: Invoice;
  lines: InvoiceLineWithProduct[];
  returnLines: ReturnLine[];
  stampDuty: number;
}

export const ProductReturnCreditNoteDialog: React.FC<ProductReturnCreditNoteDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  editCreditNoteId,
  onComplete,
}) => {
  const { t, isRTL } = useLanguage();
  const [details, setDetails] = useState<InvoiceReturnDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = !!editCreditNoteId;

  // Withholding
  const [withholdingOverride, setWithholdingOverride] = useState<number | null>(null);
  const [withholdingDialogOpen, setWithholdingDialogOpen] = useState(false);
  const withholdingPromptShown = useRef(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!invoice || !open) return;
      setIsLoading(true);
      try {
        // Fetch invoice lines, validated product return credit notes, validated commercial credit notes
        const [linesRes, productCnRes, commercialCnRes] = await Promise.all([
          supabase
            .from('invoice_lines')
            .select('*, product:products(id, name, reference, ean)')
            .eq('invoice_id', invoice.id)
            .order('line_order', { ascending: true }),
          supabase
            .from('credit_notes')
            .select('id')
            .eq('invoice_id', invoice.id)
            .eq('credit_note_type', 'product_return')
            .eq('status', 'validated'),
          supabase
            .from('credit_notes')
            .select('id')
            .eq('invoice_id', invoice.id)
            .eq('credit_note_type', 'commercial_price')
            .eq('status', 'validated'),
        ]);

        const lines = (linesRes.data || []) as unknown as InvoiceLineWithProduct[];
        const isForeign = invoice.client_type === 'foreign';

        // Fetch returned quantities from validated product return credit note lines
        const productCnIds = (productCnRes.data || []).map((cn: any) => cn.id);
        let returnedByLine: Record<string, number> = {};
        if (productCnIds.length > 0) {
          const { data: retLines } = await supabase
            .from('credit_note_lines')
            .select('invoice_line_id, returned_quantity')
            .in('credit_note_id', productCnIds);
          if (retLines) {
            retLines.forEach((rl: any) => {
              returnedByLine[rl.invoice_line_id] = (returnedByLine[rl.invoice_line_id] || 0) + rl.returned_quantity;
            });
          }
        }

        // Fetch commercial discount per line from validated commercial credit notes
        const commercialCnIds = (commercialCnRes.data || []).map((cn: any) => cn.id);
        let commercialDiscountByLine: Record<string, number> = {};
        if (commercialCnIds.length > 0) {
          const { data: discLines } = await supabase
            .from('credit_note_lines')
            .select('invoice_line_id, discount_ht, original_quantity')
            .in('credit_note_id', commercialCnIds);
          if (discLines) {
            discLines.forEach((dl: any) => {
              commercialDiscountByLine[dl.invoice_line_id] = (commercialDiscountByLine[dl.invoice_line_id] || 0) + dl.discount_ht;
            });
          }
        }

        // In edit mode, fetch existing credit note lines to get validated_quantity and returned_quantity
        let existingCnLines: Record<string, { returned_quantity: number; validated_quantity: number; id: string }> = {};
        if (isEditMode && editCreditNoteId) {
          const { data: cnLines } = await supabase
            .from('credit_note_lines')
            .select('id, invoice_line_id, returned_quantity, validated_quantity')
            .eq('credit_note_id', editCreditNoteId);
          if (cnLines) {
            cnLines.forEach((cl: any) => {
              existingCnLines[cl.invoice_line_id] = {
                returned_quantity: cl.returned_quantity,
                validated_quantity: cl.validated_quantity,
                id: cl.id,
              };
            });
          }
        }

        const stampDuty = invoice.stamp_duty_enabled ? invoice.stamp_duty_amount : 0;

        // Build return lines
        const builtReturnLines: ReturnLine[] = lines.map(line => {
          const alreadyReturned = returnedByLine[line.id] || 0;
          const totalCommercialDiscount = commercialDiscountByLine[line.id] || 0;
          const adjustedLineHt = line.line_total_ht - totalCommercialDiscount;
          const adjustedUnitPrice = line.quantity > 0 ? adjustedLineHt / line.quantity : line.unit_price_ht;
          const vatRate = isForeign ? 0 : line.vat_rate;

          const existingLine = existingCnLines[line.id];

          if (isEditMode && existingLine) {
            // In edit mode: validated quantities are locked, remaining is editable and pre-filled
            const validatedQty = existingLine.validated_quantity;
            const currentReturnedQty = existingLine.returned_quantity;
            // The "already returned by OTHER credit notes" (exclude this CN's returned qty)
            const otherReturned = alreadyReturned - currentReturnedQty;
            // Max returnable = invoiced - other returns - validated in this CN
            const editableMax = line.quantity - otherReturned - validatedQty;
            // Pre-fill with current non-validated quantity
            const prefilledQty = currentReturnedQty - validatedQty;
            const lineHt = prefilledQty * adjustedUnitPrice;
            const lineVat = lineHt * (vatRate / 100);
            const lineTtc = lineHt + lineVat;

            return {
              lineId: line.id,
              productId: line.product_id,
              productName: line.product?.name || '-',
              productReference: line.product?.reference || null,
              invoicedQuantity: line.quantity,
              alreadyReturnedQuantity: otherReturned + validatedQty,
              returnableQuantity: editableMax,
              returnQuantity: prefilledQty,
              originalUnitPriceHt: line.unit_price_ht,
              adjustedUnitPriceHt: adjustedUnitPrice,
              vatRate,
              lineHt,
              lineVat,
              lineTtc,
              validatedQuantity: validatedQty,
              isLocked: editableMax <= 0,
            };
          } else if (isEditMode && !existingLine) {
            // Line not in existing CN - treat as new addable line
            const returnableQty = line.quantity - alreadyReturned;
            return {
              lineId: line.id,
              productId: line.product_id,
              productName: line.product?.name || '-',
              productReference: line.product?.reference || null,
              invoicedQuantity: line.quantity,
              alreadyReturnedQuantity: alreadyReturned,
              returnableQuantity: returnableQty,
              returnQuantity: 0,
              originalUnitPriceHt: line.unit_price_ht,
              adjustedUnitPriceHt: adjustedUnitPrice,
              vatRate,
              lineHt: 0,
              lineVat: 0,
              lineTtc: 0,
              validatedQuantity: 0,
              isLocked: returnableQty <= 0,
            };
          } else {
            // Create mode
            const returnableQty = line.quantity - alreadyReturned;
            return {
              lineId: line.id,
              productId: line.product_id,
              productName: line.product?.name || '-',
              productReference: line.product?.reference || null,
              invoicedQuantity: line.quantity,
              alreadyReturnedQuantity: alreadyReturned,
              returnableQuantity: returnableQty,
              returnQuantity: 0,
              originalUnitPriceHt: line.unit_price_ht,
              adjustedUnitPriceHt: adjustedUnitPrice,
              vatRate,
              lineHt: 0,
              lineVat: 0,
              lineTtc: 0,
              validatedQuantity: 0,
              isLocked: returnableQty <= 0,
            };
          }
        });

        setDetails({ invoice, lines, returnLines: builtReturnLines, stampDuty });
        setReturnLines(builtReturnLines);
        setWithholdingOverride(null);
        withholdingPromptShown.current = false;
      } catch (error) {
        console.error('Error fetching invoice details for product return:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [invoice, open, editCreditNoteId, isEditMode]);

  const isForeign = details?.invoice.client_type === 'foreign';

  const updateReturnQuantity = useCallback((lineId: string, qty: number) => {
    setReturnLines(prev => prev.map(rl => {
      if (rl.lineId !== lineId) return rl;
      const clamped = Math.min(Math.max(0, qty), rl.returnableQuantity);
      const lineHt = clamped * rl.adjustedUnitPriceHt;
      const lineVat = lineHt * (rl.vatRate / 100);
      const lineTtc = lineHt + lineVat;
      return { ...rl, returnQuantity: clamped, lineHt, lineVat, lineTtc };
    }));
  }, []);

  // Totals
  const totalHt = returnLines.reduce((sum, rl) => sum + rl.lineHt, 0);
  const totalVat = returnLines.reduce((sum, rl) => sum + rl.lineVat, 0);
  const totalTtc = totalHt + totalVat;
  const hasReturn = returnLines.some(rl => rl.returnQuantity > 0);

  // Withholding
  const originalWithholdingRate = details?.invoice.withholding_applied ? details.invoice.withholding_rate : 0;
  const effectiveWithholdingRate = withholdingOverride !== null ? withholdingOverride : originalWithholdingRate;
  
  // New net payable for the INVOICE after this return credit note
  // The credit note reduces the invoice by the return amount
  const returnWithholdingAmount = totalTtc * (effectiveWithholdingRate / 100);
  const returnNetAmount = totalTtc - returnWithholdingAmount;
  
  // Original net payable minus previous credits
  const stampDuty = details?.stampDuty || 0;
  const originalNetPayable = details?.invoice.net_payable || 0;
  const previousCredited = details?.invoice.total_credited || 0;
  const currentOperationalNetPayable = originalNetPayable - previousCredited;
  const newNetPayable = currentOperationalNetPayable - returnNetAmount;

  // Financial credit
  const paidAmount = details?.invoice.paid_amount || 0;
  const financialCredit = newNetPayable < paidAmount ? paidAmount - newNetPayable : 0;

  // Check: total return doesn't exceed remaining invoice
  const exceedsInvoice = returnNetAmount > currentOperationalNetPayable;

  // Withholding threshold check
  useEffect(() => {
    if (!details || withholdingPromptShown.current) return;
    if (originalWithholdingRate <= 0) return;
    const origTtc = details.invoice.total_ttc;
    const newInvoiceTtc = origTtc - totalTtc;
    if (origTtc >= 1000 && newInvoiceTtc < 1000) {
      setWithholdingDialogOpen(true);
      withholdingPromptShown.current = true;
    }
  }, [totalTtc, details, originalWithholdingRate]);

  const handleSave = async () => {
    if (!details || !invoice || !hasReturn) return;
    if (exceedsInvoice) {
      toast.error(t('credit_note_exceeds_invoice') || 'Le total de l\'avoir dépasse le restant de la facture');
      return;
    }
    setIsSaving(true);
    try {
      const currentYear = new Date().getFullYear();
      const { data: lastCn } = await supabase
        .from('credit_notes')
        .select('credit_note_counter')
        .eq('credit_note_year', currentYear)
        .order('credit_note_counter', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCounter = ((lastCn as any)?.credit_note_counter || 0) + 1;
      const cnNumber = `AV-${currentYear}-${String(nextCounter).padStart(5, '0')}`;

      // Build credit note lines (only lines with return > 0)
      const cnLines = returnLines
        .filter(rl => rl.returnQuantity > 0)
        .map((rl, idx) => ({
          invoice_line_id: rl.lineId,
          product_id: rl.productId,
          product_name: rl.productName,
          product_reference: rl.productReference,
          original_quantity: rl.invoicedQuantity,
          original_unit_price_ht: rl.originalUnitPriceHt,
          original_line_total_ht: rl.adjustedUnitPriceHt * rl.invoicedQuantity,
          original_line_vat: 0,
          original_line_total_ttc: 0,
          returned_quantity: rl.returnQuantity,
          discount_ht: rl.lineHt,
          discount_ttc: rl.lineTtc,
          discount_rate: 0,
          new_line_total_ht: 0,
          new_line_vat: 0,
          new_line_total_ttc: 0,
          vat_rate: rl.vatRate,
          line_order: idx,
        }));

      const { data: cnData, error: cnError } = await supabase
        .from('credit_notes')
        .insert({
          organization_id: invoice.organization_id,
          invoice_id: invoice.id,
          client_id: invoice.client_id,
          credit_note_number: cnNumber,
          credit_note_prefix: 'AV',
          credit_note_year: currentYear,
          credit_note_counter: nextCounter,
          credit_note_type: 'product_return',
          credit_note_method: 'lines',
          subtotal_ht: totalHt,
          total_vat: totalVat,
          total_ttc: totalTtc,
          stamp_duty_amount: stampDuty,
          withholding_rate: effectiveWithholdingRate,
          withholding_amount: returnWithholdingAmount,
          original_net_payable: currentOperationalNetPayable,
          new_net_payable: newNetPayable,
          financial_credit: financialCredit,
          status: 'created',
        } as any)
        .select()
        .single();

      if (cnError) throw cnError;

      const linesWithCnId = cnLines.map(l => ({
        ...l,
        credit_note_id: (cnData as any).id,
      }));

      const { error: linesError } = await supabase
        .from('credit_note_lines')
        .insert(linesWithCnId as any);

      if (linesError) throw linesError;

      toast.success(t('credit_note_created') || 'Avoir produit créé');
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      console.error('Error saving product return credit note:', error);
      toast.error(t('error_creating_credit_note'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!details || isLoading) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[90vh] max-h-[90vh] p-0 overflow-hidden grid grid-rows-[auto,1fr,auto]" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-2">
              {t('product_return_credit_note_title') || 'Avoir Produit (Retour)'}
              <Badge variant="outline" className="font-mono">{details.invoice.invoice_number}</Badge>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="min-h-0">
            <div className="p-6 space-y-6">
              {/* Product lines table */}
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-start p-3 font-medium">{t('product')}</th>
                      <th className="text-center p-3 font-medium">{t('invoiced_qty') || 'Qté facturée'}</th>
                      <th className="text-center p-3 font-medium">{t('already_returned_qty') || 'Déjà retournée'}</th>
                      <th className="text-center p-3 font-medium">{t('returnable_qty') || 'Retournable'}</th>
                      <th className="text-center p-3 font-medium">{t('return_qty') || 'Qté à retourner'}</th>
                      <th className="text-end p-3 font-medium">{t('adjusted_unit_price') || 'PU ajusté HT'}</th>
                      {!isForeign && <th className="text-center p-3 font-medium">{t('vat')}</th>}
                      <th className="text-end p-3 font-medium">{t('line_total') || 'Total ligne'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnLines.map((rl, idx) => (
                      <tr key={rl.lineId} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="p-3">
                          <div className="font-medium">{rl.productName}</div>
                          {rl.productReference && (
                            <div className="text-xs text-muted-foreground font-mono">{rl.productReference}</div>
                          )}
                        </td>
                        <td className="text-center p-3 font-mono">{rl.invoicedQuantity}</td>
                        <td className="text-center p-3 font-mono">
                          {rl.alreadyReturnedQuantity > 0 ? (
                            <Badge variant="secondary">{rl.alreadyReturnedQuantity}</Badge>
                          ) : '0'}
                        </td>
                        <td className="text-center p-3 font-mono font-medium">
                          {rl.returnableQuantity > 0 ? rl.returnableQuantity : (
                            <Badge variant="destructive" className="text-xs">{t('fully_returned') || 'Retourné'}</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          {rl.returnableQuantity > 0 ? (
                            <Input
                              type="number"
                              step="1"
                              min={0}
                              max={rl.returnableQuantity}
                              value={rl.returnQuantity || ''}
                              onChange={(e) => updateReturnQuantity(rl.lineId, parseFloat(e.target.value) || 0)}
                              className="w-20 h-8 text-sm mx-auto text-center"
                              placeholder="0"
                            />
                          ) : (
                            <span className="text-muted-foreground text-center block">-</span>
                          )}
                        </td>
                        <td className="text-end p-3 font-mono text-xs">
                          {formatCurrency(rl.adjustedUnitPriceHt, 'TND')}
                          {rl.adjustedUnitPriceHt !== rl.originalUnitPriceHt && (
                            <div className="text-muted-foreground line-through text-[10px]">
                              {formatCurrency(rl.originalUnitPriceHt, 'TND')}
                            </div>
                          )}
                        </td>
                        {!isForeign && <td className="text-center p-3 text-xs">{rl.vatRate}%</td>}
                        <td className="text-end p-3 font-mono font-medium">
                          {rl.returnQuantity > 0 ? formatCurrency(rl.lineTtc, 'TND') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator />

              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Return totals */}
                <div className="border rounded-lg p-4 space-y-2 bg-destructive/5">
                  <h4 className="font-semibold text-sm">{t('return_totals') || 'Montant du retour'}</h4>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subtotal_ht')}</span>
                      <span className="font-mono">{formatCurrency(totalHt, 'TND')}</span>
                    </div>
                    {!isForeign && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('total_vat')}</span>
                        <span className="font-mono">{formatCurrency(totalVat, 'TND')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>{t('total_ttc')}</span>
                      <span className="font-mono">{formatCurrency(totalTtc, 'TND')}</span>
                    </div>
                    {effectiveWithholdingRate > 0 && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-muted-foreground">
                          <span>{t('withholding')} ({effectiveWithholdingRate}%)</span>
                          <span className="font-mono">-{formatCurrency(returnWithholdingAmount, 'TND')}</span>
                        </div>
                      </>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-destructive">
                      <span>{t('return_credit_amount') || 'Montant à créditer'}</span>
                      <span className="font-mono">{formatCurrency(returnNetAmount, 'TND')}</span>
                    </div>
                  </div>
                </div>

                {/* Invoice impact */}
                <div className="border rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm">{t('invoice_impact') || 'Impact sur la facture'}</h4>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('original_net_payable') || 'Net à payer original'}</span>
                      <span className="font-mono">{formatCurrency(originalNetPayable, 'TND')}</span>
                    </div>
                    {previousCredited > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('previous_credits') || 'Avoirs précédents'}</span>
                        <span className="font-mono">-{formatCurrency(previousCredited, 'TND')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('current_remaining') || 'Restant actuel'}</span>
                      <span className="font-mono">{formatCurrency(currentOperationalNetPayable, 'TND')}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>{t('new_net_payable') || 'Nouveau net à payer'}</span>
                      <span className="font-mono">{formatCurrency(newNetPayable, 'TND')}</span>
                    </div>
                    {financialCredit > 0 && (
                      <div className="flex justify-between text-primary font-medium">
                        <span>{t('financial_credit') || 'Avoir financier'}</span>
                        <span className="font-mono">{formatCurrency(financialCredit, 'TND')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {exceedsInvoice && (
                <div className="border border-destructive rounded-lg p-3 bg-destructive/10 text-destructive text-sm">
                  {t('credit_note_exceeds_invoice') || 'Le total de l\'avoir dépasse le restant de la facture après les avoirs validés.'}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasReturn || exceedsInvoice || isSaving}
            >
              {isSaving ? t('saving') || 'Enregistrement...' : t('create_credit_note') || 'Créer l\'avoir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withholding override dialog */}
      <AlertDialog open={withholdingDialogOpen} onOpenChange={setWithholdingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('withholding_threshold_title') || 'Seuil de retenue à la source'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('withholding_threshold_message') || 'Le nouveau TTC est inférieur à 1000 TND. Souhaitez-vous maintenir la retenue à la source ?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setWithholdingOverride(0); setWithholdingDialogOpen(false); }}>
              {t('remove_withholding') || 'Annuler la retenue'}
            </Button>
            <Button onClick={() => { setWithholdingOverride(originalWithholdingRate); setWithholdingDialogOpen(false); }}>
              {t('keep_withholding') || 'Maintenir la retenue'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
