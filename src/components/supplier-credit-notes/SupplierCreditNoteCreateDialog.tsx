import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, 
  ArrowLeft,
  ArrowRight,
  Package,
  Banknote,
  AlertCircle,
  Check,
  RotateCcw,
  Calculator
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SupplierCreditNoteType, SupplierCreditNoteLineInput, PurchaseLineForCredit, SUPPLIER_RETURN_REASONS } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface PurchaseDocument {
  id: string;
  invoice_number: string | null;
  supplier_id: string;
  supplier?: {
    id: string;
    supplier_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  } | null;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  net_payable: number;
  total_credited: number;
  currency: string;
  exchange_rate: number;
  organization_id: string;
}

interface SupplierCreditNoteCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseDocument: PurchaseDocument | null;
  onCreated: () => void;
}

type Step = 'type' | 'lines' | 'summary';

export const SupplierCreditNoteCreateDialog: React.FC<SupplierCreditNoteCreateDialogProps> = ({
  open,
  onOpenChange,
  purchaseDocument,
  onCreated,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [step, setStep] = useState<Step>('type');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [creditNoteType, setCreditNoteType] = useState<SupplierCreditNoteType | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [creditNoteDate, setCreditNoteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Purchase lines state
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLineForCredit[]>([]);
  const [selectedLines, setSelectedLines] = useState<Map<string, SupplierCreditNoteLineInput>>(new Map());
  const [creditedQuantities, setCreditedQuantities] = useState<Map<string, number>>(new Map());
  
  // Total existing credit notes
  const [totalExistingCredits, setTotalExistingCredits] = useState(0);
  
  // Financial line
  const [financialAmount, setFinancialAmount] = useState(0);
  const [financialDescription, setFinancialDescription] = useState('');

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    if (open) {
      setStep('type');
      setCreditNoteType(null);
      setReason('');
      setNotes('');
      setCreditNoteDate(format(new Date(), 'yyyy-MM-dd'));
      setSelectedLines(new Map());
      setFinancialAmount(0);
      setFinancialDescription('');
      if (purchaseDocument) {
        fetchPurchaseLines();
      }
    }
  }, [open, purchaseDocument]);

  const fetchPurchaseLines = async () => {
    if (!purchaseDocument) return;
    setIsLoading(true);
    try {
      const { data: linesData, error: linesError } = await supabase
        .from('purchase_lines')
        .select(`
          *,
          product:products(id, name, reference, product_type)
        `)
        .eq('purchase_document_id', purchaseDocument.id)
        .order('line_order', { ascending: true });

      if (linesError) throw linesError;

      const { data: allCreditNotes, error: allCnError } = await supabase
        .from('supplier_credit_notes')
        .select('id, credit_note_type, net_amount')
        .eq('purchase_document_id', purchaseDocument.id)
        .eq('status', 'validated');

      if (allCnError) throw allCnError;

      const totalCredits = (allCreditNotes || []).reduce((sum, cn) => sum + (cn.net_amount || 0), 0);
      setTotalExistingCredits(totalCredits);

      const productReturnCNs = (allCreditNotes || []).filter(cn => cn.credit_note_type === 'product_return');
      const creditedQtyMap = new Map<string, number>();

      if (productReturnCNs.length > 0) {
        const cnIds = productReturnCNs.map(cn => cn.id);
        const { data: creditedLines, error: clError } = await supabase
          .from('supplier_credit_note_lines')
          .select('purchase_line_id, quantity')
          .in('supplier_credit_note_id', cnIds)
          .not('purchase_line_id', 'is', null);

        if (clError) throw clError;

        (creditedLines || []).forEach(cl => {
          if (cl.purchase_line_id) {
            const current = creditedQtyMap.get(cl.purchase_line_id) || 0;
            creditedQtyMap.set(cl.purchase_line_id, current + cl.quantity);
          }
        });
      }

      setCreditedQuantities(creditedQtyMap);
      setPurchaseLines((linesData || []) as PurchaseLineForCredit[]);
    } catch (error) {
      console.error('Error fetching purchase lines:', error);
      toast.error(t('error_loading_data'));
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableQuantity = (lineId: string, originalQuantity: number): number => {
    const credited = creditedQuantities.get(lineId) || 0;
    return Math.max(0, originalQuantity - credited);
  };

  const handleLineSelect = (line: PurchaseLineForCredit, selected: boolean) => {
    const availableQty = getAvailableQuantity(line.id, line.quantity);
    if (availableQty <= 0) return;
    
    const newSelected = new Map(selectedLines);
    if (selected) {
      newSelected.set(line.id, {
        purchase_line_id: line.id,
        product_id: line.product_id || undefined,
        description: line.product?.name || line.name || '',
        quantity: availableQty,
        unit_price_ht: line.unit_price_ht,
        vat_rate: line.vat_rate,
        discount_percent: line.discount_percent,
        return_reason: creditNoteType === 'product_return' ? 'quality_issue' : undefined,
      });
    } else {
      newSelected.delete(line.id);
    }
    setSelectedLines(newSelected);
  };

  const handleLineQuantityChange = (lineId: string, quantity: number, maxQty: number) => {
    const line = selectedLines.get(lineId);
    if (!line) return;
    const newSelected = new Map(selectedLines);
    newSelected.set(lineId, {
      ...line,
      quantity: Math.min(Math.max(0, quantity), maxQty),
    });
    setSelectedLines(newSelected);
  };

  const handleReturnReasonChange = (lineId: string, reason: string) => {
    const line = selectedLines.get(lineId);
    if (!line) return;
    const newSelected = new Map(selectedLines);
    newSelected.set(lineId, {
      ...line,
      return_reason: reason,
    });
    setSelectedLines(newSelected);
  };

  const maxAvailableCredit = useMemo(() => {
    if (!purchaseDocument) return 0;
    const purchaseTotal = purchaseDocument.total_ttc || 0;
    const remaining = purchaseTotal - totalExistingCredits;
    return Math.max(0, remaining);
  }, [purchaseDocument, totalExistingCredits]);

  const isDocumentFullyCredited = maxAvailableCredit <= 0;

  const totals = useMemo(() => {
    if (creditNoteType === 'financial') {
      const vatRate = purchaseDocument?.supplier?.supplier_type === 'foreign' ? 0 : 19;
      const vatAmount = financialAmount * vatRate / 100;
      return {
        subtotal_ht: financialAmount,
        total_vat: vatAmount,
        total_ttc: financialAmount + vatAmount,
        net_amount: financialAmount + vatAmount,
      };
    }

    let subtotal_ht = 0;
    let total_vat = 0;

    selectedLines.forEach((lineInput, lineId) => {
      const originalLine = purchaseLines.find(l => l.id === lineId);
      if (!originalLine) return;

      const unitPriceAfterDiscount = lineInput.unit_price_ht * (1 - lineInput.discount_percent / 100);
      const lineHT = unitPriceAfterDiscount * lineInput.quantity;
      const lineVAT = lineHT * lineInput.vat_rate / 100;

      subtotal_ht += lineHT;
      total_vat += lineVAT;
    });

    return {
      subtotal_ht,
      total_vat,
      total_ttc: subtotal_ht + total_vat,
      net_amount: subtotal_ht + total_vat,
    };
  }, [creditNoteType, financialAmount, selectedLines, purchaseLines, purchaseDocument]);

  const isFinancialAmountValid = creditNoteType === 'financial' 
    ? financialAmount > 0 && totals.net_amount <= maxAvailableCredit
    : true;

  const isProductReturnAmountValid = creditNoteType === 'product_return'
    ? totals.net_amount <= maxAvailableCredit
    : true;

  const canProceedToLines = creditNoteType !== null && !isDocumentFullyCredited;
  const canProceedToSummary = creditNoteType === 'financial' 
    ? financialAmount > 0 && financialDescription.trim() !== '' && isFinancialAmountValid
    : selectedLines.size > 0 && isProductReturnAmountValid;

  const handleSave = async (immediateReturn: boolean = false) => {
    if (!purchaseDocument) return;
    setIsSaving(true);

    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .single();
      if (orgError) throw orgError;

      const currentYear = new Date().getFullYear();
      const { data: lastCN, error: lastError } = await supabase
        .from('supplier_credit_notes')
        .select('credit_note_counter')
        .eq('organization_id', org.id)
        .eq('credit_note_year', currentYear)
        .order('credit_note_counter', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastError) throw lastError;

      const counter = (lastCN?.credit_note_counter || 0) + 1;
      const prefix = 'AVF';
      const creditNoteNumber = `${prefix}-${currentYear}-${String(counter).padStart(4, '0')}`;

      const creditAmount = totals.net_amount;
      
      let creditBlocked = 0;
      let creditAvailable = 0;
      let creditGenerated = 0;
      
      if (creditNoteType === 'financial') {
        creditGenerated = creditAmount;
        creditAvailable = creditAmount;
        creditBlocked = 0;
      } else {
        creditGenerated = creditAmount;
        if (immediateReturn) {
          creditAvailable = creditAmount;
          creditBlocked = 0;
        } else {
          creditAvailable = 0;
          creditBlocked = creditAmount;
        }
      }

      const { data: creditNote, error: cnError } = await supabase
        .from('supplier_credit_notes')
        .insert({
          organization_id: org.id,
          purchase_document_id: purchaseDocument.id,
          supplier_id: purchaseDocument.supplier_id,
          credit_note_number: creditNoteNumber,
          credit_note_prefix: prefix,
          credit_note_year: currentYear,
          credit_note_counter: counter,
          credit_note_type: creditNoteType,
          credit_note_date: creditNoteDate,
          reason,
          subtotal_ht: totals.subtotal_ht,
          total_vat: totals.total_vat,
          total_ttc: totals.total_ttc,
          net_amount: totals.net_amount,
          credit_generated: creditGenerated,
          credit_available: creditAvailable,
          credit_blocked: creditBlocked,
          status: 'validated',
          currency: purchaseDocument.currency,
          exchange_rate: purchaseDocument.exchange_rate,
          notes,
        })
        .select()
        .single();

      if (cnError) throw cnError;

      if (creditNoteType === 'financial') {
        const { error: lineError } = await supabase
          .from('supplier_credit_note_lines')
          .insert({
            supplier_credit_note_id: creditNote.id,
            description: financialDescription,
            quantity: 1,
            unit_price_ht: financialAmount,
            vat_rate: purchaseDocument.supplier?.supplier_type === 'foreign' ? 0 : 19,
            line_total_ht: totals.subtotal_ht,
            line_vat: totals.total_vat,
            line_total_ttc: totals.total_ttc,
            line_order: 0,
          });
        if (lineError) throw lineError;
      } else {
        let lineOrder = 0;
        for (const [lineId, lineInput] of selectedLines) {
          const originalLine = purchaseLines.find(l => l.id === lineId);
          if (!originalLine) continue;

          const unitPriceAfterDiscount = lineInput.unit_price_ht * (1 - lineInput.discount_percent / 100);
          const lineHT = unitPriceAfterDiscount * lineInput.quantity;
          const lineVAT = lineHT * lineInput.vat_rate / 100;

          const { error: lineError } = await supabase
            .from('supplier_credit_note_lines')
            .insert({
              supplier_credit_note_id: creditNote.id,
              product_id: lineInput.product_id,
              purchase_line_id: lineInput.purchase_line_id,
              description: lineInput.description,
              quantity: lineInput.quantity,
              unit_price_ht: lineInput.unit_price_ht,
              vat_rate: lineInput.vat_rate,
              discount_percent: lineInput.discount_percent,
              line_total_ht: lineHT,
              line_vat: lineVAT,
              line_total_ttc: lineHT + lineVAT,
              return_reason: lineInput.return_reason,
              stock_deducted: immediateReturn,
              line_order: lineOrder++,
            });
          if (lineError) throw lineError;

          // Deduct stock if immediate return
          if (immediateReturn && originalLine.product?.product_type === 'physical' && lineInput.product_id) {
            const { data: product, error: prodError } = await supabase
              .from('products')
              .select('current_stock, unlimited_stock')
              .eq('id', lineInput.product_id)
              .single();
            
            if (!prodError && product && !product.unlimited_stock) {
              const previousStock = product.current_stock ?? 0;
              const newStock = Math.max(0, previousStock - lineInput.quantity);

              const { error: stockError } = await supabase
                .from('products')
                .update({ current_stock: newStock })
                .eq('id', lineInput.product_id);

              if (!stockError) {
                await supabase
                  .from('stock_movements')
                  .insert({
                    product_id: lineInput.product_id,
                    movement_type: 'remove',
                    quantity: lineInput.quantity,
                    previous_stock: previousStock,
                    new_stock: newStock,
                    reason_category: t('supplier_credit_note_return'),
                    reason_detail: `${t('supplier_credit_note')} ${creditNoteNumber}`,
                  });
              }
            }
          }
        }
      }

      // Update purchase document totals
      const { error: purchaseError } = await supabase
        .from('purchase_documents')
        .update({
          total_credited: purchaseDocument.total_credited + totals.net_amount,
          credit_note_count: (purchaseDocument as any).credit_note_count + 1,
        })
        .eq('id', purchaseDocument.id);
      if (purchaseError) throw purchaseError;

      toast.success(t('supplier_credit_note_created'));
      onCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating supplier credit note:', error);
      toast.error(t('error_creating_credit_note'));
    } finally {
      setIsSaving(false);
    }
  };

  const getSupplierName = () => {
    if (!purchaseDocument?.supplier) return '-';
    if (purchaseDocument.supplier.company_name) return purchaseDocument.supplier.company_name;
    return `${purchaseDocument.supplier.first_name || ''} ${purchaseDocument.supplier.last_name || ''}`.trim() || '-';
  };

  const renderTypeStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">{t('select_credit_note_type')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('purchase_document')}: <span className="font-mono font-medium">{purchaseDocument?.invoice_number || '-'}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t('supplier')}: <span className="font-medium">{getSupplierName()}</span>
        </p>
      </div>

      {isDocumentFullyCredited && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{t('document_fully_credited')}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setCreditNoteType('financial')}
          disabled={isDocumentFullyCredited}
          className={`p-6 rounded-xl border-2 transition-all ${
            creditNoteType === 'financial' 
              ? 'border-primary bg-primary/5' 
              : 'border-muted hover:border-primary/50'
          } ${isDocumentFullyCredited ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Banknote className={`h-10 w-10 mx-auto mb-3 ${
            creditNoteType === 'financial' ? 'text-primary' : 'text-muted-foreground'
          }`} />
          <h4 className="font-semibold">{t('financial_credit_note')}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {t('supplier_financial_credit_note_desc')}
          </p>
        </button>

        <button
          onClick={() => setCreditNoteType('product_return')}
          disabled={isDocumentFullyCredited}
          className={`p-6 rounded-xl border-2 transition-all ${
            creditNoteType === 'product_return' 
              ? 'border-primary bg-primary/5' 
              : 'border-muted hover:border-primary/50'
          } ${isDocumentFullyCredited ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RotateCcw className={`h-10 w-10 mx-auto mb-3 ${
            creditNoteType === 'product_return' ? 'text-primary' : 'text-muted-foreground'
          }`} />
          <h4 className="font-semibold">{t('product_return_credit_note')}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {t('supplier_product_return_credit_note_desc')}
          </p>
        </button>
      </div>

      <div className="p-4 rounded-lg bg-muted/30 border">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="font-medium">{t('credit_available')}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('purchase_total')}:</span>
            <p className="font-mono font-semibold">{formatCurrency(purchaseDocument?.total_ttc || 0, purchaseDocument?.currency || 'TND')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('already_credited')}:</span>
            <p className="font-mono font-semibold text-orange-600">{formatCurrency(totalExistingCredits, purchaseDocument?.currency || 'TND')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('max_credit')}:</span>
            <p className="font-mono font-semibold text-green-600">{formatCurrency(maxAvailableCredit, purchaseDocument?.currency || 'TND')}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderLinesStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {creditNoteType === 'financial' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('credit_amount_ht')} *</Label>
            <Input
              type="number"
              min={0}
              step={0.001}
              value={financialAmount}
              onChange={(e) => setFinancialAmount(parseFloat(e.target.value) || 0)}
              className="font-mono"
            />
            {!isFinancialAmountValid && financialAmount > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('amount_exceeds_max')} ({formatCurrency(maxAvailableCredit, purchaseDocument?.currency || 'TND')})
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('description')} *</Label>
            <Input
              value={financialDescription}
              onChange={(e) => setFinancialDescription(e.target.value)}
              placeholder={t('credit_note_description_placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('reason')}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('credit_note_reason_placeholder')}
              rows={3}
            />
          </div>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t('loading')}...</div>
            ) : purchaseLines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('no_lines')}</div>
            ) : (
              purchaseLines.map((line) => {
                const availableQty = getAvailableQuantity(line.id, line.quantity);
                const isSelected = selectedLines.has(line.id);
                const selectedLine = selectedLines.get(line.id);

                return (
                  <div
                    key={line.id}
                    className={`p-4 rounded-lg border ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-muted'
                    } ${availableQty <= 0 ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={availableQty <= 0}
                        onCheckedChange={(checked) => handleLineSelect(line, !!checked)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium">{line.product?.name || line.name}</p>
                            {line.product?.reference && (
                              <p className="text-xs text-muted-foreground font-mono">{line.product.reference}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm">{formatCurrency(line.unit_price_ht, purchaseDocument?.currency || 'TND')}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('qty')}: {line.quantity} | {t('available')}: {availableQty}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-muted space-y-3">
                            <div className="flex items-center gap-4">
                              <div className="w-24">
                                <Label className="text-xs">{t('quantity')}</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={availableQty}
                                  value={selectedLine?.quantity || 0}
                                  onChange={(e) => handleLineQuantityChange(line.id, parseInt(e.target.value) || 0, availableQty)}
                                  className="h-8 text-sm font-mono"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">{t('return_reason')}</Label>
                                <Select
                                  value={selectedLine?.return_reason}
                                  onValueChange={(v) => handleReturnReasonChange(line.id, v)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder={t('select_reason')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SUPPLIER_RETURN_REASONS.map((reason) => (
                                      <SelectItem key={reason} value={reason}>
                                        {t(reason)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      )}

      <Separator />

      <div className="flex justify-end">
        <div className="w-64 space-y-2 p-3 rounded-lg bg-muted/30 border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
            <span className="font-mono">{formatCurrency(totals.subtotal_ht, purchaseDocument?.currency || 'TND')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('vat')}:</span>
            <span className="font-mono">{formatCurrency(totals.total_vat, purchaseDocument?.currency || 'TND')}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>{t('total')}:</span>
            <span className={`font-mono ${totals.net_amount > maxAvailableCredit ? 'text-destructive' : 'text-primary'}`}>
              {formatCurrency(totals.net_amount, purchaseDocument?.currency || 'TND')}
            </span>
          </div>
          {totals.net_amount > maxAvailableCredit && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {t('exceeds_max_credit')}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderSummaryStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="p-4 rounded-lg bg-muted/30 border">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('type')}:</span>
            <p className="font-medium flex items-center gap-2 mt-1">
              {creditNoteType === 'financial' ? (
                <>
                  <Banknote className="h-4 w-4 text-blue-600" />
                  {t('financial_credit_note')}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 text-purple-600" />
                  {t('product_return_credit_note')}
                </>
              )}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('date')}:</span>
            <p className="font-medium mt-1">
              {format(new Date(creditNoteDate), 'PPP', { locale: getDateLocale() })}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('supplier')}:</span>
            <p className="font-medium mt-1">{getSupplierName()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('purchase_document')}:</span>
            <p className="font-mono mt-1">{purchaseDocument?.invoice_number || '-'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('credit_note_date')}</Label>
        <Input
          type="date"
          value={creditNoteDate}
          onChange={(e) => setCreditNoteDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('notes')}</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('additional_notes')}
          rows={3}
        />
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/30">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="font-semibold">{t('credit_note_totals')}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
            <p className="font-mono font-semibold">{formatCurrency(totals.subtotal_ht, purchaseDocument?.currency || 'TND')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('vat')}:</span>
            <p className="font-mono font-semibold">{formatCurrency(totals.total_vat, purchaseDocument?.currency || 'TND')}</p>
          </div>
          <div className="col-span-2 pt-2 border-t border-primary/30">
            <span className="text-muted-foreground">{t('net_amount')}:</span>
            <p className="font-mono text-xl font-bold text-primary">{formatCurrency(totals.net_amount, purchaseDocument?.currency || 'TND')}</p>
          </div>
        </div>
      </div>

      {creditNoteType === 'product_return' && (
        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-orange-600" />
            <span className="font-medium text-orange-700">{t('stock_management')}</span>
          </div>
          <p className="text-sm text-orange-700">
            {t('supplier_return_stock_info')}
          </p>
        </div>
      )}
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('create_supplier_credit_note')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-4">
          {(['type', 'lines', 'summary'] as Step[]).map((s, index) => (
            <React.Fragment key={s}>
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s 
                    ? 'bg-primary text-primary-foreground' 
                    : index < ['type', 'lines', 'summary'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < ['type', 'lines', 'summary'].indexOf(step) ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < 2 && (
                <div className={`w-12 h-0.5 ${
                  index < ['type', 'lines', 'summary'].indexOf(step) ? 'bg-green-500' : 'bg-muted'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <ScrollArea className="max-h-[50vh]">
          <AnimatePresence mode="wait">
            {step === 'type' && renderTypeStep()}
            {step === 'lines' && renderLinesStep()}
            {step === 'summary' && renderSummaryStep()}
          </AnimatePresence>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {step !== 'type' && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 'summary' ? 'lines' : 'type')}
              disabled={isSaving}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('back')}
            </Button>
          )}
          
          {step === 'type' && (
            <Button
              onClick={() => setStep('lines')}
              disabled={!canProceedToLines}
            >
              {t('next')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 'lines' && (
            <Button
              onClick={() => setStep('summary')}
              disabled={!canProceedToSummary}
            >
              {t('next')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 'summary' && creditNoteType === 'product_return' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
              >
                {t('create_and_block')}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving}
              >
                {isSaving ? t('saving') : t('create_and_return_stock')}
              </Button>
            </>
          )}

          {step === 'summary' && creditNoteType === 'financial' && (
            <Button
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              {isSaving ? t('saving') : t('create_credit_note')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
