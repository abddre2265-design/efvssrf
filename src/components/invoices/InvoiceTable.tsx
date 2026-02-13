import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  MoreHorizontal, 
  Eye, 
  Pencil,
  XCircle, 
  CheckCircle,
  FileText,
  Loader2,
  Trash2,
  RefreshCw,
  CreditCard,
  ReceiptText,
  Truck,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { Invoice, formatCurrency } from './types';

interface InvoiceTableProps {
  invoices: Invoice[];
  isLoading: boolean;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onCancel: (invoice: Invoice) => void;
  onValidate: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onUse: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  onDeliver?: (invoice: Invoice) => void;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  isLoading,
  onView,
  onEdit,
  onCancel,
  onValidate,
  onDelete,
  onUse,
  onPay,
  onDeliver,
}) => {
  const { t, language, isRTL } = useLanguage();

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      created: { variant: 'secondary', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
      draft: { variant: 'secondary', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
      validated: { variant: 'default', className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
      cancelled: { variant: 'destructive', className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
    };
    const config = variants[invoice.status] || variants.created;
    return (
      <Badge variant={config.variant} className={config.className}>
        {t(`status_${invoice.status}`)}
      </Badge>
    );
  };

  const getPaymentBadge = (paymentStatus: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      unpaid: { variant: 'destructive', className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
      partial: { variant: 'secondary', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400' },
      paid: { variant: 'default', className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
    };
    const config = variants[paymentStatus] || variants.unpaid;
    return (
      <Badge variant={config.variant} className={config.className}>
        {t(`payment_${paymentStatus}`)}
      </Badge>
    );
  };

  const getDeliveryBadge = (deliveryStatus: string | null) => {
    if (!deliveryStatus || deliveryStatus === 'pending') {
      return (
        <Badge variant="outline" className="bg-gray-500/20 text-gray-700 dark:text-gray-400">
          {t('delivery_pending')}
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-purple-500/20 text-purple-700 dark:text-purple-400">
        {t('delivery_delivered')}
      </Badge>
    );
  };

  const getClientName = (invoice: Invoice): string => {
    if (!invoice.client) return '-';
    if (invoice.client.company_name) return invoice.client.company_name;
    return `${invoice.client.first_name || ''} ${invoice.client.last_name || ''}`.trim() || '-';
  };

  const getClientBadge = (clientType: string) => {
    const isLocal = clientType !== 'foreign';
    return (
      <Badge variant="outline" className="text-xs">
        {isLocal ? t('local') : t('foreign')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4" />
        <p>{t('no_invoices')}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('invoice_number')}</TableHead>
            <TableHead>{t('date')}</TableHead>
            <TableHead>{t('client')}</TableHead>
            <TableHead>{t('type')}</TableHead>
            <TableHead className="text-right">{t('total')}</TableHead>
            <TableHead className="text-right">{t('net_payable')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead>{t('payment')}</TableHead>
            <TableHead>{t('delivery')}</TableHead>
            <TableHead className="w-[60px]">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-mono font-medium">
                {invoice.invoice_number}
              </TableCell>
              <TableCell>
                {format(new Date(invoice.invoice_date), 'PP', { locale: getDateLocale() })}
              </TableCell>
              <TableCell className="font-medium">
                {getClientName(invoice)}
              </TableCell>
              <TableCell>
                {getClientBadge(invoice.client_type)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(
                  invoice.client_type === 'foreign' ? invoice.subtotal_ht : invoice.total_ttc,
                  invoice.currency
                )}
              </TableCell>
              <TableCell className="text-right font-semibold text-primary">
                {formatCurrency(invoice.net_payable, invoice.currency)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {getStatusBadge(invoice)}
                </div>
              </TableCell>
              <TableCell>
                {getPaymentBadge(invoice.payment_status)}
              </TableCell>
              <TableCell>
                {invoice.status === 'validated' ? getDeliveryBadge(invoice.delivery_status) : '-'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-popover">
                    <DropdownMenuItem onClick={() => onView(invoice)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('view')}
                    </DropdownMenuItem>
                    {invoice.status === 'created' && (
                      <>
                        <DropdownMenuItem onClick={() => onEdit(invoice)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCancel(invoice)}>
                          <XCircle className="mr-2 h-4 w-4" />
                          {t('cancel_invoice')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onValidate(invoice)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {t('validate_invoice')}
                        </DropdownMenuItem>
                      </>
                    )}
                    {invoice.status === 'draft' && (
                      <>
                        <DropdownMenuItem onClick={() => onUse(invoice)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {t('use_invoice')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onDelete(invoice)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('delete_invoice')}
                        </DropdownMenuItem>
                      </>
                    )}
                    {invoice.status === 'validated' && invoice.payment_status !== 'paid' && (
                      <DropdownMenuItem onClick={() => onPay(invoice)}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t('pay_invoice')}
                      </DropdownMenuItem>
                    )}
                    {invoice.status === 'validated' && (
                      <>
                        {onDeliver && invoice.delivery_status !== 'delivered' && (
                          <DropdownMenuItem onClick={() => onDeliver(invoice)}>
                            <Truck className="mr-2 h-4 w-4" />
                            {t('deliver_invoice')}
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
