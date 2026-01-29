import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Banknote, 
  Loader2, 
  FileText,
  ArrowRight,
  CheckCircle2,
  Calculator,
  Coins
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/invoices/types';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';

interface SupplierCreditUseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string;
  creditAvailable: number;
  supplierId: string;
  currency: string;
  onSuccess: () => void;
}

interface UnpaidPurchaseDocument {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  net_payable: number;
  paid_amount: number;
  remaining: number;
  currency: string;
}

export const SupplierCreditUseDialog: React.FC<SupplierCreditUseDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  creditAvailable,
  supplierId,
  currency,
  onSuccess,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [unpaidDocuments, setUnpaidDocuments] = useState<UnpaidPurchaseDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [amountToUse, setAmountToUse] = useState<string>('');

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    const fetchUnpaidDocuments = async () => {
      if (!open || !supplierId) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('purchase_documents')
          .select('id, invoice_number, invoice_date, net_payable, paid_amount, currency')
          .eq('supplier_id', supplierId)
          .in('payment_status', ['unpaid', 'partial'])
          .eq('status', 'validated')
          .neq('id', creditNoteId) // Exclude the document this credit note is from
          .order('invoice_date', { ascending: true });

        if (error) throw error;

        const docs = (data || []).map(doc => ({
          ...doc,
          remaining: doc.net_payable - doc.paid_amount,
        }));

        setUnpaidDocuments(docs);
      } catch (error) {
        console.error('Error fetching unpaid documents:', error);
        toast.error(t('error_loading_data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnpaidDocuments();
    setSelectedDocumentId('');
    setAmountToUse('');
  }, [open, supplierId]);

  const selectedDocument = unpaidDocuments.find(d => d.id === selectedDocumentId);
  
  const maxUsable = useMemo(() => {
    if (!selectedDocument) return creditAvailable;
    return Math.min(creditAvailable, selectedDocument.remaining);
  }, [selectedDocument, creditAvailable]);

  const parsedAmount = parseFloat(amountToUse) || 0;
  const canUse = selectedDocumentId && parsedAmount > 0 && parsedAmount <= maxUsable;

  const handleMaxClick = () => {
    setAmountToUse(maxUsable.toFixed(3));
  };

  const handleUseCredit = async () => {
    if (!canUse || !selectedDocument) return;

    setIsSaving(true);
    try {
      const { data: org } = await supabase.from('organizations').select('id').single();
      if (!org) throw new Error('Organization not found');

      // 1. Create payment using credit
      const { error: paymentError } = await supabase
        .from('purchase_payments')
        .insert({
          purchase_document_id: selectedDocumentId,
          payment_date: format(new Date(), 'yyyy-MM-dd'),
          amount: parsedAmount,
          withholding_rate: 0,
          withholding_amount: 0,
          net_amount: parsedAmount,
          payment_method: 'supplier_credit',
          reference_number: creditNoteNumber,
          notes: `${t('payment_from_supplier_credit_note')} ${creditNoteNumber}`,
        });

      if (paymentError) throw paymentError;

      // 2. Update purchase document
      const newPaidAmount = selectedDocument.paid_amount + parsedAmount;
      const newPaymentStatus = newPaidAmount >= selectedDocument.net_payable ? 'paid' : 'partial';

      const { error: docError } = await supabase
        .from('purchase_documents')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newPaymentStatus,
        })
        .eq('id', selectedDocumentId);

      if (docError) throw docError;

      // 3. Update credit note - reduce credit_available
      const { data: currentCN, error: cnFetchError } = await supabase
        .from('supplier_credit_notes')
        .select('credit_available, credit_used')
        .eq('id', creditNoteId)
        .single();

      if (cnFetchError) throw cnFetchError;

      const newCreditAvailable = Math.max(0, (currentCN.credit_available || 0) - parsedAmount);
      const newCreditUsed = (currentCN.credit_used || 0) + parsedAmount;

      const { error: cnUpdateError } = await supabase
        .from('supplier_credit_notes')
        .update({
          credit_available: newCreditAvailable,
          credit_used: newCreditUsed,
        })
        .eq('id', creditNoteId);

      if (cnUpdateError) throw cnUpdateError;

      toast.success(t('credit_applied_successfully'));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error using credit:', error);
      toast.error(t('error_using_credit'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            {t('use_supplier_credit')}
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
                {/* Credit Note Info */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">{t('credit_note')}</span>
                    <span className="font-mono text-sm">{creditNoteNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('credit_available')}:</span>
                    <span className="font-mono font-bold text-lg text-green-600">
                      {formatCurrency(creditAvailable, currency)}
                    </span>
                  </div>
                </div>

                {unpaidDocuments.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      {t('no_unpaid_documents_for_supplier')}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Separator />
                    
                    {/* Document Selection */}
                    <div className="space-y-3">
                      <Label>{t('select_document_to_pay')}</Label>
                      <RadioGroup value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                        {unpaidDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedDocumentId === doc.id 
                                ? 'border-primary bg-primary/5' 
                                : 'border-muted hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedDocumentId(doc.id)}
                          >
                            <RadioGroupItem value={doc.id} id={doc.id} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-medium">{doc.invoice_number || '-'}</span>
                                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                                  {formatCurrency(doc.remaining, doc.currency)} {t('remaining')}
                                </Badge>
                              </div>
                              {doc.invoice_date && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(doc.invoice_date), 'PPP', { locale: getDateLocale() })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    {selectedDocument && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <Separator />
                        
                        {/* Amount to Use */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>{t('amount_to_apply')} *</Label>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleMaxClick}
                              className="h-6 text-xs"
                            >
                              Max: {formatCurrency(maxUsable, currency)}
                            </Button>
                          </div>
                          <Input
                            type="number"
                            step="0.001"
                            min="0.001"
                            max={maxUsable}
                            value={amountToUse}
                            onChange={(e) => setAmountToUse(e.target.value)}
                            placeholder="0.000"
                          />
                        </div>

                        {/* Preview */}
                        {parsedAmount > 0 && (
                          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                            <div className="flex items-center justify-center gap-4 py-2">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">{t('credit_to_use')}</p>
                                <p className="font-mono font-semibold text-orange-600">
                                  -{formatCurrency(parsedAmount, currency)}
                                </p>
                              </div>
                              <ArrowRight className="h-5 w-5 text-green-600" />
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">{t('new_remaining')}</p>
                                <p className="font-mono font-bold text-green-600">
                                  {formatCurrency(Math.max(0, selectedDocument.remaining - parsedAmount), currency)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </>
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
            onClick={handleUseCredit}
            disabled={!canUse || isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t('apply_credit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
