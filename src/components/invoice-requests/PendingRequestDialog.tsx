import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Receipt, 
  Store, 
  Calendar, 
  CreditCard, 
  Edit3, 
  FileText,
  User,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface PendingRequest {
  id: string;
  request_number: string;
  identifier_value: string;
  status: string;
  created_at: string;
  transaction_number: string;
  total_ttc: number;
  store_id: string | null;
  purchase_date: string;
  client_type?: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  identifier_type?: string;
  country?: string;
  governorate?: string | null;
  address?: string | null;
  postal_code?: string | null;
  phone_prefix?: string | null;
  phone?: string | null;
  whatsapp_prefix?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  receipt_number?: string | null;
  order_number?: string | null;
  payment_status?: string;
  paid_amount?: number | null;
  payment_methods?: any;
  linked_client_id?: string | null;
}

interface StoreData {
  id: string;
  name: string;
}

interface PendingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: PendingRequest[];
  stores: StoreData[];
  onEditRequest: (request: PendingRequest) => void;
}

export const PendingRequestDialog: React.FC<PendingRequestDialogProps> = ({
  open,
  onOpenChange,
  requests,
  stores,
  onEditRequest,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [fullRequestData, setFullRequestData] = useState<PendingRequest | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const getDateLocale = () => {
    switch (language) { case 'ar': return arSA; case 'en': return enUS; default: return fr; }
  };

  useEffect(() => {
    if (!open) {
      setSelectedRequest(null);
      setFullRequestData(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedRequest?.id) {
      loadFullRequest(selectedRequest.id);
    }
  }, [selectedRequest?.id]);

  const loadFullRequest = async (requestId: string) => {
    setIsLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('invoice_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFullRequestData(data as PendingRequest);
      }
    } catch (error) {
      console.error('Error loading request details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getStoreName = (storeId: string | null) => {
    if (!storeId) return t('not_specified');
    return stores.find(s => s.id === storeId)?.name || t('unknown_store');
  };

  const getPaymentStatusLabel = (status?: string) => {
    switch (status) {
      case 'paid': return { label: t('paid_label'), variant: 'default' as const };
      case 'partial': return { label: t('partial_label'), variant: 'secondary' as const };
      case 'unpaid': return { label: t('unpaid_label'), variant: 'outline' as const };
      default: return { label: 'N/A', variant: 'outline' as const };
    }
  };

  const getClientDisplayName = (request: PendingRequest) => {
    if (request.company_name) return request.company_name;
    const name = `${request.first_name || ''} ${request.last_name || ''}`.trim();
    return name || 'Client';
  };

  const handleEditClick = () => {
    if (fullRequestData) {
      onEditRequest(fullRequestData);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('pending_requests_detected_title')}
          </DialogTitle>
          <DialogDescription>
            {requests.length === 1 
              ? t('one_request_pending_for_id')
              : `${requests.length} ${t('multiple_requests_pending_for_id')}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mt-4">
          {/* Left: Request list */}
          <div className="w-1/3 border-r pr-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {t('select_a_request')}
            </h4>
            <ScrollArea className="h-[350px]">
              <div className="space-y-2 pr-2">
                {requests.map((req) => (
                  <motion.button
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedRequest?.id === req.id 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-sm">{req.request_number}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(req.created_at), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Receipt className="h-3 w-3" />
                        {req.transaction_number}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3 w-3" />
                        {req.total_ttc?.toFixed(3)} TND
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Request details */}
          <div className="flex-1">
            {!selectedRequest ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                <p className="text-center text-sm">
                  {t('click_request_for_details')}
                </p>
              </div>
            ) : isLoadingDetails ? (
              <div className="h-[350px] flex items-center justify-center">
                <div className="animate-pulse text-center">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2 animate-spin" />
                  <p className="text-sm text-muted-foreground">{t('loading_details')}</p>
                </div>
              </div>
            ) : fullRequestData ? (
              <ScrollArea className="h-[350px]">
                <div className="space-y-4 pr-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{fullRequestData.request_number}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t('created_on')} {format(new Date(fullRequestData.created_at), "dd MMMM yyyy", { locale: getDateLocale() })} {t('at_time')} {format(new Date(fullRequestData.created_at), "HH:mm", { locale: getDateLocale() })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                      <Clock className="h-3 w-3 mr-1" />
                      {t('pending_status')}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Client info */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      {fullRequestData.company_name ? (
                        <Building2 className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-primary" />
                      )}
                      {t('client_label')}
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="font-medium">{getClientDisplayName(fullRequestData)}</p>
                      <p className="text-sm text-muted-foreground">
                        {fullRequestData.identifier_type?.toUpperCase()}: {fullRequestData.identifier_value}
                      </p>
                      {fullRequestData.email && (
                        <p className="text-sm text-muted-foreground">📧 {fullRequestData.email}</p>
                      )}
                      {fullRequestData.phone && (
                        <p className="text-sm text-muted-foreground">
                          📱 {fullRequestData.phone_prefix} {fullRequestData.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Transaction info */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      {t('transaction_label')}
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('transaction_number_label')}</span>
                          <p className="font-medium">{fullRequestData.transaction_number}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('purchase_date_label')}</span>
                          <p className="font-medium">
                            {format(new Date(fullRequestData.purchase_date), 'dd/MM/yyyy', { locale: getDateLocale() })}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('point_of_sale_label')}</span>
                          <p className="font-medium">{getStoreName(fullRequestData.store_id)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('amount_ttc_label')}</span>
                          <p className="font-semibold text-primary">{fullRequestData.total_ttc?.toFixed(3)} TND</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment info */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {t('payment_label')}
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Badge {...getPaymentStatusLabel(fullRequestData.payment_status)}>
                          {getPaymentStatusLabel(fullRequestData.payment_status).label}
                        </Badge>
                        {fullRequestData.payment_status === 'partial' && fullRequestData.paid_amount && (
                          <span className="text-sm text-muted-foreground">
                            ({fullRequestData.paid_amount?.toFixed(3)} TND {t('paid_amount_suffix')})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Edit button */}
                  <div className="pt-4">
                    <Button onClick={handleEditClick} className="w-full">
                      <Edit3 className="h-4 w-4 mr-2" />
                      {t('modify_this_request')}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t('request_will_be_updated')}
                    </p>
                  </div>
                </div>
              </ScrollArea>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
