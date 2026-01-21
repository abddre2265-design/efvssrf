import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Product } from './types';
import { Loader2, Package, FileText, ShoppingCart, RotateCcw, TrendingUp, TrendingDown, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';

interface ProductHistoryDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEntry {
  id: string;
  type: 'stock_movement' | 'invoice' | 'credit_note' | 'purchase';
  date: string;
  description: string;
  details: string;
  quantity?: number;
  movement_type?: 'add' | 'remove';
  document_number?: string;
  amount?: number;
}

export const ProductHistoryDialog: React.FC<ProductHistoryDialogProps> = ({
  product,
  open,
  onOpenChange,
}) => {
  const { t, language } = useLanguage();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getLocale = () => {
    switch (language) {
      case 'fr': return fr;
      case 'ar': return ar;
      default: return enUS;
    }
  };

  useEffect(() => {
    if (open && product) {
      fetchHistory();
    }
  }, [open, product]);

  const fetchHistory = async () => {
    if (!product) return;
    setIsLoading(true);
    
    try {
      const entries: HistoryEntry[] = [];

      // Fetch stock movements
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      stockMovements?.forEach(sm => {
        entries.push({
          id: `sm-${sm.id}`,
          type: 'stock_movement',
          date: sm.created_at,
          description: t(sm.movement_type === 'add' ? 'stockAdded' : 'stockRemoved'),
          details: `${sm.reason_category} - ${sm.reason_detail}`,
          quantity: sm.quantity,
          movement_type: sm.movement_type as 'add' | 'remove',
        });
      });

      // Fetch invoice lines with invoice info
      const { data: invoiceLines } = await supabase
        .from('invoice_lines')
        .select(`
          id,
          quantity,
          unit_price_ht,
          line_total_ttc,
          created_at,
          invoice:invoices (
            invoice_number,
            invoice_date,
            status,
            client:clients (
              first_name,
              last_name,
              company_name
            )
          )
        `)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      invoiceLines?.forEach(il => {
        const invoice = il.invoice as any;
        const client = invoice?.client;
        const clientName = client?.company_name || `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || t('unknownClient');
        
        entries.push({
          id: `inv-${il.id}`,
          type: 'invoice',
          date: il.created_at,
          description: t('soldInInvoice'),
          details: `${invoice?.invoice_number} - ${clientName}`,
          quantity: il.quantity,
          movement_type: 'remove',
          document_number: invoice?.invoice_number,
          amount: il.line_total_ttc,
        });
      });

      // Fetch credit note lines with credit note info
      const { data: creditNoteLines } = await supabase
        .from('credit_note_lines')
        .select(`
          id,
          quantity,
          line_total_ttc,
          stock_restored,
          created_at,
          credit_note:credit_notes (
            credit_note_number,
            credit_note_date,
            status,
            credit_note_type
          )
        `)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      creditNoteLines?.forEach(cnl => {
        const creditNote = cnl.credit_note as any;
        entries.push({
          id: `cn-${cnl.id}`,
          type: 'credit_note',
          date: cnl.created_at,
          description: cnl.stock_restored ? t('returnedFromCreditNote') : t('creditNoteCreated'),
          details: creditNote?.credit_note_number || '',
          quantity: cnl.quantity,
          movement_type: cnl.stock_restored ? 'add' : undefined,
          document_number: creditNote?.credit_note_number,
          amount: cnl.line_total_ttc,
        });
      });

      // Fetch purchase lines with purchase document info
      const { data: purchaseLines } = await supabase
        .from('purchase_lines')
        .select(`
          id,
          quantity,
          line_total_ttc,
          created_at,
          purchase_document:purchase_documents (
            invoice_number,
            invoice_date,
            status,
            supplier:suppliers (
              first_name,
              last_name,
              company_name
            )
          )
        `)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      purchaseLines?.forEach(pl => {
        const purchaseDoc = pl.purchase_document as any;
        const supplier = purchaseDoc?.supplier;
        const supplierName = supplier?.company_name || `${supplier?.first_name || ''} ${supplier?.last_name || ''}`.trim() || t('unknownSupplier');
        
        entries.push({
          id: `pur-${pl.id}`,
          type: 'purchase',
          date: pl.created_at,
          description: t('purchasedFromSupplier'),
          details: `${purchaseDoc?.invoice_number || t('noInvoiceNumber')} - ${supplierName}`,
          quantity: pl.quantity,
          movement_type: 'add',
          document_number: purchaseDoc?.invoice_number,
          amount: pl.line_total_ttc,
        });
      });

      // Sort all entries by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setHistory(entries);
    } catch (error) {
      console.error('Error fetching product history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'stock_movement': return <Package className="h-4 w-4" />;
      case 'invoice': return <FileText className="h-4 w-4" />;
      case 'credit_note': return <RotateCcw className="h-4 w-4" />;
      case 'purchase': return <ShoppingCart className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'stock_movement':
        return <Badge variant="outline" className="text-primary border-primary">{t('stockMovement')}</Badge>;
      case 'invoice':
        return <Badge variant="outline" className="text-accent-foreground border-accent">{t('invoice')}</Badge>;
      case 'credit_note':
        return <Badge variant="outline" className="text-destructive border-destructive">{t('creditNote')}</Badge>;
      case 'purchase':
        return <Badge variant="secondary">{t('purchase')}</Badge>;
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: format(date, 'dd MMM yyyy', { locale: getLocale() }),
      time: format(date, 'HH:mm:ss', { locale: getLocale() }),
    };
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t('productHistory')} - {product?.name}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50" />
              <p>{t('noHistoryFound')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => {
                const { date, time } = formatDateTime(entry.date);
                
                return (
                  <React.Fragment key={entry.id}>
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0 mt-1 p-2 rounded-full bg-background border border-border">
                        {getTypeIcon(entry.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {getTypeBadge(entry.type)}
                          {entry.movement_type && (
                            <Badge 
                              className={entry.movement_type === 'add' 
                                ? 'bg-green-500/20 text-green-600 border-green-500/50' 
                                : 'bg-red-500/20 text-red-600 border-red-500/50'
                              }
                            >
                              {entry.movement_type === 'add' ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {entry.quantity && `${entry.movement_type === 'add' ? '+' : '-'}${entry.quantity}`}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="font-medium text-sm">{entry.description}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.details}</p>
                        
                        {entry.amount !== undefined && (
                          <p className="text-xs font-mono mt-1 text-muted-foreground">
                            {formatAmount(entry.amount)} TND
                          </p>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                      </div>
                    </div>
                    {index < history.length - 1 && <Separator className="opacity-50" />}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
