import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { SupplierCreditNote, SupplierCreditNoteLine, SupplierCreditNoteStatus, SupplierCreditNoteType } from './types';
import { formatCurrency } from '@/components/invoices/types';
import { SupplierCreditNoteReturnStockDialog } from './SupplierCreditNoteReturnStockDialog';

interface SupplierCreditNoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string | null;
  onRefresh?: () => void;
}

interface SupplierCreditNoteDetails extends SupplierCreditNote {
  supplier: {
    id: string;
    supplier_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  purchase_document: {
    id: string;
    invoice_number: string | null;
  } | null;
  lines: (SupplierCreditNoteLine & {
    product: {
      id: string;
      name: string;
      reference: string | null;
    } | null;
  })[];
}

export const SupplierCreditNoteViewDialog: React.FC<SupplierCreditNoteViewDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
  onRefresh,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [creditNote, setCreditNote] = useState<SupplierCreditNoteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [returnStockDialogOpen, setReturnStockDialogOpen] = useState(false);

  const fetchCreditNote = async () => {
    if (!creditNoteId) return;

    setIsLoading(true);
    try {
      const { data: cnData, error: cnError } = await supabase
        .from('supplier_credit_notes')
        .select(`
          *,
          supplier:suppliers(id, supplier_type, first_name, last_name, company_name, email, phone),
          purchase_document:purchase_documents(id, invoice_number)
        `)
        .eq('id', creditNoteId)
        .single();

      if (cnError) throw cnError;

      const { data: linesData, error: linesError } = await supabase
        .from('supplier_credit_note_lines')
        .select(`
          *,
          product:products(id, name, reference)
        `)
        .eq('supplier_credit_note_id', creditNoteId)
        .order('line_order', { ascending: true });

      if (linesError) throw linesError;

      setCreditNote({
        ...cnData,
        lines: linesData || [],
      } as SupplierCreditNoteDetails);
    } catch (error) {
      console.error('Error fetching supplier credit note:', error);
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
    }
  }, [creditNoteId, open]);

  const handleReturnStockSuccess = () => {
    fetchCreditNote();
    onRefresh?.();
  };

  const getSupplierName = () => {
    if (!creditNote?.supplier) return '-';
    if (creditNote.supplier.company_name) return creditNote.supplier.company_name;
    return `${creditNote.supplier.first_name || ''} ${creditNote.supplier.last_name || ''}`.trim() || '-';
  };

  const getStatusBadge = (status: SupplierCreditNoteStatus) => {
    const variants: Record<SupplierCreditNoteStatus, { className: string; icon: React.ReactNode }> = {
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

  const getTypeBadge = (type: SupplierCreditNoteType) => {
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

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('supplier_credit_note')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!creditNote) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {creditNote.credit_note_number}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {getTypeBadge(creditNote.credit_note_type)}
                {getStatusBadge(creditNote.status)}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-6"
            >
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Receipt className="h-4 w-4" />
                    {t('credit_note_info')}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('credit_note_number')}:</span>
                      <p className="font-mono font-semibold">{creditNote.credit_note_number}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('date')}:</span>
                      <p className="font-medium">
                        {format(new Date(creditNote.credit_note_date), 'PPP', { locale: getDateLocale() })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('purchase_document')}:</span>
                      <p className="font-mono">{creditNote.purchase_document?.invoice_number || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <User className="h-4 w-4" />
                    {t('supplier_info')}
                  </div>
                  {creditNote.supplier && (
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-base">{getSupplierName()}</p>
                      {creditNote.supplier.email && (
                        <p className="text-muted-foreground">{creditNote.supplier.email}</p>
                      )}
                      {creditNote.supplier.phone && (
                        <p className="text-muted-foreground">{creditNote.supplier.phone}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {creditNote.reason && (
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="font-medium mb-2">{t('reason')}:</div>
                  <p className="text-sm text-muted-foreground">{creditNote.reason}</p>
                </div>
              )}

              <Separator />

              {/* Lines */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Package className="h-4 w-4" />
                  {t('lines')} ({creditNote.lines.length})
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
                      {creditNote.lines.map((line, index) => (
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
                            {formatCurrency(line.unit_price_ht, creditNote.currency)}
                          </td>
                          <td className="text-center p-3">{line.vat_rate}%</td>
                          <td className="text-end p-3 font-mono font-medium">
                            {formatCurrency(line.line_total_ttc, creditNote.currency)}
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
                    <span className="font-mono">{formatCurrency(creditNote.subtotal_ht, creditNote.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('total_vat')}:</span>
                    <span className="font-mono">{formatCurrency(creditNote.total_vat, creditNote.currency)}</span>
                  </div>
                  
                  <div className="flex justify-between pt-3 border-t border-primary/30 text-lg font-semibold">
                    <span>{t('net_amount')}:</span>
                    <span className="font-mono text-primary">
                      {formatCurrency(creditNote.net_amount, creditNote.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Credit Status */}
              {creditNote.credit_generated > 0 && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium">{t('supplier_credit_status')}</div>
                    {creditNote.credit_blocked > 0 && creditNote.credit_note_type === 'product_return' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                        onClick={() => setReturnStockDialogOpen(true)}
                      >
                        <Unlock className="h-4 w-4" />
                        {t('return_stock')}
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
              {creditNote.notes && (
                <>
                  <Separator />
                  <div className="space-y-2 p-4 rounded-lg bg-muted/30 border">
                    <div className="font-medium">{t('notes')}:</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{creditNote.notes}</p>
                  </div>
                </>
              )}
            </motion.div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Return Stock Dialog */}
      {creditNote && (
        <SupplierCreditNoteReturnStockDialog
          open={returnStockDialogOpen}
          onOpenChange={setReturnStockDialogOpen}
          creditNoteId={creditNote.id}
          creditNoteNumber={creditNote.credit_note_number}
          creditBlocked={creditNote.credit_blocked}
          currency={creditNote.currency}
          onSuccess={handleReturnStockSuccess}
        />
      )}
    </>
  );
};
