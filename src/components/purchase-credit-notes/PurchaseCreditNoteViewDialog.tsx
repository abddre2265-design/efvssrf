import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Truck, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseCreditNote, PurchaseCreditNoteLine } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface PurchaseCreditNoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string | null;
}

export const PurchaseCreditNoteViewDialog: React.FC<PurchaseCreditNoteViewDialogProps> = ({
  open,
  onOpenChange,
  creditNoteId,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [creditNote, setCreditNote] = useState<PurchaseCreditNote | null>(null);
  const [lines, setLines] = useState<PurchaseCreditNoteLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!creditNoteId || !open) return;
      setIsLoading(true);
      try {
        const [cnRes, linesRes] = await Promise.all([
          supabase
            .from('purchase_credit_notes')
            .select('*, supplier:suppliers(id, supplier_type, first_name, last_name, company_name), purchase_document:purchase_documents(id, invoice_number)')
            .eq('id', creditNoteId)
            .single(),
          supabase
            .from('purchase_credit_note_lines')
            .select('*')
            .eq('credit_note_id', creditNoteId)
            .order('line_order', { ascending: true }),
        ]);

        if (cnRes.data) {
          setCreditNote(cnRes.data as unknown as PurchaseCreditNote);
        }
        setLines((linesRes.data || []) as unknown as PurchaseCreditNoteLine[]);
      } catch (error) {
        console.error('Error fetching purchase credit note:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [creditNoteId, open]);

  const getSupplierName = () => {
    if (!creditNote?.supplier) return '-';
    if (creditNote.supplier.company_name) return creditNote.supplier.company_name;
    return `${creditNote.supplier.first_name || ''} ${creditNote.supplier.last_name || ''}`.trim() || '-';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      created: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
      draft: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
      validated: 'bg-green-500/10 text-green-600 border-green-500/30',
      validated_partial: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    };
    const labels: Record<string, string> = {
      created: t('status_created') || 'Créé',
      draft: t('status_draft') || 'Brouillon',
      validated: t('status_validated') || 'Validé',
      validated_partial: t('status_validated_partial') || 'Validé partiel',
    };
    return <Badge variant="outline" className={variants[status] || ''}>{labels[status] || status}</Badge>;
  };

  if (!creditNote || isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[85vh] p-0">
          <div className="p-6 space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const originalTotalHt = lines.reduce((s, l) => s + l.original_line_total_ht, 0);
  const originalTotalTtc = lines.reduce((s, l) => s + l.original_line_total_ttc, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] max-h-[85vh] p-0 overflow-hidden grid grid-rows-[auto,1fr]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('purchase_credit_note_details') || 'Détails avoir achat'}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">{creditNote.credit_note_number}</Badge>
              {getStatusBadge(creditNote.status)}
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          <div className="p-6 space-y-6">
            {/* General info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <FileText className="h-4 w-4" />
                  {t('credit_note_info')}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('type')}:</span>
                    <p className="font-medium">{t(creditNote.credit_note_type === 'commercial_price' ? 'credit_note_commercial_price' : 'credit_note_product')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('method')}:</span>
                    <p className="font-medium">{creditNote.credit_note_method === 'lines' ? t('mode_line_discount') : t('mode_total_discount')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('date')}:</span>
                    <p className="font-medium">{format(new Date(creditNote.credit_note_date), 'PPP', { locale: getDateLocale() })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('purchase_invoice') || 'Facture achat'}:</span>
                    <p className="font-mono font-medium">{creditNote.purchase_document?.invoice_number || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Truck className="h-4 w-4" />
                  {t('supplier') || 'Fournisseur'}
                </div>
                <p className="font-semibold">{getSupplierName()}</p>
              </div>
            </div>

            <Separator />

            {/* Line details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Package className="h-4 w-4" />
                {t('invoice_lines')} ({lines.length})
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-start p-3 font-medium">{t('product')}</th>
                      <th className="text-end p-3 font-medium">{t('original_totals')} HT</th>
                      <th className="text-center p-3 font-medium">{t('vat')}</th>
                      <th className="text-end p-3 font-medium">{t('original_totals')} TTC</th>
                      <th className="text-end p-3 font-medium">{t('discount_ht')}</th>
                      <th className="text-end p-3 font-medium">{t('new_total_ht')}</th>
                      <th className="text-end p-3 font-medium">{t('new_total_ttc')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={line.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="p-3">
                          <div className="font-medium">{line.product_name || '-'}</div>
                          {line.product_reference && <div className="text-xs text-muted-foreground font-mono">{line.product_reference}</div>}
                        </td>
                        <td className="text-end p-3 font-mono">{formatCurrency(line.original_line_total_ht, 'TND')}</td>
                        <td className="text-center p-3">{line.vat_rate}%</td>
                        <td className="text-end p-3 font-mono">{formatCurrency(line.original_line_total_ttc, 'TND')}</td>
                        <td className="text-end p-3 font-mono text-destructive">-{formatCurrency(line.discount_ht, 'TND')}</td>
                        <td className="text-end p-3 font-mono font-medium">{formatCurrency(line.new_line_total_ht, 'TND')}</td>
                        <td className="text-end p-3 font-mono font-medium">{formatCurrency(line.new_line_total_ttc, 'TND')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Totals before/after */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 space-y-2 bg-muted/20">
                <h4 className="font-semibold text-sm">{t('original_totals')}</h4>
                <Separator />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('subtotal_ht')}</span>
                    <span className="font-mono">{formatCurrency(originalTotalHt, 'TND')}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{t('total_ttc')}</span>
                    <span className="font-mono">{formatCurrency(originalTotalTtc, 'TND')}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>{t('net_payable')}</span>
                    <span className="font-mono text-primary">{formatCurrency(creditNote.original_net_payable, 'TND')}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-2 bg-primary/5 border-primary/20">
                <h4 className="font-semibold text-sm">{t('new_totals')}</h4>
                <Separator />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('new_total_ht')}</span>
                    <span className="font-mono">{formatCurrency(creditNote.subtotal_ht, 'TND')}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{t('new_total_ttc')}</span>
                    <span className="font-mono">{formatCurrency(creditNote.total_ttc, 'TND')}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base">
                    <span>{t('new_net_payable')}</span>
                    <span className="font-mono text-primary">{formatCurrency(creditNote.new_net_payable, 'TND')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reason / Notes */}
            {creditNote.reason && (
              <div className="p-4 rounded-lg bg-muted/30 border">
                <div className="font-medium mb-1">{t('reason') || 'Motif'}:</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{creditNote.reason}</p>
              </div>
            )}
            {creditNote.notes && (
              <div className="p-4 rounded-lg bg-muted/30 border">
                <div className="font-medium mb-1">{t('notes')}:</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{creditNote.notes}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
