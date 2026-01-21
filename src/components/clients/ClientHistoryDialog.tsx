import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  History,
  FileText,
  Receipt,
  CreditCard,
  Package,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  UserPlus,
  UserCog,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { Client } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface ClientHistoryDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEvent {
  id: string;
  type: 'invoice' | 'credit_note' | 'payment' | 'deposit' | 'credit_used' | 'creation' | 'update';
  date: string;
  description: string;
  amount?: number;
  reference?: string;
  status?: string;
  details?: string;
}

export const ClientHistoryDialog: React.FC<ClientHistoryDialogProps> = ({
  client,
  open,
  onOpenChange,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    if (open && client) {
      fetchHistory();
    }
  }, [open, client]);

  const fetchHistory = async () => {
    if (!client) return;
    
    setIsLoading(true);
    const events: HistoryEvent[] = [];

    try {
      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, total_ttc, status, payment_status, created_at')
        .eq('client_id', client.id)
        .order('invoice_date', { ascending: false });

      invoices?.forEach(inv => {
        events.push({
          id: `inv-${inv.id}`,
          type: 'invoice',
          date: inv.created_at,
          description: t('invoice_created'),
          amount: inv.total_ttc,
          reference: inv.invoice_number,
          status: inv.status,
          details: `${t('payment_status')}: ${t(inv.payment_status)}`,
        });
      });

      // Fetch credit notes
      const { data: creditNotes } = await supabase
        .from('credit_notes')
        .select('id, credit_note_number, credit_note_date, total_ttc, status, credit_note_type, created_at')
        .eq('client_id', client.id)
        .order('credit_note_date', { ascending: false });

      creditNotes?.forEach(cn => {
        events.push({
          id: `cn-${cn.id}`,
          type: 'credit_note',
          date: cn.created_at,
          description: cn.credit_note_type === 'product_return' ? t('product_return') : t('financial_credit_note'),
          amount: cn.total_ttc,
          reference: cn.credit_note_number,
          status: cn.status,
        });
      });

      // Fetch payments (from invoices)
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, payment_date, payment_method, reference_number, invoice:invoices(invoice_number, client_id), created_at')
        .order('payment_date', { ascending: false });

      payments?.filter(p => p.invoice?.client_id === client.id).forEach(p => {
        events.push({
          id: `pay-${p.id}`,
          type: 'payment',
          date: p.created_at,
          description: t('payment_received'),
          amount: p.amount,
          reference: p.invoice?.invoice_number,
          details: `${t(`payment_method_${p.payment_method}`)}${p.reference_number ? ` - ${p.reference_number}` : ''}`,
        });
      });

      // Fetch account movements
      const { data: movements } = await supabase
        .from('client_account_movements')
        .select('id, movement_type, amount, source_type, payment_method, reference_number, notes, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      movements?.forEach(mv => {
        const isCredit = mv.movement_type === 'credit';
        events.push({
          id: `mv-${mv.id}`,
          type: isCredit ? 'deposit' : 'credit_used',
          date: mv.created_at,
          description: isCredit ? t('deposit_added') : t('credit_used_label'),
          amount: mv.amount,
          details: mv.source_type === 'direct_deposit' 
            ? `${t(`payment_method_${mv.payment_method}`)}${mv.reference_number ? ` - ${mv.reference_number}` : ''}`
            : t(`source_${mv.source_type}`),
        });
      });

      // Add client creation event
      events.push({
        id: `create-${client.id}`,
        type: 'creation',
        date: client.created_at,
        description: t('client_created_event'),
      });

      // Add client update event if different from creation
      if (client.updated_at !== client.created_at) {
        events.push({
          id: `update-${client.id}`,
          type: 'update',
          date: client.updated_at,
          description: t('client_updated_event'),
        });
      }

      // Sort by date descending
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setHistory(events);
    } catch (error) {
      console.error('Error fetching client history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (type: HistoryEvent['type']) => {
    switch (type) {
      case 'invoice':
        return <FileText className="h-4 w-4" />;
      case 'credit_note':
        return <Receipt className="h-4 w-4" />;
      case 'payment':
        return <CreditCard className="h-4 w-4" />;
      case 'deposit':
        return <ArrowUpCircle className="h-4 w-4" />;
      case 'credit_used':
        return <ArrowDownCircle className="h-4 w-4" />;
      case 'creation':
        return <UserPlus className="h-4 w-4" />;
      case 'update':
        return <UserCog className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: HistoryEvent['type']) => {
    switch (type) {
      case 'invoice':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'credit_note':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
      case 'payment':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'deposit':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
      case 'credit_used':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'creation':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
      case 'update':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  const getClientName = () => {
    if (!client) return '';
    if (client.company_name) return client.company_name;
    return `${client.first_name || ''} ${client.last_name || ''}`.trim();
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'PPpp', { locale: getDateLocale() });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {t('client_history')} - {getClientName()}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('no_history')}
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${getEventColor(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{event.description}</span>
                        {event.amount !== undefined && (
                          <span className={`font-mono font-semibold ${
                            event.type === 'deposit' || event.type === 'payment' 
                              ? 'text-green-600' 
                              : event.type === 'credit_used' 
                                ? 'text-red-600' 
                                : ''
                          }`}>
                            {event.type === 'deposit' || event.type === 'payment' ? '+' : ''}
                            {event.type === 'credit_used' ? '-' : ''}
                            {formatCurrency(event.amount, 'TND')}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {formatDate(event.date)}
                      </div>
                      
                      {event.reference && (
                        <Badge variant="outline" className="text-xs">
                          {event.reference}
                        </Badge>
                      )}
                      
                      {event.details && (
                        <div className="text-sm text-muted-foreground">
                          {event.details}
                        </div>
                      )}
                      
                      {event.status && (
                        <Badge variant="secondary" className="text-xs">
                          {t(event.status)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {index < history.length - 1 && (
                    <Separator className="my-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
