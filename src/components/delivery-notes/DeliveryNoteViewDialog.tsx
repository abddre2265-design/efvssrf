import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Printer, FileText, Package } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DeliveryNote, DeliveryNoteLine } from './types';
import { DeliveryNotePrintDialog } from './DeliveryNotePrintDialog';

interface DeliveryNoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNoteId: string | null;
}

interface DeliveryNoteDetails extends DeliveryNote {
  lines: DeliveryNoteLine[];
}

export const DeliveryNoteViewDialog: React.FC<DeliveryNoteViewDialogProps> = ({
  open,
  onOpenChange,
  deliveryNoteId,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNoteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    const fetchDeliveryNote = async () => {
      if (!deliveryNoteId) return;
      setIsLoading(true);

      try {
        // Fetch delivery note with client and invoice
        const { data: noteData, error: noteError } = await supabase
          .from('delivery_notes')
          .select(`
            *,
            client:clients(id, client_type, first_name, last_name, company_name, identifier_type, identifier_value, address, governorate, phone, email),
            invoice:invoices(id, invoice_number)
          `)
          .eq('id', deliveryNoteId)
          .single();

        if (noteError) throw noteError;

        // Fetch lines with products
        const { data: linesData, error: linesError } = await supabase
          .from('delivery_note_lines')
          .select(`
            *,
            product:products(id, name, reference, ean)
          `)
          .eq('delivery_note_id', deliveryNoteId)
          .order('line_order', { ascending: true });

        if (linesError) throw linesError;

        setDeliveryNote({
          ...noteData,
          lines: linesData || [],
        } as DeliveryNoteDetails);
      } catch (error) {
        console.error('Error fetching delivery note:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open && deliveryNoteId) {
      fetchDeliveryNote();
    }
  }, [open, deliveryNoteId]);

  const getClientName = (): string => {
    if (!deliveryNote?.client) return '-';
    const client = deliveryNote.client as any;
    if (client.client_type === 'business_local' || client.client_type === 'foreign') {
      return client.company_name || '-';
    }
    return `${client.first_name || ''} ${client.last_name || ''}`.trim() || '-';
  };

  const formatCurrency = (amount: number, currency: string = 'TND'): string => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Package className="h-5 w-5 text-primary" />
              {t('delivery_note_details')}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : deliveryNote ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {deliveryNote.delivery_note_number}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('date')}: {format(new Date(deliveryNote.delivery_date), 'PPP', { locale: getDateLocale() })}
                  </p>
                </div>
                <div className={`space-y-2 ${isRTL ? 'text-left' : 'text-right'}`}>
                  <div className="flex items-center gap-2 justify-end">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-mono text-primary">
                      {deliveryNote.invoice?.invoice_number}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('linked_invoice')}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Client Info */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2">{t('client')}</h4>
                <p className="text-lg font-medium">{getClientName()}</p>
                {deliveryNote.client && (
                  <p className="text-sm text-muted-foreground">
                    {(deliveryNote.client as any).address}
                  </p>
                )}
              </div>

              {/* Lines Table */}
              <div>
                <h4 className="font-semibold mb-3">{t('products')}</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('product')}</TableHead>
                        <TableHead>{t('reference')}</TableHead>
                        <TableHead className="text-center">{t('quantity')}</TableHead>
                        <TableHead className="text-right">{t('unit_price_ht')}</TableHead>
                        <TableHead className="text-right">{t('total_ht')}</TableHead>
                        <TableHead className="text-right">{t('total_ttc')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveryNote.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">
                            {line.product?.name || line.description || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {line.product?.reference || '-'}
                          </TableCell>
                          <TableCell className="text-center">{line.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(line.unit_price_ht, deliveryNote.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(line.line_total_ht, deliveryNote.currency)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(line.line_total_ttc, deliveryNote.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              {/* Totals - Only TTC, no stamp duty or net payable */}
              <div className="flex justify-end">
                <div className="bg-primary/10 rounded-lg p-4 min-w-[300px]">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('subtotal_ht')}</span>
                      <span>{formatCurrency(deliveryNote.subtotal_ht, deliveryNote.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t('total_vat')}</span>
                      <span>{formatCurrency(deliveryNote.total_vat, deliveryNote.currency)}</span>
                    </div>
                    {deliveryNote.total_discount > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>{t('total_discount')}</span>
                        <span>-{formatCurrency(deliveryNote.total_discount, deliveryNote.currency)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>{t('total_ttc')}</span>
                      <span className="text-primary">
                        {formatCurrency(deliveryNote.total_ttc, deliveryNote.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {deliveryNote.notes && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{t('notes')}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {deliveryNote.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPrintDialogOpen(true)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {t('print')}
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              {t('delivery_note_not_found')}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeliveryNotePrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        deliveryNoteId={deliveryNoteId}
      />
    </>
  );
};

export default DeliveryNoteViewDialog;
