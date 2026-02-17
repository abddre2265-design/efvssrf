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
  Calendar, 
  CreditCard,
  Package,
  Building2,
  Globe,
  Receipt,
  Banknote,
  FileWarning,
  RotateCcw,
  Wallet,
  Printer,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, InvoiceLine, formatCurrency } from './types';
import { InvoicePrintDialog } from './InvoicePrintDialog';
import { CreditNote } from '@/components/credit-notes/types';

interface InvoiceViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

interface InvoiceDetails extends Invoice {
  client: {
    id: string;
    client_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    governorate: string | null;
    country: string;
    identifier_type: string;
    identifier_value: string;
  } | null;
  lines: (Omit<InvoiceLine, 'product'> & {
    product: {
      id: string;
      name: string;
      reference: string | null;
      ean: string | null;
    } | null;
  })[];
}

export const InvoiceViewDialog: React.FC<InvoiceViewDialogProps> = ({
  open,
  onOpenChange,
  invoiceId,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceId || !open) return;

      setIsLoading(true);
      try {
        // Fetch invoice with client
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select(`
            *,
            client:clients(
              id,
              client_type,
              first_name,
              last_name,
              company_name,
              email,
              phone,
              address,
              governorate,
              country,
              identifier_type,
              identifier_value
            )
          `)
          .eq('id', invoiceId)
          .single();

        if (invoiceError) throw invoiceError;

        // Fetch invoice lines with products
        const { data: linesData, error: linesError } = await supabase
          .from('invoice_lines')
          .select(`*, product:products(id, name, reference, ean)`)
          .eq('invoice_id', invoiceId)
          .order('line_order', { ascending: true });

        if (linesError) throw linesError;

        // Fetch credit notes for this invoice
        const { data: cnData } = await supabase
          .from('credit_notes')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('created_at', { ascending: false });

        setCreditNotes((cnData || []) as unknown as CreditNote[]);

        setInvoice({
          ...invoiceData,
          lines: linesData || [],
        } as InvoiceDetails);
      } catch (error) {
        console.error('Error fetching invoice:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId, open]);

  const getClientName = () => {
    if (!invoice?.client) return '-';
    if (invoice.client.company_name) return invoice.client.company_name;
    return `${invoice.client.first_name || ''} ${invoice.client.last_name || ''}`.trim() || '-';
  };

  const isForeign = invoice?.client_type === 'foreign';

  const getStatusBadge = () => {
    if (!invoice) return null;
    const variants: Record<string, string> = {
      created: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
      draft: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
      validated: 'bg-green-500/10 text-green-600 border-green-500/30',
    };
    return (
      <Badge variant="outline" className={variants[invoice.status] || ''}>
        {t(`status_${invoice.status}`)}
      </Badge>
    );
  };

  const getPaymentBadge = () => {
    if (!invoice) return null;
    const variants: Record<string, string> = {
      unpaid: 'bg-red-500/10 text-red-600 border-red-500/30',
      partial: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
      paid: 'bg-green-500/10 text-green-600 border-green-500/30',
    };
    return (
      <Badge variant="outline" className={variants[invoice.payment_status] || ''}>
        {t(`payment_${invoice.payment_status}`)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl h-[90vh] max-h-[90vh] p-0 overflow-hidden grid grid-rows-[auto,1fr]" 
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-primary" />
              {t('invoice_details')}
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPrintDialogOpen(true)}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                {t('print') || 'Imprimer'}
              </Button>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                {getPaymentBadge()}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          {isLoading ? (
            <div className="p-6 space-y-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : invoice ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-6"
            >
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Receipt className="h-4 w-4" />
                    {t('invoice_info')}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('invoice_number')}:</span>
                      <p className="font-mono font-semibold">{invoice.invoice_number}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('invoice_date')}:</span>
                      <p className="font-medium">
                        {format(new Date(invoice.invoice_date), 'PPP', { locale: getDateLocale() })}
                      </p>
                    </div>
                    {invoice.due_date && (
                      <div>
                        <span className="text-muted-foreground">{t('due_date')}:</span>
                        <p className="font-medium">
                          {format(new Date(invoice.due_date), 'PPP', { locale: getDateLocale() })}
                        </p>
                      </div>
                    )}
                    {isForeign && (
                      <>
                        <div>
                          <span className="text-muted-foreground">{t('currency')}:</span>
                          <p className="font-medium">{invoice.currency}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('exchange_rate')}:</span>
                          <p className="font-medium">{invoice.exchange_rate}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    {isForeign ? <Globe className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    {t('client_info')}
                    <Badge variant="outline" className="ml-auto">
                      {t(invoice.client_type)}
                    </Badge>
                  </div>
                  {invoice.client && (
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-base">{getClientName()}</p>
                      {invoice.client.email && (
                        <p className="text-muted-foreground">{invoice.client.email}</p>
                      )}
                      {invoice.client.phone && (
                        <p className="text-muted-foreground">{invoice.client.phone}</p>
                      )}
                      {invoice.client.address && (
                        <p className="text-muted-foreground">{invoice.client.address}</p>
                      )}
                      <div className="pt-2 border-t">
                        <span className="text-muted-foreground">{t(invoice.client.identifier_type)}:</span>
                        <span className="ml-2 font-mono">{invoice.client.identifier_value}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Invoice Lines */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Package className="h-4 w-4" />
                  {t('invoice_lines')} ({invoice.lines.length})
                </div>
                
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-start p-3 font-medium">{t('product')}</th>
                        <th className="text-center p-3 font-medium">{t('quantity')}</th>
                        <th className="text-end p-3 font-medium">{isForeign ? t('unit_price') : t('unit_price_ht')}</th>
                        {!isForeign && <th className="text-center p-3 font-medium">{t('vat')}</th>}
                        <th className="text-center p-3 font-medium">{t('discount')}</th>
                        <th className="text-end p-3 font-medium">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lines.map((line, index) => (
                        <tr key={line.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{line.product?.name || '-'}</p>
                              {line.product?.reference && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {line.product.reference}
                                </p>
                              )}
                              {line.description && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  {line.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="text-center p-3">{line.quantity}</td>
                          <td className="text-end p-3 font-mono">
                            {formatCurrency(line.unit_price_ht, invoice.currency)}
                          </td>
                          {!isForeign && (
                            <td className="text-center p-3">{line.vat_rate}%</td>
                          )}
                          <td className="text-center p-3">
                            {line.discount_percent > 0 ? `${line.discount_percent}%` : '-'}
                          </td>
                          <td className="text-end p-3 font-mono font-medium">
                            {formatCurrency(isForeign ? line.line_total_ht : line.line_total_ttc, invoice.currency)}
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
                  
                  {!isForeign && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
                        <span className="font-mono">{formatCurrency(invoice.subtotal_ht, invoice.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('total_vat')}:</span>
                        <span className="font-mono">{formatCurrency(invoice.total_vat, invoice.currency)}</span>
                      </div>
                    </>
                  )}
                  
                  {invoice.total_discount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>{t('total_discount')}:</span>
                      <span className="font-mono">-{formatCurrency(invoice.total_discount, invoice.currency)}</span>
                    </div>
                  )}
                  
                  {!isForeign && (
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">{t('total_ttc')}:</span>
                      <span className="font-mono font-medium">{formatCurrency(invoice.total_ttc, invoice.currency)}</span>
                    </div>
                  )}
                  
                  {/* Withholding Tax - BELOW Total TTC - calculated on TTC */}
                  {!isForeign && invoice.withholding_applied && invoice.withholding_rate > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>{t('withholding_tax')} ({invoice.withholding_rate}%):</span>
                      <span className="font-mono">-{formatCurrency(invoice.total_ttc * (invoice.withholding_rate / 100), invoice.currency)}</span>
                    </div>
                  )}
                  
                  {!isForeign && invoice.stamp_duty_enabled && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('stamp_duty')}:</span>
                      <span className="font-mono">{formatCurrency(invoice.stamp_duty_amount, 'TND')}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between pt-3 border-t border-primary/30 text-lg font-semibold">
                    <span>{t('net_payable')}:</span>
                    <span className="font-mono text-primary">
                      {formatCurrency(invoice.net_payable, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Credit Notes Section */}
              {creditNotes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <ClipboardList className="h-4 w-4" />
                      {t('credit_notes')} ({creditNotes.length})
                    </div>
                    {creditNotes.map(cn => (
                      <div key={cn.id} className="p-4 rounded-lg bg-muted/30 border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{cn.credit_note_number}</span>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            {t(`status_${cn.status}`)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">{t('type')}:</span>
                            <p className="font-medium">{t(cn.credit_note_type === 'commercial_price' ? 'credit_note_commercial_price' : 'credit_note_product')}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('date')}:</span>
                            <p className="font-medium">{format(new Date(cn.credit_note_date), 'PP', { locale: getDateLocale() })}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('total_ttc')}:</span>
                            <p className="font-mono font-medium">{formatCurrency(cn.total_ttc, 'TND')}</p>
                          </div>
                        </div>
                        {cn.financial_credit > 0 && (
                          <div className="flex justify-between text-sm pt-1 border-t">
                            <span className="text-muted-foreground">{t('financial_credit')}:</span>
                            <span className="font-mono text-green-600 font-medium">{formatCurrency(cn.financial_credit, 'TND')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Notes */}
              {invoice.notes && (
                <>
                  <Separator />
                  <div className="space-y-2 p-4 rounded-lg bg-muted/30 border">
                    <div className="font-medium">{t('notes')}:</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              {t('no_data')}
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      {/* Print Dialog */}
      <InvoicePrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        invoiceId={invoiceId}
      />
    </Dialog>
  );
};
