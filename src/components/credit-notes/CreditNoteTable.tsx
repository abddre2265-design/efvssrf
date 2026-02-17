import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { CreditNote } from './types';
import { formatCurrency } from '@/components/invoices/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CreditNoteTableProps {
  creditNotes: CreditNote[];
  isLoading: boolean;
  onView: (cn: CreditNote) => void;
  onDelete?: (cn: CreditNote) => void;
}

export const CreditNoteTable: React.FC<CreditNoteTableProps> = ({
  creditNotes,
  isLoading,
  onView,
  onDelete,
}) => {
  const { t, language, isRTL } = useLanguage();

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getClientName = (cn: CreditNote) => {
    if (!cn.client) return '-';
    if (cn.client.company_name) return cn.client.company_name;
    return `${cn.client.first_name || ''} ${cn.client.last_name || ''}`.trim() || '-';
  };

  const getTypeBadge = (type: string) => {
    if (type === 'commercial_price') {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">{t('credit_note_commercial_price')}</Badge>;
    }
    return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">{t('credit_note_product')}</Badge>;
  };

  const getMethodBadge = (method: string) => {
    return <Badge variant="secondary" className="text-xs">{method === 'lines' ? t('mode_line_discount') : t('mode_total_discount')}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
      validated: 'bg-green-500/10 text-green-600 border-green-500/30',
      cancelled: 'bg-red-500/10 text-red-600 border-red-500/30',
    };
    return <Badge variant="outline" className={variants[status] || ''}>{t(`status_${status}`)}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (creditNotes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>{t('no_credit_notes')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-start p-3 font-medium">{t('credit_note_number')}</th>
            <th className="text-start p-3 font-medium">{t('type')}</th>
            <th className="text-start p-3 font-medium">{t('client')}</th>
            <th className="text-start p-3 font-medium">{t('invoice')}</th>
            <th className="text-start p-3 font-medium">{t('date')}</th>
            <th className="text-end p-3 font-medium">{t('subtotal_ht')}</th>
            <th className="text-end p-3 font-medium">{t('total_vat')}</th>
            <th className="text-end p-3 font-medium">{t('total_ttc')}</th>
            <th className="text-center p-3 font-medium">{t('status')}</th>
            <th className="text-center p-3 font-medium">{t('financial_credit')}</th>
            <th className="text-center p-3 font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {creditNotes.map((cn, idx) => (
            <tr key={cn.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
              <td className="p-3 font-mono font-medium">{cn.credit_note_number}</td>
              <td className="p-3">
                <div className="flex flex-col gap-1">
                  {getTypeBadge(cn.credit_note_type)}
                  {getMethodBadge(cn.credit_note_method)}
                </div>
              </td>
              <td className="p-3">{getClientName(cn)}</td>
              <td className="p-3 font-mono text-xs">{cn.invoice?.invoice_number || '-'}</td>
              <td className="p-3">{format(new Date(cn.credit_note_date), 'PP', { locale: getDateLocale() })}</td>
              <td className="text-end p-3 font-mono">{formatCurrency(cn.subtotal_ht, 'TND')}</td>
              <td className="text-end p-3 font-mono">{formatCurrency(cn.total_vat, 'TND')}</td>
              <td className="text-end p-3 font-mono font-medium">{formatCurrency(cn.total_ttc, 'TND')}</td>
              <td className="text-center p-3">{getStatusBadge(cn.status)}</td>
              <td className="text-center p-3">
                {cn.financial_credit > 0 ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30" variant="outline">
                    {formatCurrency(cn.financial_credit, 'TND')}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="p-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">⋮</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border shadow-md z-50">
                    <DropdownMenuItem onClick={() => onView(cn)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t('view')}
                    </DropdownMenuItem>
                    {cn.status === 'draft' && onDelete && (
                      <DropdownMenuItem onClick={() => onDelete(cn)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('delete')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
