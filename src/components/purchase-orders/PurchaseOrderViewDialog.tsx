import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PurchaseOrder } from './types';

interface Props {
  order: PurchaseOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PurchaseOrderViewDialog: React.FC<Props> = ({ order, open, onOpenChange }) => {
  const { t } = useLanguage();
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', order.id)
        .order('line_order');
      setLines(data || []);
    })();
  }, [open, order.id]);

  const supplierName = order.supplier
    ? order.supplier.company_name || `${order.supplier.first_name || ''} ${order.supplier.last_name || ''}`.trim()
    : '-';

  const statusMap: Record<string, string> = {
    draft: t('draft') || 'Brouillon',
    sent: t('sent') || 'Envoyé',
    confirmed: t('confirmed') || 'Confirmé',
    cancelled: t('cancelled') || 'Annulé',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {order.order_number}
            <Badge variant={order.status === 'cancelled' ? 'destructive' : 'secondary'}>
              {statusMap[order.status] || order.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">{t('supplier') || 'Fournisseur'}:</span> <span className="font-medium">{supplierName}</span></div>
          <div><span className="text-muted-foreground">{t('order_date') || 'Date'}:</span> <span className="font-medium">{new Date(order.order_date).toLocaleDateString('fr-FR')}</span></div>
          {order.expected_delivery_date && (
            <div><span className="text-muted-foreground">{t('expected_delivery_date') || 'Livraison prévue'}:</span> <span className="font-medium">{new Date(order.expected_delivery_date).toLocaleDateString('fr-FR')}</span></div>
          )}
          <div><span className="text-muted-foreground">{t('currency') || 'Devise'}:</span> <span className="font-medium">{order.currency}</span></div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('designation') || 'Désignation'}</TableHead>
              <TableHead>{t('reference') || 'Réf'}</TableHead>
              <TableHead className="text-right">{t('quantity') || 'Qté'}</TableHead>
              <TableHead className="text-right">{t('unit_price_ht') || 'P.U HT'}</TableHead>
              <TableHead className="text-right">{t('vat') || 'TVA %'}</TableHead>
              <TableHead className="text-right">{t('total_ttc') || 'Total TTC'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map(line => (
              <TableRow key={line.id}>
                <TableCell>{line.name}</TableCell>
                <TableCell>{line.reference || '-'}</TableCell>
                <TableCell className="text-right">{line.quantity}</TableCell>
                <TableCell className="text-right">{Number(line.unit_price_ht).toFixed(3)}</TableCell>
                <TableCell className="text-right">{line.vat_rate}%</TableCell>
                <TableCell className="text-right">{Number(line.line_total_ttc).toFixed(3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end">
          <div className="space-y-1 text-sm w-64">
            <div className="flex justify-between"><span>{t('subtotal_ht') || 'Total HT'}</span><span className="font-medium">{Number(order.subtotal_ht).toFixed(3)} {order.currency}</span></div>
            <div className="flex justify-between"><span>{t('total_vat') || 'Total TVA'}</span><span className="font-medium">{Number(order.total_vat).toFixed(3)} {order.currency}</span></div>
            <div className="flex justify-between border-t pt-1 font-bold"><span>{t('total_ttc') || 'Total TTC'}</span><span>{Number(order.total_ttc).toFixed(3)} {order.currency}</span></div>
          </div>
        </div>

        {order.notes && (
          <div className="text-sm">
            <span className="text-muted-foreground">{t('notes') || 'Notes'}:</span>
            <p className="mt-1">{order.notes}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
