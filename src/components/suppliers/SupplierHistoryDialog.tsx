import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
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
  FileText, 
  Package, 
  Clock, 
  TrendingUp,
  Edit,
  Plus,
  Truck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Supplier } from './types';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';

interface SupplierHistoryDialogProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEvent {
  id: string;
  type: 'purchase_document' | 'purchase_line' | 'supplier_created' | 'supplier_updated';
  date: string;
  description: string;
  amount?: number;
  reference?: string;
  status?: string;
  details?: string;
}

export const SupplierHistoryDialog: React.FC<SupplierHistoryDialogProps> = ({
  supplier,
  open,
  onOpenChange,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getDateLocale = () => {
    switch (language) {
      case 'fr': return fr;
      case 'ar': return ar;
      default: return enUS;
    }
  };

  useEffect(() => {
    if (open && supplier) {
      fetchHistory();
    }
  }, [open, supplier]);

  const fetchHistory = async () => {
    if (!supplier) return;
    setIsLoading(true);
    
    try {
      // Fetch purchase documents
      const { data: purchaseDocuments } = await supabase
        .from('purchase_documents')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false });

      // Fetch purchase lines linked to this supplier's documents
      const { data: purchaseLines } = await supabase
        .from('purchase_lines')
        .select(`
          *,
          purchase_documents!inner(supplier_id)
        `)
        .eq('purchase_documents.supplier_id', supplier.id)
        .order('created_at', { ascending: false });

      // Build events list
      const allEvents: HistoryEvent[] = [];

      // Supplier creation event
      allEvents.push({
        id: `supplier-created-${supplier.id}`,
        type: 'supplier_created',
        date: supplier.created_at,
        description: t('supplier_created_event'),
        details: `${t('supplier_type')}: ${t(supplier.supplier_type)}`,
      });

      // Supplier update event (if different from created)
      if (supplier.updated_at !== supplier.created_at) {
        allEvents.push({
          id: `supplier-updated-${supplier.id}`,
          type: 'supplier_updated',
          date: supplier.updated_at,
          description: t('supplier_updated_event'),
        });
      }

      // Purchase documents
      purchaseDocuments?.forEach(doc => {
        allEvents.push({
          id: `purchase-doc-${doc.id}`,
          type: 'purchase_document',
          date: doc.created_at,
          description: t('purchase_document_created'),
          amount: doc.total_ttc,
          reference: doc.invoice_number || '-',
          status: doc.status,
          details: `${t('payment_status')}: ${t(doc.payment_status)}`,
        });
      });

      // Purchase lines
      purchaseLines?.forEach(line => {
        allEvents.push({
          id: `purchase-line-${line.id}`,
          type: 'purchase_line',
          date: line.created_at,
          description: `${t('product')}: ${line.name}`,
          amount: line.line_total_ttc,
          details: `${t('quantity')}: ${line.quantity} | ${t('unit_price')}: ${line.unit_price_ht.toFixed(3)} TND`,
        });
      });

      // Sort by date descending
      allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setEvents(allEvents);
    } catch (error) {
      console.error('Error fetching supplier history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'purchase_document':
        return <FileText className="h-4 w-4" />;
      case 'purchase_line':
        return <Package className="h-4 w-4" />;
      case 'supplier_created':
        return <Plus className="h-4 w-4" />;
      case 'supplier_updated':
        return <Edit className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'purchase_document':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'purchase_line':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
      case 'supplier_created':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'supplier_updated':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  const getSupplierName = () => {
    if (!supplier) return '';
    if (supplier.company_name) return supplier.company_name;
    return `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim();
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'PPpp', { locale: getDateLocale() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {t('supplier_history')} - {getSupplierName()}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('no_history')}
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${getEventBadgeColor(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{event.description}</p>
                        {event.amount !== undefined && (
                          <span className="font-mono text-sm font-semibold">
                            {event.amount.toFixed(3)} TND
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatEventDate(event.date)}
                      </div>
                      {event.reference && (
                        <p className="text-sm text-muted-foreground">
                          {t('reference')}: {event.reference}
                        </p>
                      )}
                      {event.details && (
                        <p className="text-sm text-muted-foreground">
                          {event.details}
                        </p>
                      )}
                      {event.status && (
                        <Badge variant="outline" className="text-xs">
                          {t(event.status)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {index < events.length - 1 && (
                    <Separator className="mt-4" />
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
