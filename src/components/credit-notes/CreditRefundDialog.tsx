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
  Info,
  Calculator
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/invoices/types';

interface CreditRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  creditNoteNumber: string;
  creditAvailable: number;
  invoiceId: string;
  clientId: string;
  organizationId: string;
  currency: string;
  onSuccess: () => void;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  total_ttc: number;
  paid_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  total_credited: number;
}

const REFUND_METHODS = [
  { value: 'cash', label: 'cash' },
  { value: 'bank_transfer', label: 'bank_transfer' },
  { value: 'check', label: 'check' },
];

export const CreditRefundDialog: React.FC<CreditRefundDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  creditNoteNumber,
  creditAvailable,
  invoiceId,
  clientId,
  organizationId,
  currency,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<string>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch invoice data to calculate max refundable
  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!open || !invoiceId) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_ttc, paid_amount, payment_status, total_credited')
          .eq('id', invoiceId)
          .single();

        if (error) throw error;
        setInvoice(data as InvoiceData);
      } catch (error) {
        console.error('Error fetching invoice:', error);
        toast.error(t('error_loading_invoice'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoiceData();
  }, [open, invoiceId]);

  // Calculate max refundable amount based on business rules
  const maxRefundable = useMemo(() => {
    if (!invoice) return 0;
    
    // Rule: max_refund = min(paid_amount, total_ttc - total_credited, credit_available)
    const availableFromPayments = invoice.paid_amount;
    const availableFromInvoice = invoice.total_ttc - invoice.total_credited;
    
    return Math.min(
      availableFromPayments,
      availableFromInvoice,
      creditAvailable
    );
  }, [invoice, creditAvailable]);

  // Check if refund is allowed
  const canRefund = useMemo(() => {
    if (!invoice) return false;
    
    // Cannot refund if invoice is unpaid
    if (invoice.payment_status === 'unpaid') return false;
    
    // Cannot refund if no credit available
    if (creditAvailable <= 0) return false;
    
    // Cannot refund if max refundable is 0 or negative
    if (maxRefundable <= 0) return false;
    
    return true;
  }, [invoice, creditAvailable, maxRefundable]);

  // Get reason why refund is not possible
  const refundBlockedReason = useMemo(() => {
    if (!invoice) return null;
    
    if (invoice.payment_status === 'unpaid') {
      return t('refund_blocked_unpaid');
    }
    
    if (creditAvailable <= 0) {
      return t('refund_blocked_no_credit');
    }
    
    if (maxRefundable <= 0) {
      return t('refund_blocked_fully_credited');
    }
    
    return null;
  }, [invoice, creditAvailable, maxRefundable, t]);

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
      // 1. Get current client balance
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('account_balance')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;

      const currentBalance = clientData.account_balance || 0;
      const newBalance = currentBalance - amount; // Decrease client credit (money going out)

      // 2. Create account movement for refund
      const { error: movementError } = await supabase
        .from('client_account_movements')
        .insert({
          client_id: clientId,
          organization_id: organizationId,
          movement_type: 'debit',
          source_type: 'credit_note_refund',
          source_id: creditNoteId,
          amount: amount,
          balance_after: newBalance,
          payment_method: refundMethod,
          reference_number: referenceNumber || null,
          notes: notes || `Remboursement avoir ${creditNoteNumber}`,
        });

      if (movementError) throw movementError;

      // 3. Update credit note - reduce credit_available
      const { data: currentCN, error: cnFetchError } = await supabase
        .from('credit_notes')
        .select('credit_available, credit_used')
        .eq('id', creditNoteId)
        .single();

      if (cnFetchError) throw cnFetchError;

      const newCreditAvailable = (currentCN.credit_available || 0) - amount;
      const newCreditUsed = (currentCN.credit_used || 0) + amount;

      const { error: cnUpdateError } = await supabase
        .from('credit_notes')
        .update({
          credit_available: newCreditAvailable,
          credit_used: newCreditUsed,
        })
        .eq('id', creditNoteId);

      if (cnUpdateError) throw cnUpdateError;

      toast.success(t('refund_success'));
      onSuccess();
      onOpenChange(false);
      
      // Reset form
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
            <Banknote className="h-5 w-5 text-primary" />
            {t('refund_credit_note')}
          </DialogTitle>
          <DialogDescription>
            {t('refund_credit_note_description')} <span className="font-mono font-medium">{creditNoteNumber}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice Info */}
            {invoice && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('linked_invoice')}:</span>
                  <span className="font-mono font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoice_total')}:</span>
                  <span className="font-medium">{formatCurrency(invoice.total_ttc, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('amount_paid')}:</span>
                  <span className="font-medium text-green-600">{formatCurrency(invoice.paid_amount, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('total_credited')}:</span>
                  <span className="font-medium text-orange-600">{formatCurrency(invoice.total_credited, currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('credit_available')}:</span>
                  <span className="font-medium text-primary">{formatCurrency(creditAvailable, currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('payment_status')}:</span>
                  <Badge 
                    variant="outline" 
                    className={
                      invoice.payment_status === 'paid' 
                        ? 'bg-green-500/10 text-green-600 border-green-500/30'
                        : invoice.payment_status === 'partial'
                        ? 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                        : 'bg-red-500/10 text-red-600 border-red-500/30'
                    }
                  >
                    {t(`payment_${invoice.payment_status}`)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Refund blocked alert */}
            {!canRefund && refundBlockedReason && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('refund_not_possible')}</AlertTitle>
                <AlertDescription>{refundBlockedReason}</AlertDescription>
              </Alert>
            )}

            {/* Max refundable info */}
            {canRefund && (
              <Alert>
                <Calculator className="h-4 w-4" />
                <AlertTitle>{t('max_refundable')}</AlertTitle>
                <AlertDescription>
                  {formatCurrency(maxRefundable, currency)}
                </AlertDescription>
              </Alert>
            )}

            {canRefund && (
              <>
                {/* Refund Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('refund_amount')} *</Label>
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

                {/* Refund Method */}
                <div className="space-y-2">
                  <Label>{t('refund_method')} *</Label>
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

                {/* Reference Number */}
                <div className="space-y-2">
                  <Label>{t('reference_number')}</Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder={t('optional_reference')}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>{t('notes')}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('refund_notes_placeholder')}
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
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {t('confirm_refund')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
