import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Banknote,
  Receipt,
  FileText,
  Building2,
  Globe,
  Wallet,
  Layers,
  CalendarIcon,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PurchasePaymentRequest,
  PaymentMethodLine,
  PAYMENT_REQUEST_STATUSES,
  PAYMENT_METHODS,
} from './types';

interface PublicPaymentRequestsBlockProps {
  organizationId: string;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  check: <Receipt className="h-4 w-4" />,
  draft: <FileText className="h-4 w-4" />,
  iban_transfer: <Building2 className="h-4 w-4" />,
  swift_transfer: <Globe className="h-4 w-4" />,
  bank_deposit: <Wallet className="h-4 w-4" />,
  mixed: <Layers className="h-4 w-4" />,
};

export const PublicPaymentRequestsBlock: React.FC<PublicPaymentRequestsBlockProps> = ({
  organizationId,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [requests, setRequests] = useState<PurchasePaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PurchasePaymentRequest | null>(null);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  
  // Payment form state
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [mixedLines, setMixedLines] = useState<PaymentMethodLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getLocale = () => {
    switch (language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: t('payment_method_cash'),
      card: t('payment_method_card'),
      check: t('payment_method_check'),
      draft: t('payment_method_draft'),
      iban_transfer: t('payment_method_iban_transfer'),
      swift_transfer: t('payment_method_swift_transfer'),
      bank_deposit: t('payment_method_bank_deposit'),
      mixed: t('payment_method_mixed'),
    };
    return labels[method] || method;
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_payment_requests')
        .select(`
          *,
          purchase_document:purchase_documents(
            id,
            invoice_number,
            invoice_date,
            net_payable,
            currency,
            supplier:suppliers(id, first_name, last_name, company_name, supplier_type)
          )
        `)
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'awaiting_approval', 'approved', 'rejected'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as unknown as PurchasePaymentRequest[]);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchRequests();
    }
  }, [organizationId]);

  const generateLineId = () => Math.random().toString(36).substring(2, 9);

  const handleOpenProcess = (request: PurchasePaymentRequest) => {
    setSelectedRequest(request);
    setPaidAmount(request.net_requested_amount.toFixed(3));
    setPaymentMethod('');
    setReferenceNumber('');
    setPaymentDate(new Date());
    setPaymentNotes('');
    setMixedLines([]);
    setIsProcessDialogOpen(true);
  };

  const addMixedLine = () => {
    setMixedLines([...mixedLines, { id: generateLineId(), method: '', amount: 0, referenceNumber: '' }]);
  };

  const removeMixedLine = (id: string) => {
    if (mixedLines.length > 1) {
      setMixedLines(mixedLines.filter(line => line.id !== id));
    }
  };

  const updateMixedLine = (id: string, field: keyof PaymentMethodLine, value: string | number) => {
    setMixedLines(mixedLines.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  useEffect(() => {
    if (paymentMethod === 'mixed' && mixedLines.length === 0) {
      setMixedLines([{ id: generateLineId(), method: '', amount: 0, referenceNumber: '' }]);
    } else if (paymentMethod !== 'mixed') {
      setMixedLines([]);
    }
  }, [paymentMethod]);

  const selectedMethodConfig = PAYMENT_METHODS.find(m => m.value === paymentMethod);
  const requiresReference = selectedMethodConfig?.requiresReference || false;
  const isMixed = paymentMethod === 'mixed';

  const parsedAmount = parseFloat(paidAmount) || 0;
  const mixedTotal = mixedLines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const mixedDiff = parsedAmount - mixedTotal;
  const isMixedValid = Math.abs(mixedDiff) < 0.001;

  const areMixedLinesValid = mixedLines.every(line => {
    const method = PAYMENT_METHODS.find(m => m.value === line.method);
    if (!method) return false;
    if (line.amount <= 0) return false;
    if (method.requiresReference && !line.referenceNumber.trim()) return false;
    return true;
  });

  const canSubmit = selectedRequest && parsedAmount > 0 && 
    parsedAmount <= selectedRequest.net_requested_amount && paymentMethod &&
    (isMixed ? (mixedLines.length > 0 && areMixedLinesValid && isMixedValid) : (!requiresReference || referenceNumber.trim()));

  const handleSubmitPayment = async () => {
    if (!selectedRequest || !canSubmit) return;

    setIsSubmitting(true);
    try {
      // Convert mixedLines to a JSON-compatible format
      const paymentMethodsJson = isMixed ? mixedLines.map(line => ({
        id: line.id,
        method: line.method,
        amount: line.amount,
        referenceNumber: line.referenceNumber,
      })) : null;

      const { error } = await supabase
        .from('purchase_payment_requests')
        .update({
          paid_amount: parsedAmount,
          payment_method: paymentMethod,
          payment_methods: paymentMethodsJson,
          reference_number: isMixed ? null : referenceNumber || null,
          payment_date: paymentDate.toISOString(),
          payment_notes: paymentNotes || null,
          status: 'awaiting_approval',
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success(t('payment_registered_awaiting'));
      setIsProcessDialogOpen(false);
      fetchRequests();
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error(t('error_registering_payment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = PAYMENT_REQUEST_STATUSES[status as keyof typeof PAYMENT_REQUEST_STATUSES];
    return <Badge className={config?.color || 'bg-muted'}>{config?.label || status}</Badge>;
  };

  const getSupplierName = (request: PurchasePaymentRequest) => {
    const supplier = request.purchase_document?.supplier;
    if (!supplier) return 'N/A';
    if (supplier.supplier_type === 'business_local') {
      return supplier.company_name || 'N/A';
    }
    return [supplier.first_name, supplier.last_name].filter(Boolean).join(' ') || 'N/A';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
    }).format(amount);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests = requests.filter(r => r.status !== 'pending');

  return (
    <>
      <Card dir={isRTL ? 'rtl' : 'ltr'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('payment_requests')}
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('no_payment_requests')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {/* Pending requests first */}
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 border rounded-lg bg-yellow-500/5 border-yellow-500/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium">{request.request_number}</span>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('invoice')}: </span>
                        <span className="font-mono">{request.purchase_document?.invoice_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('supplier')}: </span>
                        <span>{getSupplierName(request)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground text-sm">{t('net_to_pay')}: </span>
                        <span className="font-bold text-lg">{formatCurrency(request.net_requested_amount)}</span>
                      </div>
                      <Button size="sm" onClick={() => handleOpenProcess(request)}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        {t('process_payment')}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Other requests */}
                {otherRequests.map((request) => (
                  <div
                    key={request.id}
                    className={cn(
                      "p-4 border rounded-lg space-y-2",
                      request.status === 'approved' && "bg-green-500/5 border-green-500/30",
                      request.status === 'rejected' && "bg-red-500/5 border-red-500/30",
                      request.status === 'awaiting_approval' && "bg-blue-500/5 border-blue-500/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{request.request_number}</span>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {request.purchase_document?.invoice_number} - {getSupplierName(request)}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t('amount')}: </span>
                      <span className="font-medium">{formatCurrency(request.net_requested_amount)}</span>
                    </div>
                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="p-2 bg-red-500/10 rounded text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        {t('rejection_reason_short')}: {request.rejection_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Process Payment Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('process_payment_title')}</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Request info */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('request')}</span>
                  <span className="font-mono">{selectedRequest.request_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoice')}</span>
                  <span className="font-mono">{selectedRequest.purchase_document?.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('net_requested')}</span>
                  <span className="font-bold">{formatCurrency(selectedRequest.net_requested_amount)}</span>
                </div>
              </div>

              <Separator />

              {/* Payment amount */}
              <div className="space-y-2">
                <Label>{t('paid_amount')}</Label>
                <Input
                  type="number"
                  step="0.001"
                  max={selectedRequest.net_requested_amount}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0.000"
                />
                {parsedAmount > selectedRequest.net_requested_amount && (
                  <p className="text-xs text-red-600">
                    {t('amount_cannot_exceed')} {formatCurrency(selectedRequest.net_requested_amount)}
                  </p>
                )}
              </div>

              {/* Payment date */}
              <div className="space-y-2">
                <Label>{t('payment_date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {format(paymentDate, 'dd/MM/yyyy', { locale: getLocale() })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={(date) => date && setPaymentDate(date)}
                      locale={getLocale()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Payment method */}
              <div className="space-y-2">
                <Label>{t('payment_method')}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          {PAYMENT_METHOD_ICONS[method.value]}
                          {getPaymentMethodLabel(method.value)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reference number (for non-mixed, non-cash/card) */}
              {!isMixed && requiresReference && (
                <div className="space-y-2">
                  <Label>{t('reference_required')}</Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder={t('reference_placeholder')}
                  />
                </div>
              )}

              {/* Mixed payment lines */}
              {isMixed && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('mixed_payment_details')}</Label>
                    <Button variant="outline" size="sm" onClick={addMixedLine}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('add_line')}
                    </Button>
                  </div>
                  {mixedLines.map((line, idx) => {
                    const lineMethod = PAYMENT_METHODS.find(m => m.value === line.method);
                    return (
                      <div key={line.id} className="p-3 border rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{t('line_number')} {idx + 1}</span>
                          {mixedLines.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-auto"
                              onClick={() => removeMixedLine(line.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={line.method}
                            onValueChange={(v) => updateMixedLine(line.id, 'method', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={t('mode_label')} />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.filter(m => m.value !== 'mixed').map((method) => (
                                <SelectItem key={method.value} value={method.value}>
                                  {getPaymentMethodLabel(method.value)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            step="0.001"
                            value={line.amount || ''}
                            onChange={(e) => updateMixedLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder={t('amount')}
                            className="h-9"
                          />
                        </div>
                        {lineMethod?.requiresReference && (
                          <Input
                            value={line.referenceNumber}
                            onChange={(e) => updateMixedLine(line.id, 'referenceNumber', e.target.value)}
                            placeholder={t('reference_required')}
                            className="h-9"
                          />
                        )}
                      </div>
                    );
                  })}
                  {/* Mixed total validation */}
                  <div className={cn(
                    "p-2 rounded text-sm",
                    isMixedValid ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
                  )}>
                    {t('total')}: {formatCurrency(mixedTotal)}
                    {!isMixedValid && ` (${t('difference_label')}: ${formatCurrency(mixedDiff)})`}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>{t('optional_notes_label')}</Label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder={t('additional_info')}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmitPayment} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {t('submit_button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
