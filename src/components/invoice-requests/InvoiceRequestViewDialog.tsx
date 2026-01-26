import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User,
  Building2,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Store,
  Receipt,
  Calendar,
  Hash,
  Clock,
  CheckCircle,
  XCircle,
  FileCheck,
  FileText,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { InvoiceRequest } from './types';
import { ProcessRequestChoiceDialog } from './ProcessRequestChoiceDialog';
import { PasswordConfirmDialog } from './PasswordConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoiceRequestViewDialogProps {
  request: InvoiceRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessRequest?: (request: InvoiceRequest, method: 'standard' | 'ai') => void;
  onRefresh?: () => void;
}

export const InvoiceRequestViewDialog: React.FC<InvoiceRequestViewDialogProps> = ({
  request,
  open,
  onOpenChange,
  onProcessRequest,
  onRefresh,
}) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const getLocale = () => {
    switch (language) {
      case 'fr': return fr;
      case 'ar': return ar;
      default: return enUS;
    }
  };

  if (!request) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            {t('pending')}
          </Badge>
        );
      case 'processed':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('processed')}
          </Badge>
        );
      case 'converted':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <FileCheck className="h-3 w-3 mr-1" />
            {t('converted')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            {t('rejected')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">{t('paid')}</Badge>;
      case 'partial':
        return <Badge className="bg-orange-500">{t('partial')}</Badge>;
      case 'unpaid':
        return <Badge className="bg-red-500">{t('unpaid')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cash: t('cash'),
      check: t('check'),
      bank_transfer: t('bank_transfer'),
      card: t('card'),
      mixed: t('mixed'),
    };
    return methods[method] || method;
  };

  const handleProcess = () => {
    setChoiceDialogOpen(true);
  };

  const handleChooseMethod = (method: 'standard' | 'ai') => {
    setChoiceDialogOpen(false);
    if (onProcessRequest) {
      onProcessRequest(request, method);
    }
    onOpenChange(false);
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id);

      if (error) throw error;

      toast.success(t('request_rejected_success'));
      onRefresh?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error.message || t('error_rejecting_request'));
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({ status: 'pending' })
        .eq('id', request.id);

      if (error) throw error;

      toast.success(t('request_restored_success'));
      onRefresh?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error restoring request:', error);
      toast.error(error.message || t('error_restoring_request'));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleViewInvoice = () => {
    if (request.generated_invoice_id) {
      // Navigate to invoices page with the invoice to open
      navigate(`/dashboard/invoices?openInvoice=${request.generated_invoice_id}`);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {t('invoice_request')} #{request.request_number}
              </DialogTitle>
              {getStatusBadge(request.status)}
            </div>
          </DialogHeader>

          {/* Action buttons based on status */}
          <div className="flex gap-2 mb-4">
            {request.status === 'pending' && (
              <>
                <Button onClick={handleProcess} className="gap-2">
                  <FileText className="h-4 w-4" />
                  {t('process_request')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  {t('reject')}
                </Button>
              </>
            )}

            {(request.status === 'processed' || request.status === 'converted') && request.generated_invoice_id && (
              <Button onClick={handleViewInvoice} className="gap-2">
                <FileText className="h-4 w-4" />
                {t('view_invoice')}
              </Button>
            )}

            {request.status === 'rejected' && (
              <Button
                variant="outline"
                onClick={() => setRestoreDialogOpen(true)}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                {t('restore_request')}
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Client Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {request.client_type === 'company' || request.client_type === 'business_local' ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    {t('client_info')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('name')}:</span>
                      <p className="font-medium">
                        {request.client_type === 'company' || request.client_type === 'business_local'
                          ? request.company_name
                          : `${request.first_name || ''} ${request.last_name || ''}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('identifier')}:</span>
                      <p className="font-medium font-mono">{request.identifier_value}</p>
                      <p className="text-xs text-muted-foreground">{request.identifier_type}</p>
                    </div>
                    {request.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{request.email}</span>
                      </div>
                    )}
                    {request.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{request.phone_prefix} {request.phone}</span>
                      </div>
                    )}
                    {request.address && (
                      <div className="col-span-2 flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span>
                          {request.address}
                          {request.governorate && `, ${request.governorate}`}
                          {request.postal_code && ` ${request.postal_code}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Transaction Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    {t('transaction_info')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">{t('purchase_date')}:</span>
                        <p className="font-medium">
                          {format(new Date(request.purchase_date), 'dd/MM/yyyy', { locale: getLocale() })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">{t('store')}:</span>
                        <p className="font-medium">{request.store?.name || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground">{t('transaction_number')}:</span>
                        <p className="font-medium font-mono">{request.transaction_number}</p>
                      </div>
                    </div>
                    {request.receipt_number && (
                      <div>
                        <span className="text-muted-foreground">{t('receipt_number')}:</span>
                        <p className="font-medium font-mono">{request.receipt_number}</p>
                      </div>
                    )}
                    {request.order_number && (
                      <div>
                        <span className="text-muted-foreground">{t('order_number')}:</span>
                        <p className="font-medium font-mono">{request.order_number}</p>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{t('total_ttc')}</span>
                    <span className="text-2xl font-bold text-primary">
                      {request.total_ttc.toFixed(3)} TND
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t('payment_info')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>{t('payment_status')}:</span>
                    {getPaymentStatusBadge(request.payment_status)}
                  </div>
                  
                  {request.payment_status !== 'unpaid' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span>{t('paid_amount')}:</span>
                        <span className="font-mono font-medium">{request.paid_amount.toFixed(3)} TND</span>
                      </div>
                      
                      {request.payment_methods && request.payment_methods.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-muted-foreground">{t('payment_methods')}:</span>
                          <div className="space-y-1">
                            {request.payment_methods.map((pm, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                                <span>{getPaymentMethodLabel(pm.method)}</span>
                                <span className="font-mono">{pm.amount.toFixed(3)} TND</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Request Info */}
              <div className="text-xs text-muted-foreground text-center">
                {t('request_submitted_on')} {format(new Date(request.request_date), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Choice Dialog */}
      <ProcessRequestChoiceDialog
        open={choiceDialogOpen}
        onOpenChange={setChoiceDialogOpen}
        onChooseStandard={() => handleChooseMethod('standard')}
        onChooseAI={() => handleChooseMethod('ai')}
      />

      {/* Reject Confirmation Dialog */}
      <PasswordConfirmDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleReject}
        title={t('confirm_reject_request')}
        description={t('confirm_reject_request_description')}
        confirmText={t('reject')}
        variant="destructive"
      />

      {/* Restore Confirmation Dialog */}
      <PasswordConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        onConfirm={handleRestore}
        title={t('confirm_restore_request')}
        description={t('confirm_restore_request_description')}
        confirmText={t('restore')}
        variant="default"
      />
    </>
  );
};
