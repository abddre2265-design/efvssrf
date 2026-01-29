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
import { CreditNoteType, CreditNoteLineInput, InvoiceLineForCredit, RETURN_REASONS } from './types';
import { Invoice, formatCurrency } from '@/components/invoices/types';

interface CreditNoteCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onCreated: () => void;
}

type Step = 'type' | 'lines' | 'summary';

export const CreditNoteCreateDialog: React.FC<CreditNoteCreateDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onCreated,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [step, setStep] = useState<Step>('type');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [creditNoteType, setCreditNoteType] = useState<CreditNoteType | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [creditNoteDate, setCreditNoteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Invoice lines state
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineForCredit[]>([]);
  const [selectedLines, setSelectedLines] = useState<Map<string, CreditNoteLineInput>>(new Map());
  const [creditedQuantities, setCreditedQuantities] = useState<Map<string, number>>(new Map());
  
  // Total existing credit notes for this invoice (for max amount calculation)
  const [totalExistingCredits, setTotalExistingCredits] = useState(0);
  
  // Financial line (for financial type) - RÈGLE MÉTIER: Saisie uniquement en TTC
  const [financialAmountTTC, setFinancialAmountTTC] = useState(0);
  const [financialDescription, setFinancialDescription] = useState('');

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('type');
      setCreditNoteType(null);
      setReason('');
      setNotes('');
      setCreditNoteDate(format(new Date(), 'yyyy-MM-dd'));
      setSelectedLines(new Map());
      setFinancialAmountTTC(0);
      setFinancialDescription('');
      if (invoice) {
        fetchInvoiceLines();
      }
    }
  }, [open, invoice]);

  const fetchInvoiceLines = async () => {
    if (!invoice) return;
    setIsLoading(true);
    try {
      // Fetch invoice lines
      const { data: linesData, error: linesError } = await supabase
        .from('invoice_lines')
        .select(`
          *,
          product:products(id, name, reference, product_type)
        `)
        .eq('invoice_id', invoice.id)
        .order('line_order', { ascending: true });

      if (linesError) throw linesError;

      // Fetch ALL credit notes for this invoice (both product_return and financial)
      const { data: allCreditNotes, error: allCnError } = await supabase
        .from('credit_notes')
        .select('id, credit_note_type, net_amount')
        .eq('invoice_id', invoice.id)
        .eq('status', 'validated');

      if (allCnError) throw allCnError;

      // Calculate total existing credits (sum of all credit notes net_amount)
      const totalCredits = (allCreditNotes || []).reduce((sum, cn) => sum + (cn.net_amount || 0), 0);
      setTotalExistingCredits(totalCredits);

      // Filter product_return credit notes for quantity tracking
      const productReturnCNs = (allCreditNotes || []).filter(cn => cn.credit_note_type === 'product_return');
      const creditedQtyMap = new Map<string, number>();

      if (productReturnCNs.length > 0) {
        const cnIds = productReturnCNs.map(cn => cn.id);
        const { data: creditedLines, error: clError } = await supabase
          .from('credit_note_lines')
          .select('invoice_line_id, quantity')
          .in('credit_note_id', cnIds)
          .not('invoice_line_id', 'is', null);

        if (clError) throw clError;

        // Sum up credited quantities per invoice line
        (creditedLines || []).forEach(cl => {
          if (cl.invoice_line_id) {
            const current = creditedQtyMap.get(cl.invoice_line_id) || 0;
            creditedQtyMap.set(cl.invoice_line_id, current + cl.quantity);
          }
        });
      }

      setCreditedQuantities(creditedQtyMap);
      setInvoiceLines((linesData || []) as InvoiceLineForCredit[]);
    } catch (error) {
      console.error('Error fetching invoice lines:', error);
      toast.error(t('error_loading_data'));
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate available quantity for a line (original - already credited)
  const getAvailableQuantity = (lineId: string, originalQuantity: number): number => {
    const credited = creditedQuantities.get(lineId) || 0;
    return Math.max(0, originalQuantity - credited);
  };

  const handleLineSelect = (line: InvoiceLineForCredit, selected: boolean) => {
    const availableQty = getAvailableQuantity(line.id, line.quantity);
    if (availableQty <= 0) return; // Cannot select if no quantity available
    
    const newSelected = new Map(selectedLines);
    if (selected) {
      newSelected.set(line.id, {
        invoice_line_id: line.id,
        product_id: line.product_id,
        description: line.product?.name || '',
        quantity: availableQty, // Use available quantity as default
        unit_price_ht: line.unit_price_ht,
        vat_rate: line.vat_rate,
        discount_percent: line.discount_percent,
        return_reason: creditNoteType === 'product_return' ? 'customer_changed_mind' : undefined,
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

  // Calculate maximum available amount for credit notes
  const maxAvailableCredit = useMemo(() => {
    if (!invoice) return 0;
    const invoiceTotal = invoice.total_ttc || 0;
    const remaining = invoiceTotal - totalExistingCredits;
    return Math.max(0, remaining);
  }, [invoice, totalExistingCredits]);

  // Check if invoice is fully credited (no more credits allowed)
  const isInvoiceFullyCredited = maxAvailableCredit <= 0;

  // Calculate totals
  const totals = useMemo(() => {
    if (creditNoteType === 'financial') {
      // RÈGLE MÉTIER: Avoir financier = TTC uniquement, pas de HT/TVA
      // Le montant saisi EST le TTC, pas de calcul de TVA
      return {
        subtotal_ht: financialAmountTTC, // On stocke le TTC comme montant de base
        total_vat: 0, // Pas de TVA pour avoir financier
        total_ttc: financialAmountTTC,
        net_amount: financialAmountTTC,
      };
    }

    let subtotal_ht = 0;
    let total_vat = 0;

    selectedLines.forEach((lineInput, lineId) => {
      const originalLine = invoiceLines.find(l => l.id === lineId);
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
  }, [creditNoteType, financialAmountTTC, selectedLines, invoiceLines]);

  // RÈGLE MÉTIER: Pour avoir financier, montant_avoir ≤ montant_payé_facture
  const invoicePaidAmount = invoice?.paid_amount || 0;
  const maxFinancialCredit = Math.min(invoicePaidAmount, maxAvailableCredit);

  // Validate that financial amount doesn't exceed max available AND paid amount
  const isFinancialAmountValid = creditNoteType === 'financial' 
    ? financialAmountTTC > 0 && financialAmountTTC <= maxFinancialCredit
    : true;

  // RÈGLE MÉTIER: Interdit si facture non payée
  const isInvoicePaidOrPartial = invoicePaidAmount > 0;
  const canCreateFinancialCreditNote = isInvoicePaidOrPartial;

  // Validate that product return total doesn't exceed max available
  const isProductReturnAmountValid = creditNoteType === 'product_return'
    ? totals.net_amount <= maxAvailableCredit
    : true;

  const canProceedToLines = creditNoteType !== null && !isInvoiceFullyCredited && 
    (creditNoteType !== 'financial' || canCreateFinancialCreditNote);
  const canProceedToSummary = creditNoteType === 'financial' 
    ? financialAmountTTC > 0 && financialDescription.trim() !== '' && isFinancialAmountValid
    : selectedLines.size > 0 && isProductReturnAmountValid;

  const handleSave = async (immediateUnblock: boolean = false) => {
    if (!invoice) return;
    setIsSaving(true);

    try {
      // Get organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .single();
      if (orgError) throw orgError;

      // Generate credit note number
      const currentYear = new Date().getFullYear();
      const { data: lastCN, error: lastError } = await supabase
        .from('credit_notes')
        .select('credit_note_counter')
        .eq('organization_id', org.id)
        .eq('credit_note_year', currentYear)
        .order('credit_note_counter', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastError) throw lastError;

      const counter = (lastCN?.credit_note_counter || 0) + 1;
      const prefix = 'AV';
      const creditNoteNumber = `${prefix}-${currentYear}-${String(counter).padStart(4, '0')}`;

      // Calculate credit amounts
      const creditAmount = totals.net_amount;
      
      // Credit logic explained:
      // -----------------------
      // FINANCIAL CREDIT NOTE (Avoir d'argent):
      //   - The FULL credit note amount becomes available client credit immediately
      //   - No product reception workflow needed
      //   - credit_generated = credit_available = full amount
      //   - This reduces what the client owes OR creates a credit balance
      //
      // PRODUCT RETURN CREDIT NOTE:
      //   - Credit is blocked until products are physically received (unblocked)
      //   - immediate unblock = products received at creation time
      //   - credit_blocked = amount awaiting product reception
      //   - credit_available = amount where products have been received
      
      let creditBlocked = 0;
      let creditAvailable = 0;
      let creditGenerated = 0;
      let clientCreditAmount = 0;
      
      if (creditNoteType === 'financial') {
        // Financial credit notes: FULL amount becomes available credit immediately
        creditGenerated = creditAmount;
        creditAvailable = creditAmount;
        creditBlocked = 0;
        clientCreditAmount = creditAmount; // Full amount added to client balance
      } else {
        // Product return credit notes
        creditGenerated = creditAmount;
        if (immediateUnblock) {
          // Products received immediately - credit available
          creditAvailable = creditAmount;
          creditBlocked = 0;
          clientCreditAmount = creditAmount; // Full amount added to client balance
        } else {
          // Products not yet received - credit blocked
          creditAvailable = 0;
          creditBlocked = creditAmount;
          clientCreditAmount = 0; // No credit until products received
        }
      }

      // Insert credit note
      // RÈGLE MÉTIER: 
      // - Avoir financier → validé immédiatement (crédit client direct)
      // - Avoir produit → créé en état 'draft' (brouillon) si pas d'unblock immédiat
      // - Avoir produit avec immediateUnblock → validé
      const initialStatus = creditNoteType === 'financial' || immediateUnblock ? 'validated' : 'draft';
      
      const { data: creditNote, error: cnError } = await supabase
        .from('credit_notes')
        .insert({
          organization_id: org.id,
          invoice_id: invoice.id,
          client_id: invoice.client_id,
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
          status: initialStatus,
          currency: invoice.currency,
          notes,
        })
        .select()
        .single();

      if (cnError) throw cnError;

      // Insert credit note lines
      if (creditNoteType === 'financial') {
        const { error: lineError } = await supabase
          .from('credit_note_lines')
          .insert({
            credit_note_id: creditNote.id,
            description: financialDescription,
            quantity: 1,
            unit_price_ht: financialAmountTTC, // On stocke le TTC directement
            vat_rate: 0, // Pas de TVA pour avoir financier
            line_total_ht: financialAmountTTC,
            line_vat: 0,
            line_total_ttc: financialAmountTTC,
            line_order: 0,
          });
        if (lineError) throw lineError;
      } else {
        // Product return lines
        let lineOrder = 0;
        for (const [lineId, lineInput] of selectedLines) {
          const originalLine = invoiceLines.find(l => l.id === lineId);
          if (!originalLine) continue;

          const unitPriceAfterDiscount = lineInput.unit_price_ht * (1 - lineInput.discount_percent / 100);
          const lineHT = unitPriceAfterDiscount * lineInput.quantity;
          const lineVAT = lineHT * lineInput.vat_rate / 100;

          const { error: lineError } = await supabase
            .from('credit_note_lines')
            .insert({
              credit_note_id: creditNote.id,
              product_id: lineInput.product_id,
              invoice_line_id: lineInput.invoice_line_id,
              description: lineInput.description,
              quantity: lineInput.quantity,
              unit_price_ht: lineInput.unit_price_ht,
              vat_rate: lineInput.vat_rate,
              discount_percent: lineInput.discount_percent,
              line_total_ht: lineHT,
              line_vat: lineVAT,
              line_total_ttc: lineHT + lineVAT,
              return_reason: lineInput.return_reason,
              stock_restored: immediateUnblock, // Mark as restored if immediate unblock
              line_order: lineOrder++,
            });
          if (lineError) throw lineError;

          // If immediate unblock, restore stock now
          if (immediateUnblock && originalLine.product?.product_type === 'physical') {
            // Fetch current product stock
            const { data: product, error: prodError } = await supabase
              .from('products')
              .select('current_stock, unlimited_stock')
              .eq('id', lineInput.product_id)
              .single();
            
            if (!prodError && product && !product.unlimited_stock) {
              const previousStock = product.current_stock ?? 0;
              const newStock = previousStock + lineInput.quantity;

              // Update product stock
              const { error: stockError } = await supabase
                .from('products')
                .update({ current_stock: newStock })
                .eq('id', lineInput.product_id);

              if (!stockError) {
                // Create stock movement
                await supabase
                  .from('stock_movements')
                  .insert({
                    product_id: lineInput.product_id!,
                    movement_type: 'add',
                    quantity: lineInput.quantity,
                    previous_stock: previousStock,
                    new_stock: newStock,
                    reason_category: t('credit_note_return'),
                    reason_detail: `${t('credit_note')} ${creditNoteNumber}`,
                  });
              }
            }
          }
        }
      }

      // Update invoice totals
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          total_credited: invoice.total_credited + totals.net_amount,
          credit_note_count: invoice.credit_note_count + 1,
        })
        .eq('id', invoice.id);
      if (invoiceError) throw invoiceError;

      // Create client credit movement only if there's credit to add to client balance
      // IMPORTANT: We use clientCreditAmount (the excess), NOT creditAvailable (reception tracking)
      // Example: Invoice=100, Paid=70, Return=40 → Credit to client = 10 (not 40)
      if (clientCreditAmount > 0) {
        // Get current client balance
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('account_balance')
          .eq('id', invoice.client_id)
          .single();
        if (clientError) throw clientError;

        const currentBalance = client.account_balance || 0;
        const newBalance = currentBalance + clientCreditAmount;

        const { error: movementError } = await supabase
          .from('client_account_movements')
          .insert({
            organization_id: org.id,
            client_id: invoice.client_id,
            amount: clientCreditAmount,
            balance_after: newBalance,
            movement_type: 'credit',
            source_type: 'credit_note',
            source_id: creditNote.id,
            movement_date: creditNoteDate,
            notes: `${t('credit_note')} ${creditNoteNumber}`,
          });
        if (movementError) throw movementError;

        // Update client balance
        const { error: balanceError } = await supabase
          .from('clients')
          .update({ account_balance: newBalance })
          .eq('id', invoice.client_id);
        if (balanceError) throw balanceError;
      }

      toast.success(t('credit_note_created'));
      onCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating credit note:', error);
      toast.error(t('error_creating_credit_note'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderTypeStep = () => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      {/* Blocked message if invoice fully credited */}
      {isInvoiceFullyCredited && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">{t('invoice_fully_credited')}</p>
              <p className="text-muted-foreground mt-1">{t('invoice_fully_credited_description')}</p>
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                {t('invoice_total')}: {formatCurrency(invoice?.total_ttc || 0, invoice?.currency || 'TND')} | 
                {t('total_credits')}: {formatCurrency(totalExistingCredits, invoice?.currency || 'TND')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available credit info */}
      {!isInvoiceFullyCredited && totalExistingCredits > 0 && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">{t('existing_credits_warning')}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">{t('invoice_total')}:</span>
                  <p className="font-mono font-semibold">{formatCurrency(invoice?.total_ttc || 0, invoice?.currency || 'TND')}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">{t('total_credits')}:</span>
                  <p className="font-mono font-semibold text-amber-600">{formatCurrency(totalExistingCredits, invoice?.currency || 'TND')}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">{t('available_for_credit')}:</span>
                  <p className="font-mono font-semibold text-primary">{formatCurrency(maxAvailableCredit, invoice?.currency || 'TND')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{t('select_credit_note_type')}</h3>
        <p className="text-sm text-muted-foreground">{t('credit_note_type_description')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Financial Credit Note - blocked if invoice unpaid */}
        <button
          onClick={() => canCreateFinancialCreditNote && setCreditNoteType('financial')}
          disabled={!canCreateFinancialCreditNote}
          className={`p-6 rounded-lg border-2 transition-all text-start space-y-3 ${
            !canCreateFinancialCreditNote
              ? 'border-muted bg-muted/30 opacity-60 cursor-not-allowed'
              : creditNoteType === 'financial'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${
              creditNoteType === 'financial' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <Banknote className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-semibold">{t('financial_credit_note')}</h4>
              <p className="text-xs text-muted-foreground">{t('no_stock_impact')}</p>
            </div>
          </div>
          {!canCreateFinancialCreditNote ? (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/30">
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('financial_credit_blocked_unpaid')}
              </p>
            </div>
          ) : (
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" />
                {t('commercial_gesture')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" />
                {t('price_adjustment')}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-primary" />
                {t('immediate_credit')}
              </li>
            </ul>
          )}
        </button>

        <button
          onClick={() => setCreditNoteType('product_return')}
          className={`p-6 rounded-lg border-2 transition-all text-start space-y-3 ${
            creditNoteType === 'product_return'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${
              creditNoteType === 'product_return' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-semibold">{t('product_return_credit_note')}</h4>
              <p className="text-xs text-muted-foreground">{t('with_stock_impact')}</p>
            </div>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              {t('product_return')}
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              {t('stock_restoration')}
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-orange-500" />
              {t('blocked_credit_until_reception')}
            </li>
          </ul>
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('credit_note_date')}</Label>
          <Input
            type="date"
            value={creditNoteDate}
            onChange={(e) => setCreditNoteDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('reason')}</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('credit_note_reason_placeholder')}
            rows={2}
          />
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
          {/* Info: Avoir financier = TTC uniquement, limité au montant payé */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('financial_credit_ttc_only_info')}
            </p>
          </div>
          
          {/* Max available credit info based on paid amount */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('invoice_paid_amount')}:</span>
              <span className="font-mono font-semibold text-green-600">{formatCurrency(invoicePaidAmount, invoice?.currency || 'TND')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('max_credit_available')}:</span>
              <span className="font-mono font-semibold text-primary">{formatCurrency(maxFinancialCredit, invoice?.currency || 'TND')}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              {t('financial_credit_details')}
            </h4>
            <div className="space-y-2">
              <Label>{t('description')} *</Label>
              <Input
                value={financialDescription}
                onChange={(e) => setFinancialDescription(e.target.value)}
                placeholder={t('financial_credit_description_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('amount_ttc')} *</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={financialAmountTTC || ''}
                onChange={(e) => setFinancialAmountTTC(parseFloat(e.target.value) || 0)}
                placeholder="0.000"
                className={!isFinancialAmountValid && financialAmountTTC > 0 ? 'border-destructive' : ''}
              />
              {/* Show info about max amount */}
              {financialAmountTTC > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{t('max_based_on_paid')}:</span>
                  <span className="font-mono text-primary">
                    {formatCurrency(maxFinancialCredit, invoice?.currency || 'TND')}
                  </span>
                </div>
              )}
              {/* Error message if amount exceeds max */}
              {!isFinancialAmountValid && financialAmountTTC > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {t('amount_exceeds_paid')} ({formatCurrency(maxFinancialCredit, invoice?.currency || 'TND')})
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('select_products_to_return')}
            </h4>
            <Badge variant="outline">
              {selectedLines.size} {t('selected')}
            </Badge>
          </div>
          
          <ScrollArea className="h-[300px] rounded-lg border">
            <div className="p-2 space-y-2">
              {invoiceLines.map((line) => {
                const isSelected = selectedLines.has(line.id);
                const selectedLine = selectedLines.get(line.id);
                const creditedQty = creditedQuantities.get(line.id) || 0;
                const availableQty = getAvailableQuantity(line.id, line.quantity);
                const isFullyCredited = availableQty <= 0;
                
                return (
                  <div
                    key={line.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isFullyCredited ? 'bg-muted/50 opacity-60' :
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleLineSelect(line, !!checked)}
                        disabled={isFullyCredited}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{line.product?.name || '-'}</p>
                            {line.product?.reference && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {line.product.reference}
                              </p>
                            )}
                          </div>
                          <div className="text-end">
                            <p className="text-sm">{line.quantity} × {formatCurrency(line.unit_price_ht, invoice?.currency || 'TND')}</p>
                            <p className="font-medium">{formatCurrency(line.line_total_ttc, invoice?.currency || 'TND')}</p>
                          </div>
                        </div>
                        
                        {/* Show credited quantity info */}
                        {creditedQty > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              {t('already_credited')}: {creditedQty}
                            </Badge>
                            {!isFullyCredited && (
                              <Badge variant="outline" className="text-primary">
                                {t('available')}: {availableQty}
                              </Badge>
                            )}
                            {isFullyCredited && (
                              <Badge variant="outline" className="text-muted-foreground">
                                {t('fully_credited')}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="grid grid-cols-2 gap-3 pt-2 border-t"
                          >
                            <div className="space-y-1">
                              <Label className="text-xs">{t('quantity_to_return')} (max: {availableQty})</Label>
                              <Input
                                type="number"
                                min="1"
                                max={availableQty}
                                value={selectedLine?.quantity || 1}
                                onChange={(e) => handleLineQuantityChange(line.id, parseInt(e.target.value) || 1, availableQty)}
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('return_reason')}</Label>
                              <Select
                                value={selectedLine?.return_reason || 'customer_changed_mind'}
                                onValueChange={(value) => handleReturnReasonChange(line.id, value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {RETURN_REASONS.map((reason) => (
                                    <SelectItem key={reason} value={reason}>
                                      {t(reason)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  );

  const renderSummaryStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Calculator className="h-4 w-4" />
          {t('credit_note_summary')}
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('type')}:</span>
            <Badge className="ml-2">
              {creditNoteType === 'financial' ? t('financial') : t('product_return')}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">{t('date')}:</span>
            <span className="ml-2">{format(new Date(creditNoteDate), 'PPP', { locale: getDateLocale() })}</span>
          </div>
        </div>

        {reason && (
          <div className="text-sm">
            <span className="text-muted-foreground">{t('reason')}:</span>
            <p className="mt-1">{reason}</p>
          </div>
        )}
      </div>

      <Separator />

      {creditNoteType === 'product_return' && (
        <div className="space-y-2">
          <h4 className="font-medium">{t('lines')}</h4>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start p-2">{t('product')}</th>
                  <th className="text-center p-2">{t('quantity')}</th>
                  <th className="text-end p-2">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(selectedLines).map(([lineId, lineInput]) => {
                  const originalLine = invoiceLines.find(l => l.id === lineId);
                  if (!originalLine) return null;
                  const unitPriceAfterDiscount = lineInput.unit_price_ht * (1 - lineInput.discount_percent / 100);
                  const lineTotal = unitPriceAfterDiscount * lineInput.quantity * (1 + lineInput.vat_rate / 100);
                  return (
                    <tr key={lineId} className="border-t">
                      <td className="p-2">{lineInput.description}</td>
                      <td className="text-center p-2">{lineInput.quantity}</td>
                      <td className="text-end p-2 font-mono">{formatCurrency(lineTotal, invoice?.currency || 'TND')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed calculation breakdown */}
      {invoice && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Calculator className="h-4 w-4" />
            {t('calculation_breakdown')}
          </div>
          
          {(() => {
            const invoiceTotal = invoice.net_payable || 0;
            const paidAmount = invoice.paid_amount || 0;
            const creditAmount = totals.net_amount;
            const newInvoiceTotal = invoiceTotal - creditAmount;
            const clientCredit = Math.max(0, paidAmount - newInvoiceTotal);
            const newRemainingToPay = Math.max(0, newInvoiceTotal - paidAmount);
            
            return (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-muted-foreground">{t('original_invoice_total')}:</div>
                <div className="font-mono text-end">{formatCurrency(invoiceTotal, invoice.currency)}</div>
                
                <div className="text-muted-foreground">{t('amount_already_paid')}:</div>
                <div className="font-mono text-end text-emerald-600">{formatCurrency(paidAmount, invoice.currency)}</div>
                
                <div className="text-muted-foreground">{t('credit_note_amount')}:</div>
                <div className="font-mono text-end text-destructive">- {formatCurrency(creditAmount, invoice.currency)}</div>
                
                <Separator className="col-span-2 my-1" />
                
                <div className="font-medium">{t('new_invoice_total')}:</div>
                <div className="font-mono text-end font-semibold">{formatCurrency(newInvoiceTotal, invoice.currency)}</div>
                
                {paidAmount > newInvoiceTotal ? (
                  <>
                    <Separator className="col-span-2 my-1" />
                    <div className="col-span-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-xs mb-1">
                        <Check className="h-3 w-3" />
                        {t('paid_exceeds_new_total')}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-600 dark:text-emerald-400">{t('client_credit_generated')}:</span>
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                          +{formatCurrency(clientCredit, invoice.currency)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t('client_credit_explanation')}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-muted-foreground">{t('remaining_to_pay')}:</div>
                    <div className="font-mono text-end text-amber-600">{formatCurrency(newRemainingToPay, invoice.currency)}</div>
                    <div className="col-span-2 text-xs text-muted-foreground italic mt-1">
                      {t('no_client_credit')}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex justify-end">
        <div className="w-72 space-y-2 p-4 rounded-lg bg-muted/30 border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
            <span className="font-mono">{formatCurrency(totals.subtotal_ht, invoice?.currency || 'TND')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('total_vat')}:</span>
            <span className="font-mono">{formatCurrency(totals.total_vat, invoice?.currency || 'TND')}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>{t('net_amount')}:</span>
            <span className="font-mono text-primary">{formatCurrency(totals.net_amount, invoice?.currency || 'TND')}</span>
          </div>
        </div>
      </div>

      {creditNoteType === 'product_return' && (
        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
            <div>
              <p className="font-medium text-orange-700">{t('credit_blocked_notice')}</p>
              <p className="text-orange-600">{t('credit_blocked_until_stock_restored')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('additional_notes')}</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('optional_notes')}
          rows={2}
        />
      </div>
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" 
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('create_credit_note')}
          </DialogTitle>
          {invoice && (
            <div className="text-sm text-muted-foreground">
              {t('for_invoice')}: <span className="font-mono font-medium">{invoice.invoice_number}</span>
            </div>
          )}
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0">
          {(['type', 'lines', 'summary'] as Step[]).map((s, index) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                step === s ? 'bg-primary text-primary-foreground' : 
                ['type', 'lines', 'summary'].indexOf(step) > index ? 'bg-primary/20 text-primary' : 'bg-muted'
              }`}>
                <span className="font-medium">{index + 1}</span>
                <span className="hidden sm:inline">{t(`step_${s}`)}</span>
              </div>
              {index < 2 && <div className="w-8 h-0.5 bg-muted" />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="pb-4">
            <AnimatePresence mode="wait">
              {step === 'type' && renderTypeStep()}
              {step === 'lines' && renderLinesStep()}
              {step === 'summary' && renderSummaryStep()}
            </AnimatePresence>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
          
          {step === 'summary' && creditNoteType === 'financial' && (
            <Button
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              {isSaving ? t('saving') : t('validate_credit_note')}
            </Button>
          )}
          
          {step === 'summary' && creditNoteType === 'product_return' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? t('saving') : t('create_and_block')}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? t('saving') : t('create_and_unblock')}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
