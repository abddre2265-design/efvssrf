import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  RefreshCw, 
  Search,
  MoreHorizontal,
  Eye,
  Check,
  Edit,
  FileText,
  ExternalLink,
  Wallet,
  Package,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { PurchaseDocument } from '@/components/purchases/types';
import { PurchaseInvoiceViewDialog } from '@/components/purchases/PurchaseInvoiceViewDialog';
import { PurchaseInvoiceLinesDialog } from '@/components/purchases/PurchaseInvoiceLinesDialog';

// Extended type with supplier, folder, and family info
interface PurchaseDocumentWithRelations extends PurchaseDocument {
  supplier?: {
    id: string;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    supplier_type: string;
  } | null;
  import_folder?: {
    id: string;
    folder_number: string;
  } | null;
  document_family?: {
    id: string;
    name: string;
  } | null;
}

const PurchaseInvoices: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const [documents, setDocuments] = useState<PurchaseDocumentWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewDoc, setViewDoc] = useState<PurchaseDocumentWithRelations | null>(null);
  const [linesDoc, setLinesDoc] = useState<PurchaseDocumentWithRelations | null>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .single();

      if (!org) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('purchase_documents')
        .select(`
          *,
          supplier:suppliers(id, company_name, first_name, last_name, supplier_type),
          import_folder:import_folders(id, folder_number),
          document_family:document_families(id, name)
        `)
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching purchase documents:', error);
      toast.error(t('error_loading_data') || 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleRefresh = () => {
    fetchDocuments();
  };

  const getSupplierName = (doc: PurchaseDocumentWithRelations): string => {
    if (!doc.supplier) return '—';
    return doc.supplier.company_name || 
      `${doc.supplier.first_name || ''} ${doc.supplier.last_name || ''}`.trim() || 
      '—';
  };

  const getDocumentType = (doc: PurchaseDocumentWithRelations): { label: string; variant: 'local' | 'import' } => {
    if (doc.import_folder_id && doc.import_folder) {
      return {
        label: `Importation – #${doc.import_folder.folder_number}`,
        variant: 'import',
      };
    }
    return {
      label: t('local_purchase') || 'Achat local',
      variant: 'local',
    };
  };

  const getDocumentFamily = (doc: PurchaseDocumentWithRelations): string => {
    return doc.document_family?.name || '—';
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; icon: React.ComponentType<{className?: string}>; label: string }> = {
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

  const formatAmount = (amount: number, currency: string = 'TND'): string => {
    return amount.toLocaleString('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + (currency === 'TND' ? ' DT' : ` ${currency}`);
  };

  const handleValidate = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('purchase_documents')
        .update({ status: 'validated' })
        .eq('id', docId);

      if (error) throw error;
      toast.success(t('document_validated') || 'Document validé');
      fetchDocuments();
    } catch (error) {
      console.error('Error validating document:', error);
      toast.error(t('error_validating') || 'Erreur lors de la validation');
    }
  };

  const handleOpenPdf = async (pdfUrl: string | null) => {
    if (!pdfUrl) {
      toast.error(t('no_pdf_available') || 'Aucun PDF disponible');
      return;
    }

    try {
      // Extract storage path from the stored URL and generate a fresh signed URL
      const urlObj = new URL(pdfUrl);
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
      // Fallback: open original url
      window.open(pdfUrl, '_blank');
    } catch {
      window.open(pdfUrl, '_blank');
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const searchLower = searchTerm.toLowerCase();
    const supplierName = getSupplierName(doc).toLowerCase();
    const invoiceNumber = (doc.invoice_number || '').toLowerCase();
    return supplierName.includes(searchLower) || invoiceNumber.includes(searchLower);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('purchase_invoices') || 'Factures d\'achat'}</h1>
          <p className="text-muted-foreground mt-1">
            {t('purchase_invoices_description') || 'Gérez vos factures d\'achat fournisseurs'}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh') || 'Actualiser'}
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search_invoice_supplier') || 'Rechercher par n° facture ou fournisseur...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('purchase_invoices_list') || 'Liste des factures'}
            <Badge variant="secondary" className="ml-2">{filteredDocuments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t('invoice_number') || 'N° Facture'}</TableHead>
                  <TableHead>{t('invoice_date') || 'Date'}</TableHead>
                  <TableHead>{t('supplier') || 'Fournisseur'}</TableHead>
                  <TableHead>{t('type') || 'Type'}</TableHead>
                  <TableHead>{t('family') || 'Famille'}</TableHead>
                  <TableHead className="text-right">{t('total') || 'Total'}</TableHead>
                  <TableHead className="text-right">{t('net_payable') || 'Net à payer'}</TableHead>
                  <TableHead>{t('status') || 'Statut'}</TableHead>
                  <TableHead>{t('payment') || 'Paiement'}</TableHead>
                  <TableHead>{t('reception') || 'Réception'}</TableHead>
                  <TableHead>{t('supply') || 'Appro.'}</TableHead>
                  <TableHead className="w-[80px]">{t('actions') || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      {t('no_purchase_invoices') || 'Aucune facture d\'achat'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => {
                    const docType = getDocumentType(doc);
                    return (
                      <TableRow key={doc.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">
                          {doc.invoice_number || '—'}
                        </TableCell>
                        <TableCell>
                          {doc.invoice_date 
                            ? new Date(doc.invoice_date).toLocaleDateString(language === 'ar' ? 'ar-TN' : 'fr-TN')
                            : '—'}
                        </TableCell>
                        <TableCell>{getSupplierName(doc)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={docType.variant === 'import' 
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400' 
                              : 'bg-primary/10 text-primary'}
                          >
                            {docType.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getDocumentFamily(doc) !== '—' ? (
                            <Badge variant="outline" className="text-xs">
                              {getDocumentFamily(doc)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatAmount(doc.total_ttc, doc.currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatAmount(doc.net_payable, doc.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell>{getPaymentStatusBadge(doc.payment_status)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {t('not_received') || 'Non reçu'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {t('no') || 'Non'}
                          </Badge>
                        </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2" onClick={() => setViewDoc(doc)}>
                              <Eye className="h-4 w-4" />
                              {t('view') || 'Consulter'}
                            </DropdownMenuItem>
                            {doc.status === 'pending' && (
                              <DropdownMenuItem 
                                className="gap-2"
                                onClick={() => handleValidate(doc.id)}
                              >
                                <Check className="h-4 w-4" />
                                {t('validate') || 'Valider'}
                              </DropdownMenuItem>
                            )}
                            {doc.status === 'pending' && (
                              <DropdownMenuItem className="gap-2">
                                <Edit className="h-4 w-4" />
                                {t('edit') || 'Modifier'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {doc.pdf_url && (
                              <DropdownMenuItem 
                                className="gap-2"
                                onClick={() => handleOpenPdf(doc.pdf_url)}
                              >
                                <ExternalLink className="h-4 w-4" />
                                {t('view_pdf') || 'Voir PDF'}
                              </DropdownMenuItem>
                            )}
                            {doc.status === 'validated' && doc.payment_status !== 'paid' && (
                              <DropdownMenuItem className="gap-2">
                                <Wallet className="h-4 w-4" />
                                {t('add_payment') || 'Ajouter paiement'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2" onClick={() => setLinesDoc(doc)}>
                               <Package className="h-4 w-4" />
                               {t('view_lines') || 'Voir lignes'}
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PurchaseInvoiceViewDialog
        open={!!viewDoc}
        onOpenChange={(open) => { if (!open) setViewDoc(null); }}
        document={viewDoc}
        language={language}
      />
      <PurchaseInvoiceLinesDialog
        open={!!linesDoc}
        onOpenChange={(open) => { if (!open) setLinesDoc(null); }}
        documentId={linesDoc?.id ?? null}
        invoiceNumber={linesDoc?.invoice_number ?? null}
        currency={linesDoc?.currency ?? 'TND'}
      />
    </motion.div>
  );
};

export default PurchaseInvoices;
