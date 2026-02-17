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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, InvoiceLine, formatCurrency } from './types';
import { toast } from 'sonner';
import { SelectedCustomTax } from './InvoiceTotals';

interface CommercialCreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
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

interface LineDiscount {
  lineId: string;
  discountHt: number;
  discountTtc: number;
  discountRate: number;
  lastEdited: 'ht' | 'ttc' | 'rate';
}

interface VatBreakdown {
  rate: number;
  baseHt: number;
  vatAmount: number;
}

interface InvoiceFullDetails {
  invoice: Invoice;
  lines: InvoiceLineWithProduct[];
  customTaxes: SelectedCustomTax[];
  stampDuty: number;
  // Remaining amounts after previous credit notes (operational base)
  remainingLineAmounts: Record<string, { remainingHt: number; remainingTtc: number }>;
  previousTotalCredited: number;
}

export const CommercialCreditNoteDialog: React.FC<CommercialCreditNoteDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onComplete,
}) => {
  const { t, isRTL } = useLanguage();
  const [details, setDetails] = useState<InvoiceFullDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'lines' | 'total'>('lines');
  const [lineDiscounts, setLineDiscounts] = useState<LineDiscount[]>([]);
  
  // For total mode
  const [totalNewHt, setTotalNewHt] = useState(0);
  const [totalLastEdited, setTotalLastEdited] = useState<'ht' | 'ttc' | 'vat'>('ht');
  const [totalNewTtc, setTotalNewTtc] = useState(0);
  
  // Withholding override
  const [withholdingOverride, setWithholdingOverride] = useState<number | null>(null);
  const [withholdingDialogOpen, setWithholdingDialogOpen] = useState(false);
  const withholdingPromptShown = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch full invoice details
  useEffect(() => {
    const fetchDetails = async () => {
      if (!invoice || !open) return;
      setIsLoading(true);
      try {
        const [linesRes, taxesRes, prevCreditNotesRes] = await Promise.all([
          supabase
            .from('invoice_lines')
            .select('*, product:products(id, name, reference, ean)')
            .eq('invoice_id', invoice.id)
            .order('line_order', { ascending: true }),
          supabase
            .from('invoice_custom_taxes')
            .select('*, tax_value:custom_tax_values(*, tax_type:custom_tax_types(*))')
            .eq('invoice_id', invoice.id),
          supabase
            .from('credit_notes')
            .select('id, status, subtotal_ht, total_vat, total_ttc, original_net_payable, new_net_payable')
            .eq('invoice_id', invoice.id)
            .in('status', ['validated', 'draft']),
        ]);

        const lines = (linesRes.data || []) as unknown as InvoiceLineWithProduct[];
        const validatedCreditNotes = (prevCreditNotesRes.data || []).filter((cn: any) => cn.status === 'validated');

        // Fetch previous credit note lines for validated credit notes
        let remainingLineAmounts: Record<string, { remainingHt: number; remainingTtc: number }> = {};
        let previousTotalCredited = 0;

        // Initialize with original line amounts
        lines.forEach(l => {
          remainingLineAmounts[l.id] = { remainingHt: l.line_total_ht, remainingTtc: l.line_total_ttc };
        });

        if (validatedCreditNotes.length > 0) {
          const cnIds = validatedCreditNotes.map((cn: any) => cn.id);
          const { data: prevLines } = await supabase
            .from('credit_note_lines')
            .select('invoice_line_id, discount_ht, discount_ttc')
            .in('credit_note_id', cnIds);

          if (prevLines) {
            prevLines.forEach((pl: any) => {
              if (remainingLineAmounts[pl.invoice_line_id]) {
                remainingLineAmounts[pl.invoice_line_id].remainingHt -= pl.discount_ht;
                remainingLineAmounts[pl.invoice_line_id].remainingTtc -= pl.discount_ttc;
              }
            });
          }

          previousTotalCredited = validatedCreditNotes.reduce((sum: number, cn: any) => {
            return sum + (cn.original_net_payable - cn.new_net_payable);
          }, 0);
        }

        // Map custom taxes
        const customTaxes: SelectedCustomTax[] = (taxesRes.data || []).map((t: any) => ({
          taxTypeId: t.tax_value?.tax_type?.id || '',
          taxValueId: t.tax_value_id,
          taxName: `${t.tax_value?.tax_type?.name || ''}${t.tax_value?.label ? ` - ${t.tax_value.label}` : ''}`,
          value: t.applied_value,
          valueType: (t.tax_value?.tax_type?.value_type || 'fixed') as 'fixed' | 'percentage',
          applicationType: (t.tax_value?.tax_type?.application_type || 'add') as 'add' | 'deduct',
          applicationOrder: (t.tax_value?.tax_type?.application_order || 'before_stamp') as 'before_stamp' | 'after_stamp',
        }));

        const stampDuty = invoice.stamp_duty_enabled ? invoice.stamp_duty_amount : 0;

        // Compute operational amounts (remaining after previous credit notes)
        const operationalSubtotalHt = Object.values(remainingLineAmounts).reduce((sum, v) => sum + v.remainingHt, 0);
        const operationalTotalTtc = Object.values(remainingLineAmounts).reduce((sum, v) => sum + v.remainingTtc, 0);

        setDetails({ invoice, lines, customTaxes, stampDuty, remainingLineAmounts, previousTotalCredited });
        
        // Init line discounts
        setLineDiscounts(lines.map(l => ({
          lineId: l.id,
          discountHt: 0,
          discountTtc: 0,
          discountRate: 0,
          lastEdited: 'ht',
        })));

        setTotalNewHt(operationalSubtotalHt);
        setTotalNewTtc(operationalTotalTtc);
        setWithholdingOverride(null);
        withholdingPromptShown.current = false;
      } catch (error) {
        console.error('Error fetching invoice details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [invoice, open]);

  const isForeign = details?.invoice.client_type === 'foreign';

  // Sync line discount fields (capped by remaining amounts after previous credit notes)
  const updateLineDiscount = useCallback((lineId: string, field: 'ht' | 'ttc' | 'rate', value: number) => {
    if (!details) return;
    setLineDiscounts(prev => prev.map(ld => {
      if (ld.lineId !== lineId) return ld;
      const line = details.lines.find(l => l.id === lineId);
      if (!line) return ld;

      const vatRate = isForeign ? 0 : line.vat_rate;
      const remaining = details.remainingLineAmounts[lineId];
      const maxHt = remaining?.remainingHt ?? line.line_total_ht;
      const maxTtc = remaining?.remainingTtc ?? line.line_total_ttc;

      if (field === 'ht') {
        const discountHt = Math.min(Math.max(0, value), maxHt);
        const discountTtc = discountHt * (1 + vatRate / 100);
        const discountRate = maxHt > 0 ? (discountHt / maxHt) * 100 : 0;
        return { ...ld, discountHt, discountTtc, discountRate, lastEdited: 'ht' };
      } else if (field === 'ttc') {
        const discountTtc = Math.min(Math.max(0, value), maxTtc);
        const discountHt = discountTtc / (1 + vatRate / 100);
        const discountRate = maxHt > 0 ? (discountHt / maxHt) * 100 : 0;
        return { ...ld, discountHt, discountTtc, discountRate, lastEdited: 'ttc' };
      } else {
        const discountRate = Math.min(Math.max(0, value), 100);
        const discountHt = maxHt * (discountRate / 100);
        const discountTtc = discountHt * (1 + vatRate / 100);
        return { ...ld, discountHt, discountTtc, discountRate, lastEdited: 'rate' };
      }
    }));
  }, [details, isForeign]);

  // Compute new totals from line discounts (Mode 1) - based on remaining amounts
  const computeLineTotals = useCallback(() => {
    if (!details) return null;
    
    let newSubtotalHt = 0;
    let totalDiscountHt = 0;
    const vatMap: Record<number, { base: number; vat: number }> = {};

    details.lines.forEach(line => {
      const ld = lineDiscounts.find(d => d.lineId === line.id);
      const discountHt = ld?.discountHt || 0;
      const remaining = details.remainingLineAmounts[line.id];
      const remainingHt = remaining?.remainingHt ?? line.line_total_ht;
      const newLineHt = remainingHt - discountHt;
      const vatRate = isForeign ? 0 : line.vat_rate;
      const newLineVat = newLineHt * (vatRate / 100);

      newSubtotalHt += newLineHt;
      totalDiscountHt += discountHt;

      if (vatRate > 0) {
        if (!vatMap[vatRate]) vatMap[vatRate] = { base: 0, vat: 0 };
        vatMap[vatRate].base += newLineHt;
        vatMap[vatRate].vat += newLineVat;
      }
    });

    const newTotalVat = Object.values(vatMap).reduce((sum, v) => sum + v.vat, 0);
    const newTotalTtc = newSubtotalHt + newTotalVat;

    const vatBreakdown: VatBreakdown[] = Object.entries(vatMap)
      .map(([rate, { base, vat }]) => ({ rate: Number(rate), baseHt: base, vatAmount: vat }))
      .sort((a, b) => a.rate - b.rate);

    return { newSubtotalHt, newTotalVat, newTotalTtc, vatBreakdown, totalDiscountHt };
  }, [details, lineDiscounts, isForeign]);

  // Compute new totals from total mode (Mode 2) - based on remaining amounts
  const computeTotalModeTotals = useCallback(() => {
    if (!details) return null;

    // Remaining operational HT
    const operationalHt = Object.values(details.remainingLineAmounts).reduce((sum, v) => sum + v.remainingHt, 0);
    const ratio = operationalHt > 0 ? totalNewHt / operationalHt : 1;

    const vatMap: Record<number, { base: number; vat: number }> = {};
    let newSubtotalHt = 0;

    details.lines.forEach(line => {
      const remaining = details.remainingLineAmounts[line.id];
      const remainingHt = remaining?.remainingHt ?? line.line_total_ht;
      const newLineHt = remainingHt * ratio;
      const vatRate = isForeign ? 0 : line.vat_rate;
      const newLineVat = newLineHt * (vatRate / 100);

      newSubtotalHt += newLineHt;

      if (vatRate > 0) {
        if (!vatMap[vatRate]) vatMap[vatRate] = { base: 0, vat: 0 };
        vatMap[vatRate].base += newLineHt;
        vatMap[vatRate].vat += newLineVat;
      }
    });

    const newTotalVat = Object.values(vatMap).reduce((sum, v) => sum + v.vat, 0);
    const newTotalTtc = newSubtotalHt + newTotalVat;

    const vatBreakdown: VatBreakdown[] = Object.entries(vatMap)
      .map(([rate, { base, vat }]) => ({ rate: Number(rate), baseHt: base, vatAmount: vat }))
      .sort((a, b) => a.rate - b.rate);

    return { newSubtotalHt, newTotalVat, newTotalTtc, vatBreakdown, totalDiscountHt: operationalHt - newSubtotalHt };
  }, [details, totalNewHt, isForeign]);

  const newTotals = mode === 'lines' ? computeLineTotals() : computeTotalModeTotals();

  // Compute custom taxes amount
  const computeCustomTaxesAmount = useCallback((baseTtc: number) => {
    if (!details) return 0;
    let taxTotal = 0;
    details.customTaxes.forEach(tax => {
      const amount = tax.valueType === 'fixed' ? tax.value : baseTtc * (tax.value / 100);
      taxTotal += tax.applicationType === 'add' ? amount : -amount;
    });
    return taxTotal;
  }, [details]);

  // Original invoice total (TTC + stamp + taxes)
  const originalInvoiceTotal = details
    ? details.invoice.total_ttc + computeCustomTaxesAmount(details.invoice.total_ttc) + details.stampDuty
    : 0;

  // New invoice total
  const newTtc = newTotals?.newTotalTtc || 0;
  const newCustomTaxes = computeCustomTaxesAmount(newTtc);
  const newInvoiceTotal = newTtc + newCustomTaxes + (details?.stampDuty || 0);

  // Withholding logic
  const originalWithholdingRate = details?.invoice.withholding_applied ? details.invoice.withholding_rate : 0;
  const effectiveWithholdingRate = withholdingOverride !== null ? withholdingOverride : originalWithholdingRate;
  const newWithholdingAmount = newTtc * (effectiveWithholdingRate / 100);
  const newNetPayable = newTtc - newWithholdingAmount + (details?.stampDuty || 0) + newCustomTaxes;

  // Check withholding threshold
  useEffect(() => {
    if (!details || !newTotals || withholdingPromptShown.current) return;
    if (originalWithholdingRate <= 0) return;
    const origTtc = details.invoice.total_ttc;
    if (origTtc >= 1000 && newTtc < 1000) {
      setWithholdingDialogOpen(true);
      withholdingPromptShown.current = true;
    }
  }, [newTtc, details, originalWithholdingRate, newTotals]);

  // Financial credit calculation
  const paidAmount = details?.invoice.paid_amount || 0;
  const isPaidOrPartial = details ? details.invoice.payment_status === 'paid' || details.invoice.payment_status === 'partial' : false;
  const financialCredit = isPaidOrPartial && newNetPayable < paidAmount ? paidAmount - newNetPayable : 0;

  // Original VAT breakdown
  const originalVatBreakdown = useCallback((): VatBreakdown[] => {
    if (!details) return [];
    const vatMap: Record<number, { base: number; vat: number }> = {};
    details.lines.forEach(line => {
      const vatRate = isForeign ? 0 : line.vat_rate;
      if (vatRate > 0) {
        if (!vatMap[vatRate]) vatMap[vatRate] = { base: 0, vat: 0 };
        vatMap[vatRate].base += line.line_total_ht;
        vatMap[vatRate].vat += line.line_vat;
      }
    });
    return Object.entries(vatMap)
      .map(([rate, { base, vat }]) => ({ rate: Number(rate), baseHt: base, vatAmount: vat }))
      .sort((a, b) => a.rate - b.rate);
  }, [details, isForeign]);

  // Handle total mode HT change (capped by remaining operational HT)
  const operationalHt = details ? Object.values(details.remainingLineAmounts).reduce((sum, v) => sum + v.remainingHt, 0) : 0;
  const operationalTtc = details ? Object.values(details.remainingLineAmounts).reduce((sum, v) => sum + v.remainingTtc, 0) : 0;

  const handleTotalHtChange = (value: number) => {
    if (!details) return;
    const clamped = Math.min(Math.max(0, value), operationalHt);
    setTotalNewHt(clamped);
    setTotalLastEdited('ht');
  };

  // Handle total mode TTC change - reverse-calculate HT
  const handleTotalTtcChange = (value: number) => {
    if (!details) return;
    const clamped = Math.min(Math.max(0, value), operationalTtc);
    if (operationalTtc > 0) {
      const ratio = clamped / operationalTtc;
      setTotalNewHt(operationalHt * ratio);
    }
    setTotalLastEdited('ttc');
  };

  // Handle total mode VAT change
  const handleTotalVatChange = (value: number) => {
    if (!details) return;
    const operationalVat = operationalTtc - operationalHt;
    const clamped = Math.min(Math.max(0, value), operationalVat);
    if (operationalVat > 0) {
      const ratio = clamped / operationalVat;
      setTotalNewHt(operationalHt * ratio);
    }
    setTotalLastEdited('vat');
  };

  const hasDiscount = newTotals ? newTotals.totalDiscountHt > 0 : false;

  // Save to DB
  const handleSave = async () => {
    if (!details || !newTotals || !invoice) return;
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

      const originalRatio = operationalHt > 0 ? totalNewHt / operationalHt : 1;

      // Build line data - using remaining amounts as the base
      const buildLines = () => {
        return details.lines.map((line, idx) => {
          const remaining = details.remainingLineAmounts[line.id];
          const remainingHt = remaining?.remainingHt ?? line.line_total_ht;
          let discountHt: number, discountRate: number;
          if (mode === 'lines') {
            const ld = lineDiscounts.find(d => d.lineId === line.id);
            discountHt = ld?.discountHt || 0;
            discountRate = ld?.discountRate || 0;
          } else {
            discountHt = remainingHt * (1 - originalRatio);
            discountRate = remainingHt > 0 ? (discountHt / remainingHt) * 100 : 0;
          }
          const vatRate = isForeign ? 0 : line.vat_rate;
          const newLineHt = remainingHt - discountHt;
          const newLineVat = newLineHt * (vatRate / 100);
          const newLineTtc = newLineHt + newLineVat;
          const discountTtc = discountHt * (1 + vatRate / 100);

          return {
            invoice_line_id: line.id,
            product_id: line.product_id,
            product_name: line.product?.name || null,
            product_reference: line.product?.reference || null,
            original_quantity: line.quantity,
            original_unit_price_ht: line.unit_price_ht,
            original_line_total_ht: remainingHt,
            original_line_vat: line.line_vat,
            original_line_total_ttc: remaining?.remainingTtc ?? line.line_total_ttc,
            discount_ht: discountHt,
            discount_ttc: discountTtc,
            discount_rate: discountRate,
            new_line_total_ht: newLineHt,
            new_line_vat: newLineVat,
            new_line_total_ttc: newLineTtc,
            vat_rate: vatRate,
            line_order: idx,
          };
        });
      };

      const cnLines = buildLines();

      // Compute the credit amount (difference between current operational net payable and new net payable)
      const currentOperationalNetPayable = invoice.net_payable - details.previousTotalCredited;
      const thisCreditAmount = currentOperationalNetPayable - newNetPayable;

      // Insert credit note
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
          credit_note_type: 'commercial_price',
          credit_note_method: mode,
          subtotal_ht: newTotals.newSubtotalHt,
          total_vat: newTotals.newTotalVat,
          total_ttc: newTotals.newTotalTtc,
          stamp_duty_amount: details.stampDuty,
          withholding_rate: effectiveWithholdingRate,
          withholding_amount: newWithholdingAmount,
          original_net_payable: currentOperationalNetPayable,
          new_net_payable: newNetPayable,
          financial_credit: financialCredit,
          status: 'validated',
        } as any)
        .select()
        .single();

      if (cnError) throw cnError;

      // Insert lines
      const linesWithCnId = cnLines.map(l => ({
        ...l,
        credit_note_id: (cnData as any).id,
      }));

      const { error: linesError } = await supabase
        .from('credit_note_lines')
        .insert(linesWithCnId as any);

      if (linesError) throw linesError;

      // Update invoice operational fields (total_credited, credit_note_count)
      const newTotalCredited = details.previousTotalCredited + thisCreditAmount;
      const { error: invoiceUpdateError } = await supabase
        .from('invoices')
        .update({
          total_credited: newTotalCredited,
          credit_note_count: (invoice.credit_note_count || 0) + 1,
        })
        .eq('id', invoice.id);

      if (invoiceUpdateError) throw invoiceUpdateError;

      toast.success(t('credit_note_created'));
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      console.error('Error saving credit note:', error);
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
              {t('commercial_credit_note_title')}
              <Badge variant="outline" className="font-mono">{details.invoice.invoice_number}</Badge>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="min-h-0">
            <div className="p-6 space-y-6">
              {/* Mode tabs */}
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'lines' | 'total')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="lines">{t('mode_line_discount')}</TabsTrigger>
                  <TabsTrigger value="total">{t('mode_total_discount')}</TabsTrigger>
                </TabsList>

                {/* Mode 1: Line discounts */}
                <TabsContent value="lines" className="mt-4">
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-start p-3 font-medium">{t('product')}</th>
                          <th className="text-end p-3 font-medium">{t('subtotal_ht')}</th>
                          {!isForeign && <th className="text-center p-3 font-medium">{t('vat')}</th>}
                          <th className="text-end p-3 font-medium">{t('total_ttc')}</th>
                          <th className="text-center p-3 font-medium">{t('discount_ht')}</th>
                          <th className="text-center p-3 font-medium">{t('discount_ttc')}</th>
                          <th className="text-center p-3 font-medium">{t('discount_rate')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.lines.map((line, idx) => {
                          const ld = lineDiscounts.find(d => d.lineId === line.id);
                          return (
                            <tr key={line.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                              <td className="p-3">
                                <div className="font-medium">{line.product?.name || '-'}</div>
                                {line.product?.reference && (
                                  <div className="text-xs text-muted-foreground font-mono">{line.product.reference}</div>
                                )}
                              </td>
                              <td className="text-end p-3 font-mono">{formatCurrency(line.line_total_ht, 'TND')}</td>
                              {!isForeign && <td className="text-center p-3">{line.vat_rate}%</td>}
                              <td className="text-end p-3 font-mono">{formatCurrency(line.line_total_ttc, 'TND')}</td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.001"
                                  min={0}
                                  max={line.line_total_ht}
                                  value={ld?.discountHt || ''}
                                  onChange={(e) => updateLineDiscount(line.id, 'ht', parseFloat(e.target.value) || 0)}
                                  className="w-24 h-8 text-sm mx-auto"
                                  placeholder="0.000"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.001"
                                  min={0}
                                  max={line.line_total_ttc}
                                  value={ld?.discountTtc || ''}
                                  onChange={(e) => updateLineDiscount(line.id, 'ttc', parseFloat(e.target.value) || 0)}
                                  className="w-24 h-8 text-sm mx-auto"
                                  placeholder="0.000"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  max={100}
                                  value={ld?.discountRate || ''}
                                  onChange={(e) => updateLineDiscount(line.id, 'rate', parseFloat(e.target.value) || 0)}
                                  className="w-20 h-8 text-sm mx-auto"
                                  placeholder="0.00"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Mode 2: Total discount */}
                <TabsContent value="total" className="mt-4">
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('new_total_ht')}</label>
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          max={details.invoice.subtotal_ht}
                          value={totalNewHt}
                          onChange={(e) => handleTotalHtChange(parseFloat(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('new_total_vat')}</label>
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          max={details.invoice.total_vat}
                          value={newTotals?.newTotalVat?.toFixed(3) || '0.000'}
                          onChange={(e) => handleTotalVatChange(parseFloat(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">{t('new_total_ttc')}</label>
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          max={details.invoice.total_ttc}
                          value={newTotals?.newTotalTtc?.toFixed(3) || '0.000'}
                          onChange={(e) => handleTotalTtcChange(parseFloat(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {newTotals && newTotals.vatBreakdown.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">{t('vat_breakdown')}</label>
                        {newTotals.vatBreakdown.map(v => (
                          <div key={v.rate} className="flex justify-between text-sm text-muted-foreground">
                            <span>{t('vat')} {v.rate}% ({formatCurrency(v.baseHt, 'TND')})</span>
                            <span>{formatCurrency(v.vatAmount, 'TND')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <Separator />

              {/* Two totals blocks side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Block 1: Original totals (read-only) */}
                <div className="border rounded-lg p-4 space-y-2 bg-muted/20">
                  <h4 className="font-semibold text-sm">{t('original_totals')}</h4>
                  <Separator />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subtotal_ht')}</span>
                      <span className="font-mono">{formatCurrency(details.invoice.subtotal_ht, 'TND')}</span>
                    </div>
                    {originalVatBreakdown().map(v => (
                      <div key={v.rate} className="flex justify-between text-muted-foreground">
                        <span>{t('vat')} {v.rate}%</span>
                        <span className="font-mono">{formatCurrency(v.vatAmount, 'TND')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium">
                      <span>{t('total_ttc')}</span>
                      <span className="font-mono">{formatCurrency(details.invoice.total_ttc, 'TND')}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>{t('total_invoice')}</span>
                      <span className="font-mono">{formatCurrency(originalInvoiceTotal, 'TND')}</span>
                    </div>

                    {/* Payment info */}
                    {isPaidOrPartial ? (
                      <>
                        {originalWithholdingRate > 0 && (
                          <>
                            <div className="flex justify-between text-amber-600">
                              <span>{t('withholding_tax')} ({originalWithholdingRate}%)</span>
                              <span className="font-mono">-{formatCurrency(details.invoice.withholding_amount, 'TND')}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between font-semibold">
                          <span>{t('net_payable')}</span>
                          <span className="font-mono text-primary">{formatCurrency(details.invoice.net_payable, 'TND')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('amount_paid')}</span>
                          <span className="font-mono">{formatCurrency(paidAmount, 'TND')}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-2">
                        <Badge variant="outline" className="text-red-600 border-red-300">{t('invoice_unpaid')}</Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Block 2: New totals (real-time) */}
                <div className="border rounded-lg p-4 space-y-2 bg-primary/5 border-primary/20">
                  <h4 className="font-semibold text-sm">{t('new_totals')}</h4>
                  <Separator />
                  {newTotals ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('new_total_ht')}</span>
                        <span className="font-mono">{formatCurrency(newTotals.newSubtotalHt, 'TND')}</span>
                      </div>
                      {newTotals.vatBreakdown.map(v => (
                        <div key={v.rate} className="flex justify-between text-muted-foreground">
                          <span>{t('vat')} {v.rate}%</span>
                          <span className="font-mono">{formatCurrency(v.vatAmount, 'TND')}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-medium">
                        <span>{t('new_total_ttc')}</span>
                        <span className="font-mono">{formatCurrency(newTotals.newTotalTtc, 'TND')}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>{t('new_total_invoice')}</span>
                        <span className="font-mono">{formatCurrency(newInvoiceTotal, 'TND')}</span>
                      </div>

                      {/* Withholding */}
                      {effectiveWithholdingRate > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>{t('withholding_tax')} ({effectiveWithholdingRate}%)</span>
                          <span className="font-mono">-{formatCurrency(newWithholdingAmount, 'TND')}</span>
                        </div>
                      )}

                      <div className="flex justify-between font-semibold text-base">
                        <span>{t('new_net_payable')}</span>
                        <span className="font-mono text-primary">{formatCurrency(newNetPayable, 'TND')}</span>
                      </div>

                      {/* Financial credit */}
                      {isPaidOrPartial && (
                        <>
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>{t('financial_credit')}</span>
                            <span className={`font-mono ${financialCredit > 0 ? 'text-green-600' : ''}`}>
                              {formatCurrency(financialCredit, 'TND')}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      {t('no_discount_applied')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/30 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={!hasDiscount || isSaving}
              onClick={handleSave}
            >
              {isSaving ? t('processing') : t('confirm_commercial_credit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withholding threshold popup */}
      <AlertDialog open={withholdingDialogOpen} onOpenChange={setWithholdingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('withholding_threshold_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('withholding_threshold_message')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWithholdingOverride(originalWithholdingRate);
                setWithholdingDialogOpen(false);
              }}
            >
              {t('keep_withholding')}
            </Button>
            <Button
              onClick={() => {
                setWithholdingOverride(0);
                setWithholdingDialogOpen(false);
              }}
            >
              {t('cancel_withholding')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};