import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  User, 
  Package,
  Banknote,
  RotateCcw,
  Receipt,
  CheckCircle,
  XCircle,
  AlertCircle,
  Unlock,
  History,
  ArrowUpRight,
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { CreditNote, CreditNoteLine, CreditNoteStatus, CreditNoteType } from './types';
import { formatCurrency } from '@/components/invoices/types';
import { CreditUnblockDialog } from './CreditUnblockDialog';
import { CreditNotePrintDialog } from './CreditNotePrintDialog';

interface HistoryEntry {
  id: string;
  date: string;
  type: 'creation' | 'unblock' | 'invoice_link';
  description: string;
  amount?: number;
  details?: string;
}

interface CreditNoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string | null;
  onRefresh?: () => void;
}

interface CreditNoteDetails extends CreditNote {
  client: {
    id: string;
    client_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  invoice: {
    id: string;
    invoice_number: string;
  } | null;
  lines: (CreditNoteLine & {
    product: {
      id: string;
      name: string;
      reference: string | null;
    } | null;
  })[];
}

export const CreditNoteViewDialog: React.FC<CreditNoteViewDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  onRefresh,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [creditNote, setCreditNote] = useState<CreditNoteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string>('details');

  const fetchCreditNote = async () => {
    if (!creditNoteId) return;

    setIsLoading(true);
    try {
      const { data: cnData, error: cnError } = await supabase
        .from('credit_notes')
        .select(`
          *,
          client:clients(id, client_type, first_name, last_name, company_name, email, phone),
          invoice:invoices(id, invoice_number)
        `)
        .eq('id', creditNoteId)
        .single();

      if (cnError) throw cnError;

      const { data: linesData, error: linesError } = await supabase
        .from('credit_note_lines')
        .select(`
          *,
          product:products(id, name, reference)
        `)
        .eq('credit_note_id', creditNoteId)
        .order('line_order', { ascending: true });

      if (linesError) throw linesError;

      setCreditNote({
        ...cnData,
        lines: linesData || [],
      } as CreditNoteDetails);

      // Fetch history - client account movements related to this credit note
      const { data: movements, error: movError } = await supabase
        .from('client_account_movements')
        .select('*')
        .eq('source_id', creditNoteId)
        .order('created_at', { ascending: true });

      if (!movError && movements) {
        const entries: HistoryEntry[] = [];
        
        // Creation entry
        entries.push({
          id: 'creation',
          date: cnData.created_at,
          type: 'creation',
          description: t('credit_note_created'),
          amount: cnData.net_amount,
          details: `${t('credit_note_number')}: ${cnData.credit_note_number}`,
        });

        // Link to invoice
        if (cnData.invoice_id) {
          entries.push({
            id: 'invoice_link',
            date: cnData.created_at,
            type: 'invoice_link',
            description: t('linked_to_invoice'),
            details: cnData.invoice?.invoice_number || '',
          });
        }

        // Unblock movements
        movements.forEach((mov: any) => {
          if (mov.source_type === 'credit_note_unblock') {
            entries.push({
              id: mov.id,
              date: mov.created_at,
              type: 'unblock',
              description: t('unblock_operation'),
              amount: mov.amount,
              details: mov.notes || '',
            });
          } else if (mov.source_type === 'credit_note') {
            entries.push({
              id: mov.id,
              date: mov.created_at,
              type: 'unblock',
              description: t('credit_available'),
              amount: mov.amount,
              details: t('immediate_credit'),
            });
          }
        });

        setHistoryEntries(entries);
      }
    } catch (error) {
      console.error('Error fetching credit note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    if (open && creditNoteId) {
      fetchCreditNote();
      setActiveTab('details');
    }
  }, [creditNoteId, open]);

  const handleUnblockSuccess = () => {
    fetchCreditNote();
    onRefresh?.();
  };

  const getClientName = () => {
    if (!creditNote?.client) return '-';
    if (creditNote.client.company_name) return creditNote.client.company_name;
    return `${creditNote.client.first_name || ''} ${creditNote.client.last_name || ''}`.trim() || '-';
  };

  const getStatusBadge = (status: CreditNoteStatus) => {
    const variants: Record<CreditNoteStatus, { className: string; icon: React.ReactNode }> = {
      draft: { className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: null },
      validated: { className: 'bg-green-500/10 text-green-600 border-green-500/30', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      cancelled: { className: 'bg-red-500/10 text-red-600 border-red-500/30', icon: <XCircle className="h-3 w-3 mr-1" /> },
    };
    const config = variants[status];
    return (
      <Badge variant="outline" className={`${config.className} flex items-center`}>
        {config.icon}
        {t(`status_${status}`)}
      </Badge>
    );
  };

  const getTypeBadge = (type: CreditNoteType) => {
    const config = type === 'financial' 
      ? { icon: <Banknote className="h-3 w-3 mr-1" />, label: t('financial'), className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' }
      : { icon: <RotateCcw className="h-3 w-3 mr-1" />, label: t('product_return'), className: 'bg-purple-500/10 text-purple-600 border-purple-500/30' };
    
    return (
      <Badge variant="outline" className={`${config.className} flex items-center`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const renderDetailsTab = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6"
    >
      {/* Credit Note Header */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Receipt className="h-4 w-4" />
            {t('credit_note_info')}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t('credit_note_number')}:</span>
              <p className="font-mono font-semibold">{creditNote?.credit_note_number}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('date')}:</span>
              <p className="font-medium">
                {creditNote && format(new Date(creditNote.credit_note_date), 'PPP', { locale: getDateLocale() })}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('invoice')}:</span>
              <p className="font-mono">{creditNote?.invoice?.invoice_number || '-'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center gap-2 text-primary font-medium">
            <User className="h-4 w-4" />
            {t('client_info')}
          </div>
          {creditNote?.client && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-base">{getClientName()}</p>
              {creditNote.client.email && (
                <p className="text-muted-foreground">{creditNote.client.email}</p>
              )}
              {creditNote.client.phone && (
                <p className="text-muted-foreground">{creditNote.client.phone}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {creditNote?.reason && (
        <div className="p-4 rounded-lg bg-muted/30 border">
          <div className="font-medium mb-2">{t('reason')}:</div>
          <p className="text-sm text-muted-foreground">{creditNote.reason}</p>
        </div>
      )}

      <Separator />

      {/* Credit Note Lines */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Package className="h-4 w-4" />
          {t('lines')} ({creditNote?.lines.length || 0})
        </div>
        
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start p-3 font-medium">{t('description')}</th>
                <th className="text-center p-3 font-medium">{t('quantity')}</th>
                <th className="text-end p-3 font-medium">{t('unit_price_ht')}</th>
                <th className="text-center p-3 font-medium">{t('vat')}</th>
                <th className="text-end p-3 font-medium">{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {creditNote?.lines.map((line, index) => (
                <tr key={line.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{line.product?.name || line.description || '-'}</p>
                      {line.product?.reference && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {line.product.reference}
                        </p>
                      )}
                      {line.return_reason && (
                        <p className="text-xs text-orange-600 mt-1">
                          {t(line.return_reason)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="text-center p-3">{line.quantity}</td>
                  <td className="text-end p-3 font-mono">
                    {formatCurrency(line.unit_price_ht, creditNote?.currency || 'TND')}
                  </td>
                  <td className="text-center p-3">{line.vat_rate}%</td>
                  <td className="text-end p-3 font-mono font-medium">
                    {formatCurrency(line.line_total_ttc, creditNote?.currency || 'TND')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-80 space-y-2 p-4 rounded-lg bg-muted/30 border">
          <div className="flex items-center gap-2 text-primary font-medium mb-3">
            <Banknote className="h-4 w-4" />
            {t('totals')}
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
            <span className="font-mono">{formatCurrency(creditNote?.subtotal_ht || 0, creditNote?.currency || 'TND')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('total_vat')}:</span>
            <span className="font-mono">{formatCurrency(creditNote?.total_vat || 0, creditNote?.currency || 'TND')}</span>
          </div>
          
          <div className="flex justify-between pt-3 border-t border-primary/30 text-lg font-semibold">
            <span>{t('net_amount')}:</span>
            <span className="font-mono text-primary">
              {formatCurrency(creditNote?.net_amount || 0, creditNote?.currency || 'TND')}
            </span>
          </div>
        </div>
      </div>

      {/* Credit Status */}
      {creditNote && creditNote.credit_generated > 0 && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">{t('client_credit_status')}</div>
            {creditNote.credit_blocked > 0 && creditNote.credit_note_type === 'product_return' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                onClick={() => setUnblockDialogOpen(true)}
              >
                <Unlock className="h-4 w-4" />
                {t('receive_products')}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('credit_generated')}:</span>
              <p className="font-mono font-semibold">{formatCurrency(creditNote.credit_generated, creditNote.currency)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('credit_available')}:</span>
              <p className="font-mono font-semibold text-green-600">{formatCurrency(creditNote.credit_available, creditNote.currency)}</p>
            </div>
            {creditNote.credit_blocked > 0 && (
              <div>
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-orange-500" />
                  {t('credit_blocked')}:
                </span>
                <p className="font-mono font-semibold text-orange-600">{formatCurrency(creditNote.credit_blocked, creditNote.currency)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {creditNote?.notes && (
        <>
          <Separator />
          <div className="space-y-2 p-4 rounded-lg bg-muted/30 border">
            <div className="font-medium">{t('notes')}:</div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{creditNote.notes}</p>
          </div>
        </>
      )}
    </motion.div>
  );

  const renderHistoryTab = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-4"
    >
      <div className="flex items-center gap-2 text-primary font-medium mb-4">
        <History className="h-4 w-4" />
        {t('credit_note_history')}
      </div>

      {historyEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('no_history')}
        </div>
      ) : (
        <div className="space-y-3">
          {historyEntries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-lg border bg-muted/20 relative"
            >
              {index < historyEntries.length - 1 && (
                <div className="absolute left-7 top-14 w-0.5 h-6 bg-muted-foreground/20" />
              )}
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  entry.type === 'creation' ? 'bg-green-500/10' :
                  entry.type === 'unblock' ? 'bg-blue-500/10' :
                  'bg-muted'
                }`}>
                  {entry.type === 'creation' && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {entry.type === 'unblock' && <Unlock className="h-4 w-4 text-blue-600" />}
                  {entry.type === 'invoice_link' && <Receipt className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{entry.description}</p>
                    {entry.amount && (
                      <Badge variant="outline" className="font-mono text-green-600">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        {formatCurrency(entry.amount, creditNote?.currency || 'TND')}
                      </Badge>
                    )}
                  </div>
                  {entry.details && (
                    <p className="text-sm text-muted-foreground mt-1">{entry.details}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(entry.date), 'PPp', { locale: getDateLocale() })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl h-[85vh] max-h-[85vh] p-0 overflow-hidden grid grid-rows-[auto,auto,1fr]" 
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-primary" />
              {t('credit_note_details')}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setPrintDialogOpen(true)}
              >
                <Printer className="h-4 w-4" />
                {t('print') || 'Imprimer'}
              </Button>
              {creditNote && getTypeBadge(creditNote.credit_note_type)}
              {creditNote && getStatusBadge(creditNote.status)}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="px-6 pt-2 border-b">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-fit">
              <TabsTrigger value="details" className="gap-2">
                <FileText className="h-4 w-4" />
                {t('details')}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                {t('history')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="min-h-0">
          {isLoading ? (
            <div className="p-6 space-y-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : creditNote ? (
            activeTab === 'details' ? renderDetailsTab() : renderHistoryTab()
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              {t('no_data')}
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      {/* Credit Unblock Dialog */}
      {creditNote && creditNote.credit_blocked > 0 && (
        <CreditUnblockDialog
          open={unblockDialogOpen}
          onOpenChange={setUnblockDialogOpen}
          creditNoteId={creditNote.id}
          creditNoteNumber={creditNote.credit_note_number}
          creditBlocked={creditNote.credit_blocked}
          currency={creditNote.currency}
          clientId={creditNote.client_id}
          organizationId={creditNote.organization_id}
          onSuccess={handleUnblockSuccess}
        />
      )}

      {/* Print Dialog */}
      <CreditNotePrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        creditNoteId={creditNoteId}
      />
    </Dialog>
  );
};
