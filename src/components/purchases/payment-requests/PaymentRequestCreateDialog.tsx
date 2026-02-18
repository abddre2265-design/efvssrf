import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, Percent } from 'lucide-react';
import { formatCurrency } from '@/components/invoices/types';
import { useTaxRates } from '@/hooks/useTaxRates';

interface PurchaseLine {
  id: string;
  vat_rate: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
}

interface PurchaseDocument {
  id: string;
  invoice_number: string | null;
  subtotal_ht: number;
  total_vat: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_payable: number;
  paid_amount: number;
  currency: string;
  supplier?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    supplier_type: string;
  };
  lines?: PurchaseLine[];
}

interface PaymentRequestCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: PurchaseDocument | null;
  onRequestCreated: () => void;
}

export const PaymentRequestCreateDialog: React.FC<PaymentRequestCreateDialogProps> = ({
  open,
  onOpenChange,
  document,
  onRequestCreated,
}) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [selectedWithholdingRate, setSelectedWithholdingRate] = useState<string>('0');
  
  const { withholdingRates } = useTaxRates(organizationId);

  useEffect(() => {
    const fetchOrg = async () => {
      const { data } = await supabase
        .from('organizations')
        .select('id')
        .single();
      if (data) setOrganizationId(data.id);
    };
    fetchOrg();
  }, []);

  // Group VAT by rate from lines
  const vatBreakdown = useMemo(() => {
    if (!document?.lines?.length) return [];
    const grouped: Record<number, number> = {};
    for (const line of document.lines) {
      const rate = line.vat_rate;
      grouped[rate] = (grouped[rate] || 0) + line.line_vat;
    }
    return Object.entries(grouped)
      .map(([rate, amount]) => ({ rate: Number(rate), amount }))
      .filter(v => v.amount !== 0)
      .sort((a, b) => a.rate - b.rate);
  }, [document?.lines]);

  if (!document) return null;

  const remainingAmount = document.net_payable - document.paid_amount;
  const withholdingRate = parseFloat(selectedWithholdingRate) || 0;
  const withholdingAmount = document.total_ttc * (withholdingRate / 100);
  // Net à payer = Total TTC - Retenue + Timbre fiscal (+ taxes supplémentaires incluses dans stamp_duty_amount)
  const netRequestedAmount = remainingAmount - withholdingAmount;

  const getSupplierName = () => {
    const supplier = document.supplier;
    if (!supplier) return 'N/A';
    if (supplier.supplier_type === 'business_local') {
      return supplier.company_name || 'N/A';
    }
    return [supplier.first_name, supplier.last_name].filter(Boolean).join(' ') || 'N/A';
  };

  const handleSubmit = async () => {
    if (!organizationId || !document) return;

    setIsSubmitting(true);
    try {
      const { data: requestNumber, error: numError } = await supabase
        .rpc('generate_payment_request_number', { org_id: organizationId });

      if (numError) throw numError;

      const { error } = await supabase
        .from('purchase_payment_requests')
        .insert({
          organization_id: organizationId,
          purchase_document_id: document.id,
          request_number: requestNumber,
          requested_amount: remainingAmount,
          withholding_rate: withholdingRate,
          withholding_amount: withholdingAmount,
          net_requested_amount: netRequestedAmount,
          status: 'pending',
        });

      if (error) throw error;

      toast.success(t('payment_request_created_success'));
      onOpenChange(false);
      onRequestCreated();
    } catch (error) {
      console.error('Error creating payment request:', error);
      toast.error(t('error_creating_request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t('payment_request')}
          </DialogTitle>
          <DialogDescription>
            {t('create_payment_request_for_invoice')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document info */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('invoice')}</span>
              <span className="font-mono font-medium">{document.invoice_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('supplier')}</span>
              <span className="font-medium">{getSupplierName()}</span>
            </div>
          </div>

          <Separator />

          {/* Withholding rate selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              {t('withholding_rate')}
            </Label>
            <Select value={selectedWithholdingRate} onValueChange={setSelectedWithholdingRate}>
              <SelectTrigger>
                <SelectValue placeholder={t('select_rate')} />
              </SelectTrigger>
              <SelectContent>
                {withholdingRates.map((rate) => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detailed calculation summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            {/* Total facture */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">{t('invoice_total')}</span>
              <span className="font-semibold">{formatCurrency(document.net_payable, document.currency)}</span>
            </div>

            <Separator className="my-1" />

            {/* Total HT */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('total_ht')}</span>
              <span className="font-medium">{formatCurrency(document.subtotal_ht, document.currency)}</span>
            </div>

            {/* TVA breakdown by rate */}
            {vatBreakdown.length > 0 ? (
              vatBreakdown.map(({ rate, amount }) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('vat')} ({rate}%)</span>
                  <span className="font-medium">{formatCurrency(amount, document.currency)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('total_vat')}</span>
                <span className="font-medium">{formatCurrency(document.total_vat, document.currency)}</span>
              </div>
            )}

            {/* Total TTC = HT + TVA */}
            <div className="flex justify-between text-sm font-medium">
              <span className="text-muted-foreground">{t('total_ttc')} (HT + TVA)</span>
              <span>{formatCurrency(document.total_ttc, document.currency)}</span>
            </div>

            {/* Retenue */}
            {withholdingRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('withholding')} ({withholdingRate}%)</span>
                <span className="font-medium text-orange-600">
                  -{formatCurrency(withholdingAmount, document.currency)}
                </span>
              </div>
            )}

            {/* Timbre fiscal + taxes supplémentaires */}
            {document.stamp_duty_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('stamp_duty')}</span>
                <span className="font-medium">{formatCurrency(document.stamp_duty_amount, document.currency)}</span>
              </div>
            )}

            <Separator className="my-1" />

            {/* Net à payer */}
            <div className="flex justify-between">
              <span className="font-semibold">{t('net_to_pay')}</span>
              <span className="font-bold text-lg text-primary">
                {formatCurrency(netRequestedAmount, document.currency)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('payment_request_will_be_sent')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || netRequestedAmount <= 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('sending')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t('request')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
