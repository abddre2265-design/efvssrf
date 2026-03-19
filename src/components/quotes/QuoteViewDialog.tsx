import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Quote, QuoteLine } from './types';
import { formatCurrency } from '@/components/invoices/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Building2, Package, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';

interface QuoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  lines: QuoteLine[];
}

export const QuoteViewDialog: React.FC<QuoteViewDialogProps> = ({ open, onOpenChange, quote, lines }) => {
  const { t, language, isRTL } = useLanguage();

  const getLocale = () => {
    switch (language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  if (!quote) return null;

  const getClientName = () => {
    if (!quote.client) return t('unknown_client');
    if (quote.client.company_name) return quote.client.company_name;
    return `${quote.client.first_name || ''} ${quote.client.last_name || ''}`.trim();
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-muted', text: 'text-muted-foreground', label: t('status_draft') },
      sent: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: t('status_sent') },
      accepted: { bg: 'bg-green-500/10', text: 'text-green-600', label: t('status_accepted') },
      invoiced: { bg: 'bg-primary/10', text: 'text-primary', label: t('status_invoiced') },
    };
    const s = map[status] || { bg: 'bg-muted', text: '', label: status };
    return <Badge variant="outline" className={`${s.bg} ${s.text}`}>{s.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{t('quote')} {quote.quote_number}</span>
            {getStatusBadge(quote.status)}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {quote.client?.company_name ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    <span className="font-medium">{getClientName()}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(quote.quote_date), 'dd/MM/yyyy', { locale: getLocale() })}</span>
                  </div>
                  {quote.validity_date && (
                    <div className="text-muted-foreground">
                      {t('valid_until')}: {format(new Date(quote.validity_date), 'dd/MM/yyyy', { locale: getLocale() })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Lines */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t('quote_lines')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('product')}</TableHead>
                      <TableHead className="text-right">{t('quantity')}</TableHead>
                      <TableHead className="text-right">{t('unit_price_ht')}</TableHead>
                      <TableHead className="text-right">{t('vat_rate')}</TableHead>
                      <TableHead className="text-right">{t('discount')}</TableHead>
                      <TableHead className="text-right">{t('total_ttc')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={line.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{line.product?.name || line.description}</span>
                            {line.product?.reference && (
                              <span className="ml-2 text-xs text-muted-foreground">[{line.product.reference}]</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(line.unit_price_ht, quote.currency)}</TableCell>
                        <TableCell className="text-right">{line.vat_rate}%</TableCell>
                        <TableCell className="text-right">{line.discount_percent}%</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(line.line_total_ttc, quote.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Totals */}
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm max-w-xs ml-auto">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('subtotal_ht')}</span>
                    <span className="font-mono">{formatCurrency(quote.subtotal_ht, quote.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('total_vat')}</span>
                    <span className="font-mono">{formatCurrency(quote.total_vat, quote.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('total_ttc')}</span>
                    <span className="font-mono">{formatCurrency(quote.total_ttc, quote.currency)}</span>
                  </div>
                  {quote.stamp_duty_enabled && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('stamp_duty')}</span>
                      <span className="font-mono">{formatCurrency(quote.stamp_duty_amount, quote.currency)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>{t('net_payable')}</span>
                    <span className="font-mono text-primary">{formatCurrency(quote.net_payable, quote.currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {quote.notes && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">{quote.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
