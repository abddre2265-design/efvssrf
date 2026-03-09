import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Trash2, FileText, CheckCircle, XCircle, RotateCcw, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { PurchaseCreditNote } from './types';
import { formatCurrency } from '@/components/invoices/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PurchaseCreditNoteTableProps {
  creditNotes: PurchaseCreditNote[];
  isLoading: boolean;
  onView: (cn: PurchaseCreditNote) => void;
  onDelete?: (cn: PurchaseCreditNote) => void;
  onValidate?: (cn: PurchaseCreditNote) => void;
  onCancel?: (cn: PurchaseCreditNote) => void;
  onRestore?: (cn: PurchaseCreditNote) => void;
  onEdit?: (cn: PurchaseCreditNote) => void;
}

export const PurchaseCreditNoteTable: React.FC<PurchaseCreditNoteTableProps> = ({
  creditNotes,
  isLoading,
  onView,
  onDelete,
  onValidate,
  onCancel,
  onRestore,
  onEdit,
}) => {
  const { t, language, isRTL } = useLanguage();

  const getDateLocale = () => {
    switch (language) {
      case 'ar': return arSA;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const getSupplierName = (cn: PurchaseCreditNote) => {
    if (!cn.supplier) return '-';
    if (cn.supplier.company_name) return cn.supplier.company_name;
    return `${cn.supplier.first_name || ''} ${cn.supplier.last_name || ''}`.trim() || '-';
  };

  const getTypeBadge = (cn: PurchaseCreditNote) => {
    if (cn.credit_note_type === 'commercial_price') {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
          {t('credit_note_commercial_price')}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
        {t('credit_note_product') || 'Avoir produit'}
      </Badge>
    );
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

  const canValidate = (cn: PurchaseCreditNote) => cn.status === 'created' || cn.status === 'validated_partial';
  const canCancel = (cn: PurchaseCreditNote) => cn.status === 'created' || cn.status === 'validated_partial';
  const canRestore = (cn: PurchaseCreditNote) => cn.status === 'draft';
  const canEdit = (cn: PurchaseCreditNote) =>
    (cn.status === 'created' || cn.status === 'validated_partial') && cn.credit_note_type === 'product_return';
  const canDelete = (cn: PurchaseCreditNote) => {
    if (cn.credit_note_type === 'product_return') return cn.status === 'draft';
    return cn.status === 'created' || cn.status === 'draft';
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
        <p>{t('no_purchase_credit_notes') || 'Aucun avoir d\'achat'}</p>
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
            <th className="text-start p-3 font-medium">{t('supplier') || 'Fournisseur'}</th>
            <th className="text-start p-3 font-medium">{t('purchase_invoice') || 'Facture achat'}</th>
            <th className="text-start p-3 font-medium">{t('date')}</th>
            <th className="text-end p-3 font-medium">{t('subtotal_ht')}</th>
            <th className="text-end p-3 font-medium">{t('total_ttc')}</th>
            <th className="text-center p-3 font-medium">{t('status')}</th>
            <th className="text-center p-3 font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {creditNotes.map((cn, idx) => (
            <tr key={cn.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
              <td className="p-3 font-mono font-medium">{cn.credit_note_number}</td>
              <td className="p-3">{getTypeBadge(cn)}</td>
              <td className="p-3">{getSupplierName(cn)}</td>
              <td className="p-3 font-mono text-xs">{cn.purchase_document?.invoice_number || '-'}</td>
              <td className="p-3">{format(new Date(cn.credit_note_date), 'PP', { locale: getDateLocale() })}</td>
              <td className="text-end p-3 font-mono">{formatCurrency(cn.subtotal_ht, 'TND')}</td>
              <td className="text-end p-3 font-mono font-medium">{formatCurrency(cn.total_ttc, 'TND')}</td>
              <td className="text-center p-3">{getStatusBadge(cn.status)}</td>
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
                    {canEdit(cn) && onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(cn)}>
                        <Pencil className="mr-2 h-4 w-4 text-blue-600" />
                        {t('edit') || 'Modifier'}
                      </DropdownMenuItem>
                    )}
                    {canValidate(cn) && onValidate && (
                      <DropdownMenuItem onClick={() => onValidate(cn)}>
                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                        {t('validate')}
                      </DropdownMenuItem>
                    )}
                    {canCancel(cn) && onCancel && (
                      <DropdownMenuItem onClick={() => onCancel(cn)}>
                        <XCircle className="mr-2 h-4 w-4 text-amber-600" />
                        {t('cancel')}
                      </DropdownMenuItem>
                    )}
                    {canRestore(cn) && onRestore && (
                      <DropdownMenuItem onClick={() => onRestore(cn)}>
                        <RotateCcw className="mr-2 h-4 w-4 text-blue-600" />
                        {t('restore')}
                      </DropdownMenuItem>
                    )}
                    {canDelete(cn) && onDelete && (
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
