import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Banknote, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  Calculator,
  ArrowDownCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/invoices/types';

interface SupplierCreditRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string;
  creditAvailable: number;
  purchaseDocumentId: string;
  supplierId: string;
  organizationId: string;
  currency: string;
  exchangeRate?: number | null;
  onSuccess: () => void;
}

interface PurchaseDocumentData {
  id: string;
  invoice_number: string | null;
  total_ttc: number;
  paid_amount: number;
  payment_status: string;
  total_credited: number;
}

const REFUND_METHODS = [
  { value: 'cash', label: 'cash' },
  { value: 'bank_transfer', label: 'bank_transfer' },
  { value: 'check', label: 'check' },
];

export const SupplierCreditRefundDialog: React.FC<SupplierCreditRefundDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  creditAvailable,
  purchaseDocumentId,
  supplierId,
  organizationId,
  currency,
  exchangeRate,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [purchaseDocument, setPurchaseDocument] = useState<PurchaseDocumentData | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<string>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const isForeignCurrency = currency !== 'TND';
  const displayExchangeRate = exchangeRate || 1;
  const amountInTND = creditAvailable * displayExchangeRate;

  useEffect(() => {
    const fetchPurchaseDocumentData = async () => {
      if (!open || !purchaseDocumentId) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('purchase_documents')
          .select('id, invoice_number, total_ttc, paid_amount, payment_status, total_credited')
          .eq('id', purchaseDocumentId)
          .single();

        if (error) throw error;
        setPurchaseDocument(data as PurchaseDocumentData);
      } catch (error) {
        console.error('Error fetching purchase document:', error);
        toast.error(t('error_loading_data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchaseDocumentData();
  }, [open, purchaseDocumentId]);

  // Calculate max refundable (supplier owes this to us)
  // For supplier credit notes: we can request refund of credit_available from supplier
  const maxRefundable = useMemo(() => {
    return creditAvailable;
  }, [creditAvailable]);

  const canRefund = creditAvailable > 0;

  const refundBlockedReason = useMemo(() => {
    if (creditAvailable <= 0) {
      return t('refund_blocked_no_credit');
    }
    return null;
  }, [creditAvailable, t]);

  const handleRefund = async () => {
    const amount = parseFloat(refundAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('invalid_refund_amount'));
      return;
    }
    
    if (amount > maxRefundable) {
      toast.error(t('refund_exceeds_max'));
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update credit note - reduce credit_available
      const { data: currentCN, error: cnFetchError } = await supabase
        .from('supplier_credit_notes')
        .select('credit_available, credit_used')
        .eq('id', creditNoteId)
        .single();

      if (cnFetchError) throw cnFetchError;

      const newCreditAvailable = Math.max(0, (currentCN.credit_available || 0) - amount);
      const newCreditUsed = (currentCN.credit_used || 0) + amount;

      const { error: cnUpdateError } = await supabase
        .from('supplier_credit_notes')
        .update({
          credit_available: newCreditAvailable,
          credit_used: newCreditUsed,
        })
        .eq('id', creditNoteId);

      if (cnUpdateError) throw cnUpdateError;

      toast.success(t('supplier_refund_received'));
      onSuccess();
      onOpenChange(false);
      
      setRefundAmount('');
      setRefundMethod('bank_transfer');
      setReferenceNumber('');
      setNotes('');
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error(t('error_processing_refund'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaxClick = () => {
    setRefundAmount(maxRefundable.toFixed(3));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-green-600" />
            {t('receive_supplier_refund')}
          </DialogTitle>
          <DialogDescription>
            {t('receive_supplier_refund_description')} <span className="font-mono font-medium">{creditNoteNumber}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {purchaseDocument && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('linked_purchase_document')}:</span>
                  <span className="font-mono font-medium">{purchaseDocument.invoice_number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('credit_available')}:</span>
                  <span className="font-medium text-green-600">{formatCurrency(creditAvailable, currency)}</span>
                </div>
                {isForeignCurrency && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>≈ {formatCurrency(amountInTND, 'TND')}</span>
                    <span>({t('exchange_rate')}: {displayExchangeRate.toFixed(4)})</span>
                  </div>
                )}
              </div>
            )}

            {!canRefund && refundBlockedReason && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('refund_not_possible')}</AlertTitle>
                <AlertDescription>{refundBlockedReason}</AlertDescription>
              </Alert>
            )}

            {canRefund && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <Calculator className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700">{t('available_for_refund')}</AlertTitle>
                <AlertDescription className="space-y-1">
                  <div>{formatCurrency(maxRefundable, currency)}</div>
                  {isForeignCurrency && (
                    <div className="text-xs text-muted-foreground">
                      ≈ {formatCurrency(maxRefundable * displayExchangeRate, 'TND')}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {canRefund && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('refund_amount_to_receive')} *</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleMaxClick}
                      className="h-6 text-xs"
                    >
                      Max: {formatCurrency(maxRefundable, currency)}
                    </Button>
                  </div>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={maxRefundable}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('payment_method_received')} *</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFUND_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {t(method.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('reference_number')}</Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder={t('optional_reference')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('notes')}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('supplier_refund_notes_placeholder')}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          {canRefund && (
            <Button 
              onClick={handleRefund} 
              disabled={isSaving || !refundAmount || parseFloat(refundAmount) <= 0}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {t('confirm_receipt')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
