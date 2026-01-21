import React from 'react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Eye, 
  FileText,
  Loader2,
  Banknote,
  RotateCcw,
  CheckCircle,
  XCircle,
  Unlock,
  Clock,
  Package,
  PackageCheck,
  RefreshCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { SupplierCreditNote, SupplierCreditNoteStatus, SupplierCreditNoteType } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface SupplierCreditNoteWithRelations extends SupplierCreditNote {
  supplier?: {
    id: string;
    supplier_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  } | null;
  purchase_document?: {
    id: string;
    invoice_number: string | null;
  } | null;
}

interface SupplierCreditNoteTableProps {
  creditNotes: SupplierCreditNoteWithRelations[];
  isLoading: boolean;
  onView: (creditNote: SupplierCreditNoteWithRelations) => void;
  onReturnStock?: (creditNote: SupplierCreditNoteWithRelations) => void;
  onRequestRefund?: (creditNote: SupplierCreditNoteWithRelations) => void;
}

export const SupplierCreditNoteTable: React.FC<SupplierCreditNoteTableProps> = ({
  creditNotes,
  isLoading,
  onView,
  onReturnStock,
  onRequestRefund,
}) => {
  const { t, language, isRTL } = useLanguage();

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getStatusBadge = (status: SupplierCreditNoteStatus) => {
    const variants: Record<SupplierCreditNoteStatus, { className: string; icon: React.ReactNode }> = {
      draft: { 
        className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
        icon: null
      },
      validated: { 
        className: 'bg-green-500/20 text-green-700 dark:text-green-400',
        icon: <CheckCircle className="h-3 w-3 mr-1" />
      },
      cancelled: { 
        className: 'bg-red-500/20 text-red-700 dark:text-red-400',
        icon: <XCircle className="h-3 w-3 mr-1" />
      },
    };
    const config = variants[status];
    return (
      <Badge variant="secondary" className={`${config.className} flex items-center`}>
        {config.icon}
        {t(`status_${status}`)}
      </Badge>
    );
  };

  const getTypeBadge = (type: SupplierCreditNoteType) => {
    const config = type === 'financial' 
      ? { icon: <Banknote className="h-3 w-3 mr-1" />, label: t('financial') }
      : { icon: <RotateCcw className="h-3 w-3 mr-1" />, label: t('product_return') };
    
    return (
      <Badge variant="outline" className="flex items-center">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getStockStatusBadge = (creditNote: SupplierCreditNoteWithRelations) => {
    if (creditNote.credit_note_type !== 'product_return') {
      return <span className="text-muted-foreground text-sm">—</span>;
    }

    const hasBlockedCredit = creditNote.credit_blocked > 0;
    const hasAvailableCredit = creditNote.credit_available > 0;
    
    if (hasBlockedCredit && !hasAvailableCredit) {
      return (
        <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('pending_return')}
        </Badge>
      );
    } else if (hasBlockedCredit && hasAvailableCredit) {
      return (
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center gap-1">
          <Package className="h-3 w-3" />
          {t('partial_return')}
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 flex items-center gap-1">
          <PackageCheck className="h-3 w-3" />
          {t('stock_returned')}
        </Badge>
      );
    }
  };

  const getSupplierName = (creditNote: SupplierCreditNoteWithRelations): string => {
    if (!creditNote.supplier) return '-';
    if (creditNote.supplier.company_name) return creditNote.supplier.company_name;
    return `${creditNote.supplier.first_name || ''} ${creditNote.supplier.last_name || ''}`.trim() || '-';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (creditNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4" />
        <p>{t('no_supplier_credit_notes')}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('credit_note_number')}</TableHead>
            <TableHead>{t('date')}</TableHead>
            <TableHead>{t('purchase_document')}</TableHead>
            <TableHead>{t('supplier')}</TableHead>
            <TableHead>{t('type')}</TableHead>
            <TableHead>{t('stock_status')}</TableHead>
            <TableHead className="text-right">{t('amount')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead className="w-[60px]">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creditNotes.map((creditNote) => (
            <TableRow key={creditNote.id}>
              <TableCell className="font-mono font-medium">
                {creditNote.credit_note_number}
              </TableCell>
              <TableCell>
                {format(new Date(creditNote.credit_note_date), 'PP', { locale: getDateLocale() })}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {creditNote.purchase_document?.invoice_number || '-'}
              </TableCell>
              <TableCell className="font-medium">
                {getSupplierName(creditNote)}
              </TableCell>
              <TableCell>
                {getTypeBadge(creditNote.credit_note_type)}
              </TableCell>
              <TableCell>
                {getStockStatusBadge(creditNote)}
              </TableCell>
              <TableCell className="text-right font-semibold text-primary">
                {formatCurrency(creditNote.net_amount, creditNote.currency)}
              </TableCell>
              <TableCell>
                {getStatusBadge(creditNote.status)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-popover">
                    <DropdownMenuItem onClick={() => onView(creditNote)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('view')}
                    </DropdownMenuItem>
                    {creditNote.credit_note_type === 'product_return' && 
                     creditNote.credit_blocked > 0 && 
                     creditNote.status === 'validated' && 
                     onReturnStock && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onReturnStock(creditNote)}
                          className="text-orange-600"
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          {t('return_stock')}
                        </DropdownMenuItem>
                      </>
                    )}
                    {creditNote.credit_note_type === 'financial' && 
                     creditNote.credit_available > 0 && 
                     creditNote.status === 'validated' && 
                     onRequestRefund && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onRequestRefund(creditNote)}
                          className="text-green-600"
                        >
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          {t('request_refund')}
                        </DropdownMenuItem>
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
