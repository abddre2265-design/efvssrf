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
  RefreshCcw,
  Wallet,
  CircleDollarSign,
  ArrowDownCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { CreditNote, CreditNoteStatus, CreditNoteType, getCreditNoteUsageStatus, CreditNoteUsageStatus } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface CreditNoteWithRelations extends CreditNote {
  client?: {
    id: string;
    client_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  } | null;
  invoice?: {
    id: string;
    invoice_number: string;
  } | null;
}

interface CreditNoteTableProps {
  creditNotes: CreditNoteWithRelations[];
  isLoading: boolean;
  onView: (creditNote: CreditNoteWithRelations) => void;
  onUnblock?: (creditNote: CreditNoteWithRelations) => void;
  onRefund?: (creditNote: CreditNoteWithRelations) => void;
}

export const CreditNoteTable: React.FC<CreditNoteTableProps> = ({
  creditNotes,
  isLoading,
  onView,
  onUnblock,
  onRefund,
}) => {
  const { t, language, isRTL } = useLanguage();

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getStatusBadge = (status: CreditNoteStatus) => {
    const variants: Record<CreditNoteStatus, { className: string; icon: React.ReactNode }> = {
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

  const getTypeBadge = (type: CreditNoteType) => {
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

  const getReceptionStatusBadge = (creditNote: CreditNoteWithRelations) => {
    // For financial credit notes, show usage status
    if (creditNote.credit_note_type === 'financial') {
      const usageStatus = getCreditNoteUsageStatus(creditNote as CreditNote);
      return getUsageStatusBadge(usageStatus, creditNote);
    }

    // For product returns, show reception status
    const hasBlockedCredit = creditNote.credit_blocked > 0;
    const hasAvailableCredit = creditNote.credit_available > 0;
    
    if (hasBlockedCredit && !hasAvailableCredit) {
      // All products pending reception
      return (
        <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('pending_reception')}
        </Badge>
      );
    } else if (hasBlockedCredit && hasAvailableCredit) {
      // Partial reception
      return (
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center gap-1">
          <Package className="h-3 w-3" />
          {t('partial_reception')}
        </Badge>
      );
    } else {
      // All products received
      return (
        <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 flex items-center gap-1">
          <PackageCheck className="h-3 w-3" />
          {t('stock_restored')}
        </Badge>
      );
    }
  };

  const getUsageStatusBadge = (status: CreditNoteUsageStatus, creditNote: CreditNoteWithRelations) => {
    switch (status) {
      case 'available':
        return (
          <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            {t('usage_available')}
          </Badge>
        );
      case 'partially_used':
        return (
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center gap-1">
            <CircleDollarSign className="h-3 w-3" />
            {t('usage_partially_used')}
          </Badge>
        );
      case 'fully_used':
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('usage_fully_used')}
          </Badge>
        );
      case 'partially_refunded':
        return (
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-400 flex items-center gap-1">
            <ArrowDownCircle className="h-3 w-3" />
            {t('usage_partially_refunded')}
          </Badge>
        );
      case 'refunded':
        return (
          <Badge variant="secondary" className="bg-gray-500/20 text-gray-700 dark:text-gray-400 flex items-center gap-1">
            <ArrowDownCircle className="h-3 w-3" />
            {t('usage_refunded')}
          </Badge>
        );
      default:
        return <span className="text-muted-foreground text-sm">—</span>;
    }
  };

  const getClientName = (creditNote: CreditNoteWithRelations): string => {
    if (!creditNote.client) return '-';
    if (creditNote.client.company_name) return creditNote.client.company_name;
    return `${creditNote.client.first_name || ''} ${creditNote.client.last_name || ''}`.trim() || '-';
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
        <p>{t('no_credit_notes')}</p>
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
            <TableHead>{t('invoice')}</TableHead>
            <TableHead>{t('client')}</TableHead>
            <TableHead>{t('type')}</TableHead>
            <TableHead>{t('reception_status')}</TableHead>
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
                {creditNote.invoice?.invoice_number || '-'}
              </TableCell>
              <TableCell className="font-medium">
                {getClientName(creditNote)}
              </TableCell>
              <TableCell>
                {getTypeBadge(creditNote.credit_note_type)}
              </TableCell>
              <TableCell>
                {getReceptionStatusBadge(creditNote)}
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
                    {/* Receive products (for product returns with blocked credit) */}
                    {creditNote.credit_note_type === 'product_return' && 
                     creditNote.credit_blocked > 0 && 
                     creditNote.status === 'validated' && 
                     onUnblock && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onUnblock(creditNote)}
                          className="text-orange-600"
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          {t('receive_products')}
                        </DropdownMenuItem>
                      </>
                    )}
                    {/* Refund (for financial credit notes with available credit) */}
                    {creditNote.credit_note_type === 'financial' && 
                     creditNote.credit_available > 0 && 
                     creditNote.status === 'validated' && 
                     onRefund && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onRefund(creditNote)}
                          className="text-green-600"
                        >
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          {t('refund')}
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
