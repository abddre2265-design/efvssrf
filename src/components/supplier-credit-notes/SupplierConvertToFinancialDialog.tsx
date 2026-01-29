import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Banknote, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Receipt,
  Calculator,
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/invoices/types';

interface SupplierConvertToFinancialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string;
  creditNoteNetAmount: number;
  currency: string;
  purchaseDocumentId: string;
  supplierId: string;
  organizationId: string;
  onSuccess: () => void;
}

export const SupplierConvertToFinancialDialog: React.FC<SupplierConvertToFinancialDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  creditNoteNetAmount,
  currency,
  purchaseDocumentId,
  supplierId,
  organizationId,
  onSuccess,
}) => {
  const { t, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reason, setReason] = useState('');
  
  const [documentPaidAmount, setDocumentPaidAmount] = useState(0);
  const [existingFinancialCredits, setExistingFinancialCredits] = useState(0);

  useEffect(() => {
    if (open && purchaseDocumentId) {
      fetchDocumentData();
    }
  }, [open, purchaseDocumentId]);

  const fetchDocumentData = async () => {
    setIsLoading(true);
    try {
      // Fetch purchase document data
      const { data: doc, error: docError } = await supabase
        .from('purchase_documents')
        .select('paid_amount, net_payable, total_ttc')
        .eq('id', purchaseDocumentId)
        .single();

      if (docError) throw docError;

      setDocumentPaidAmount(doc.paid_amount || 0);

      // Check existing financial credit notes for this purchase document
      const { data: existingCredits, error: creditsError } = await supabase
        .from('supplier_credit_notes')
        .select('net_amount')
        .eq('purchase_document_id', purchaseDocumentId)
        .eq('credit_note_type', 'financial')
        .eq('status', 'validated');

      if (!creditsError && existingCredits) {
        const totalExisting = existingCredits.reduce((sum, cn) => sum + (cn.net_amount || 0), 0);
        setExistingFinancialCredits(totalExisting);
      }

    } catch (error) {
      console.error('Error fetching document data:', error);
      toast.error(t('error_loading_data'));
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate max convertible:
  // = MIN(paid_amount - existing_financial_credits, credit_note_net_amount)
  // For supplier credit notes: we can only convert to financial credit what was already paid to the supplier
  const maxConvertibleAmount = useMemo(() => {
    const availableFromPayments = Math.max(0, documentPaidAmount - existingFinancialCredits);
    return Math.min(availableFromPayments, creditNoteNetAmount);
  }, [documentPaidAmount, existingFinancialCredits, creditNoteNetAmount]);

  const canConvert = maxConvertibleAmount > 0 && documentPaidAmount > 0;
  const isPartialConversion = maxConvertibleAmount < creditNoteNetAmount;
  const unconvertibleAmount = creditNoteNetAmount - maxConvertibleAmount;

  const handleConvert = async () => {
    if (!canConvert) return;
    
    setIsSaving(true);
    try {
      // Generate credit note number
      const currentYear = new Date().getFullYear();
      const { data: lastCN, error: lastError } = await supabase
        .from('supplier_credit_notes')
        .select('credit_note_counter')
        .eq('organization_id', organizationId)
        .eq('credit_note_year', currentYear)
        .order('credit_note_counter', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastError) throw lastError;

      const counter = (lastCN?.credit_note_counter || 0) + 1;
      const prefix = 'AVF-FIN';
      const newCreditNoteNumber = `${prefix}-${currentYear}-${String(counter).padStart(4, '0')}`;

      // Create financial credit note
      const { data: newCreditNote, error: cnError } = await supabase
        .from('supplier_credit_notes')
        .insert({
          organization_id: organizationId,
          purchase_document_id: purchaseDocumentId,
          supplier_id: supplierId,
          credit_note_number: newCreditNoteNumber,
          credit_note_prefix: prefix,
          credit_note_year: currentYear,
          credit_note_counter: counter,
          credit_note_type: 'financial',
          credit_note_date: new Date().toISOString().split('T')[0],
          reason: reason || `${t('converted_from_product_return')} ${creditNoteNumber}`,
          subtotal_ht: maxConvertibleAmount,
          total_vat: 0,
          total_ttc: maxConvertibleAmount,
          net_amount: maxConvertibleAmount,
          credit_generated: maxConvertibleAmount,
          credit_available: maxConvertibleAmount,
          credit_blocked: 0,
          status: 'validated',
          currency: currency,
          notes: `${t('auto_converted_from')}: ${creditNoteNumber}`,
        })
        .select()
        .single();

      if (cnError) throw cnError;

      // Create credit note line
      await supabase
        .from('supplier_credit_note_lines')
        .insert({
          supplier_credit_note_id: newCreditNote.id,
          description: `${t('conversion_product_return_to_financial')}: ${creditNoteNumber}`,
          quantity: 1,
          unit_price_ht: maxConvertibleAmount,
          vat_rate: 0,
          line_total_ht: maxConvertibleAmount,
          line_vat: 0,
          line_total_ttc: maxConvertibleAmount,
          line_order: 0,
        });

      toast.success(t('conversion_successful'));
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error converting credit note:', error);
      toast.error(error.message || t('error_converting'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            {t('convert_to_financial_supplier_credit')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Source Credit Note Info */}
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">{t('product_return_source')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('credit_note_number')}:</span>
                      <p className="font-mono font-medium">{creditNoteNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('value_ttc')}:</span>
                      <p className="font-mono font-semibold">{formatCurrency(creditNoteNetAmount, currency)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{t('payment_verification_convert')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('document_paid_total')}:</span>
                      <p className="font-mono font-semibold text-green-600">{formatCurrency(documentPaidAmount, currency)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('existing_financial_credits')}:</span>
                      <p className="font-mono font-semibold text-orange-600">{formatCurrency(existingFinancialCredits, currency)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Conversion Result */}
                {canConvert ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700 dark:text-green-400">
                          {t('conversion_possible')}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-center gap-4 py-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">{t('product_return_type')}</p>
                          <p className="font-mono font-semibold">{formatCurrency(creditNoteNetAmount, currency)}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-green-600" />
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">{t('organization_credit')}</p>
                          <p className="font-mono font-bold text-lg text-green-600">{formatCurrency(maxConvertibleAmount, currency)}</p>
                        </div>
                      </div>

                      {isPartialConversion && (
                        <Alert className="bg-yellow-500/10 border-yellow-500/30 mt-3">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                            {t('partial_conversion_warning')} {formatCurrency(unconvertibleAmount, currency)} {t('not_convertible_until_payment')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t('conversion_reason')} ({t('optional')})</Label>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('enter_reason')}
                        rows={2}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-700 dark:text-red-400">
                          {t('conversion_not_possible')}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {documentPaidAmount === 0 
                            ? t('document_not_paid_conversion_blocked')
                            : t('no_available_payment_for_conversion')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleConvert}
            disabled={!canConvert || isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4" />
            )}
            {t('convert_action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
