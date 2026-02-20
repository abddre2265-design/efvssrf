import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, RefreshCw } from 'lucide-react';
import { PurchaseLine } from '@/components/purchases/types';

interface PurchaseInvoiceLinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  invoiceNumber: string | null;
  currency: string;
}

const formatAmount = (amount: number, currency: string = 'TND'): string => {
  return amount.toLocaleString('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }) + (currency === 'TND' ? ' DT' : ` ${currency}`);
};

export const PurchaseInvoiceLinesDialog: React.FC<PurchaseInvoiceLinesDialogProps> = ({
  open,
  onOpenChange,
  documentId,
  invoiceNumber,
  currency,
}) => {
  const { t } = useLanguage();
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && documentId) {
      fetchLines();
    }
  }, [open, documentId]);

  const fetchLines = async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_lines')
        .select('*')
        .eq('purchase_document_id', documentId)
        .order('line_order', { ascending: true });

      if (error) throw error;
      setLines(data || []);
    } catch (error) {
      console.error('Error fetching purchase lines:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {t('invoice_lines') || 'Lignes de facture'}
            {invoiceNumber && (
              <Badge variant="outline" className="font-mono ml-2">
                {invoiceNumber}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lines.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{t('no_lines') || 'Aucune ligne trouvée'}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('product') || 'Produit'}</TableHead>
                    <TableHead>{t('reference') || 'Référence'}</TableHead>
                    <TableHead className="text-right">{t('quantity') || 'Qté'}</TableHead>
                    <TableHead className="text-right">{t('unit_price_ht') || 'PU HT'}</TableHead>
                    <TableHead className="text-right">{t('vat_rate') || 'TVA'}</TableHead>
                    <TableHead className="text-right">{t('discount') || 'Remise'}</TableHead>
                    <TableHead className="text-right">{t('line_total_ht') || 'Total HT'}</TableHead>
                    <TableHead className="text-right">{t('line_total_ttc') || 'Total TTC'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={line.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                      <TableCell className="font-medium">{line.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {line.reference || line.ean || '—'}
                      </TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{formatAmount(line.unit_price_ht, currency)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs">{line.vat_rate}%</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {line.discount_percent > 0 ? (
                          <Badge variant="secondary" className="text-xs">{line.discount_percent}%</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatAmount(line.line_total_ht, currency)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatAmount(line.line_total_ttc, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseInvoiceLinesDialog;
