import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  Package,
  Truck,
} from 'lucide-react';

interface Supplier {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  supplier_type: string;
}

interface ImportFolder {
  id: string;
  folder_number: string;
}

interface DocumentFamily {
  id: string;
  name: string;
}

interface PurchaseDocumentViewData {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string;
  exchange_rate: number;
  subtotal_ht: number;
  total_vat: number;
  total_discount: number;
  total_ttc: number;
  stamp_duty_amount: number;
  net_payable: number;
  paid_amount: number;
  status: string;
  payment_status: string;
  pdf_url: string | null;
  notes: string | null;
  created_at: string;
  supplier?: Supplier | null;
  import_folder?: ImportFolder | null;
  document_family?: DocumentFamily | null;
}

interface PurchaseInvoiceViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: PurchaseDocumentViewData | null;
  language: string;
}

const formatAmount = (amount: number, currency: string = 'TND'): string => {
  return amount.toLocaleString('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }) + (currency === 'TND' ? ' DT' : ` ${currency}`);
};

export const PurchaseInvoiceViewDialog: React.FC<PurchaseInvoiceViewDialogProps> = ({
  open,
  onOpenChange,
  document,
  language,
}) => {
  const { t } = useLanguage();

  if (!document) return null;

  const getSupplierName = (): string => {
    if (!document.supplier) return '—';
    return document.supplier.company_name ||
      `${document.supplier.first_name || ''} ${document.supplier.last_name || ''}`.trim() ||
      '—';
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
      pending: { className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400', icon: Clock, label: t('status_created') || 'Créée' },
      validated: { className: 'bg-green-500/20 text-green-700 dark:text-green-400', icon: CheckCircle2, label: t('status_validated') || 'Validée' },
      cancelled: { className: 'bg-red-500/20 text-red-700 dark:text-red-400', icon: XCircle, label: t('status_cancelled') || 'Annulée' },
    };
    const conf = config[status] || config.pending;
    const Icon = conf.icon;
    return (
      <Badge variant="secondary" className={`${conf.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {conf.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      unpaid: { className: 'bg-red-500/20 text-red-700', label: t('unpaid') || 'Impayé' },
      partial: { className: 'bg-orange-500/20 text-orange-700', label: t('partial') || 'Partiel' },
      paid: { className: 'bg-green-500/20 text-green-700', label: t('paid') || 'Payé' },
    };
    const conf = config[status] || config.unpaid;
    return (
      <Badge variant="secondary" className={conf.className}>
        {conf.label}
      </Badge>
    );
  };

  const remainingAmount = document.net_payable - document.paid_amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('purchase_invoice_details') || 'Détails de la facture d\'achat'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">{t('invoice_number') || 'N° Facture'}</p>
              <p className="font-mono font-semibold">{document.invoice_number || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('invoice_date') || 'Date'}</p>
              <p className="font-medium">
                {document.invoice_date
                  ? new Date(document.invoice_date).toLocaleDateString(language === 'ar' ? 'ar-TN' : 'fr-TN')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('supplier') || 'Fournisseur'}</p>
              <p className="font-medium">{getSupplierName()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('family') || 'Famille'}</p>
              <p className="font-medium">{document.document_family?.name || '—'}</p>
            </div>
            {document.import_folder && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">{t('import_folder') || 'Dossier import'}</p>
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 mt-1">
                  <Truck className="h-3 w-3 mr-1" />
                  #{document.import_folder.folder_number}
                </Badge>
              </div>
            )}
          </div>

          {/* Statuses */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('status') || 'Statut'} :</span>
              {getStatusBadge(document.status)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('payment') || 'Paiement'} :</span>
              {getPaymentStatusBadge(document.payment_status)}
            </div>
          </div>

          <Separator />

          {/* Financial summary */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('financial_summary') || 'Résumé financier'}</p>
            <div className="space-y-1.5 p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('total_ht') || 'Total HT'}</span>
                <span className="font-medium">{formatAmount(document.subtotal_ht, document.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('total_vat') || 'Total TVA'}</span>
                <span className="font-medium">{formatAmount(document.total_vat, document.currency)}</span>
              </div>
              {document.total_discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('total_discount') || 'Remise'}</span>
                  <span className="font-medium text-destructive">-{formatAmount(document.total_discount, document.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('total_ttc') || 'Total TTC'}</span>
                <span className="font-medium">{formatAmount(document.total_ttc, document.currency)}</span>
              </div>
              {document.stamp_duty_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('stamp_duty') || 'Timbre fiscal'}</span>
                  <span className="font-medium">{formatAmount(document.stamp_duty_amount, document.currency)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span>{t('net_payable') || 'Net à payer'}</span>
                <span className="text-primary">{formatAmount(document.net_payable, document.currency)}</span>
              </div>
              {document.paid_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('paid_amount') || 'Montant payé'}</span>
                  <span className="font-medium text-chart-2">{formatAmount(document.paid_amount, document.currency)}</span>
                </div>
              )}
              {remainingAmount > 0 && document.payment_status !== 'paid' && (
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t('remaining_amount') || 'Reste à payer'}</span>
                  <span className="font-semibold text-destructive">{formatAmount(remainingAmount, document.currency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {document.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-1">{t('notes') || 'Notes'}</p>
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{document.notes}</p>
              </div>
            </>
          )}

          {/* PDF button */}
          {document.pdf_url && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={async () => {
                try {
                  const urlObj = new URL(document.pdf_url!);
                  const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/purchase-documents\/(.+)/);
                  if (pathMatch) {
                    const storagePath = decodeURIComponent(pathMatch[1].split('?')[0]);
                    const { data, error } = await supabase.storage
                      .from('purchase-documents')
                      .createSignedUrl(storagePath, 3600);
                    if (!error && data?.signedUrl) {
                      window.open(data.signedUrl, '_blank');
                      return;
                    }
                  }
                  window.open(document.pdf_url!, '_blank');
                } catch {
                  window.open(document.pdf_url!, '_blank');
                }
              }}
            >
              <ExternalLink className="h-4 w-4" />
              {t('view_pdf') || 'Voir PDF original'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseInvoiceViewDialog;
