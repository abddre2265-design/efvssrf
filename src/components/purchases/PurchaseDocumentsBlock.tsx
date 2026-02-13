import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  FileText, 
  Clock,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
  CreditCard,
  FileImage,
  Loader2,
  Building2,
  User,
  Globe,
  Package,
  ExternalLink,
  FileInput
} from 'lucide-react';
import { PurchaseDocument } from './types';
import { formatCurrency } from '@/components/invoices/types';

interface Supplier {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  supplier_type: 'individual_local' | 'business_local' | 'foreign';
  identifier_value: string | null;
}

interface PurchaseLine {
  id: string;
  name: string;
  reference: string | null;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_total_ttc: number;
}

interface PurchaseDocumentsBlockProps {
  pendingDocuments: PurchaseDocument[];
  validatedDocuments: PurchaseDocument[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const PurchaseDocumentsBlock: React.FC<PurchaseDocumentsBlockProps> = ({
  pendingDocuments,
  validatedDocuments,
  isLoading,
  onRefresh,
}) => {
  const { t, isRTL } = useLanguage();
  const [suppliers, setSuppliers] = useState<Record<string, Supplier>>({});
  const [selectedDocument, setSelectedDocument] = useState<PurchaseDocument | null>(null);
  const [documentLines, setDocumentLines] = useState<PurchaseLine[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isLoadingLines, setIsLoadingLines] = useState(false);



  // Load suppliers for all documents
  useEffect(() => {
    const loadSuppliers = async () => {
      const allDocs = [...pendingDocuments, ...validatedDocuments];
      const supplierIds = [...new Set(allDocs.map(d => d.supplier_id).filter(Boolean))] as string[];
      
      if (supplierIds.length === 0) return;

      const { data } = await supabase
        .from('suppliers')
        .select('id, company_name, first_name, last_name, supplier_type, identifier_value')
        .in('id', supplierIds);

      if (data) {
        const suppliersMap: Record<string, Supplier> = {};
        data.forEach(s => {
          suppliersMap[s.id] = s as Supplier;
        });
        setSuppliers(suppliersMap);
      }
    };

    loadSuppliers();
  }, [pendingDocuments, validatedDocuments]);

  const getSupplierName = (supplierId: string | null): string => {
    if (!supplierId) return '—';
    const supplier = suppliers[supplierId];
    if (!supplier) return '—';
    return supplier.company_name || `${supplier.first_name} ${supplier.last_name}`;
  };

  const getSupplierType = (supplierId: string | null): 'individual_local' | 'business_local' | 'foreign' | null => {
    if (!supplierId) return null;
    const supplier = suppliers[supplierId];
    return supplier?.supplier_type || null;
  };

  const getSupplierTypeBadge = (type: string | null) => {
    if (!type) return null;

    const config = {
      business_local: { 
        className: 'bg-purple-500/10 text-purple-600 border-purple-500/30', 
        icon: Building2,
        label: t('business_local')
      },
      individual_local: { 
        className: 'bg-blue-500/10 text-blue-600 border-blue-500/30', 
        icon: User,
        label: t('individual_local')
      },
      foreign: { 
        className: 'bg-amber-500/10 text-amber-600 border-amber-500/30', 
        icon: Globe,
        label: t('foreign_supplier')
      },
    }[type];

    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.className} gap-1 text-xs`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400', icon: Clock, label: t('status_pending') },
      validated: { className: 'bg-green-500/20 text-green-700 dark:text-green-400', icon: CheckCircle2, label: t('status_validated') },
      cancelled: { className: 'bg-red-500/20 text-red-700 dark:text-red-400', icon: XCircle, label: t('status_cancelled') },
    }[status] || { className: 'bg-gray-500/20 text-gray-700', icon: null, label: status };

    const Icon = config.icon;

    return (
      <Badge variant="secondary" className={`${config.className} flex items-center gap-1`}>
        {Icon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      unpaid: { className: 'bg-red-500/20 text-red-700 dark:text-red-400', label: t('payment_unpaid') },
      partial: { className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400', label: t('payment_partial') },
      paid: { className: 'bg-green-500/20 text-green-700 dark:text-green-400', label: t('payment_paid') },
    }[status] || { className: 'bg-gray-500/20 text-gray-700', label: status };

    return (
      <Badge variant="secondary" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleViewDocument = async (doc: PurchaseDocument) => {
    setSelectedDocument(doc);
    setIsViewDialogOpen(true);
    setIsLoadingLines(true);

    try {
      const { data } = await supabase
        .from('purchase_lines')
        .select('*')
        .eq('purchase_document_id', doc.id)
        .order('line_order');

      setDocumentLines((data || []) as PurchaseLine[]);
    } catch (error) {
      console.error('Error loading purchase lines:', error);
    } finally {
      setIsLoadingLines(false);
    }
  };

  const handleOpenPdf = (pdfUrl: string) => {
    window.open(pdfUrl, '_blank');
  };

  const handlePayDocument = (doc: PurchaseDocument) => {
    // TODO: Implement payment dialog
    console.log('Pay document:', doc.id);
  };

  const renderDocumentsTable = (documents: PurchaseDocument[], title: string, icon: React.ReactNode) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
          <Badge variant="outline" className="ml-2">{documents.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mb-2" />
            <p className="text-sm">{t('no_documents')}</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t('invoice_number')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('supplier')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead className="text-right">{t('total')}</TableHead>
                  <TableHead className="text-right">{t('net_payable')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('payment')}</TableHead>
                  <TableHead className="w-[100px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono font-medium">
                      {doc.invoice_number || '—'}
                    </TableCell>
                    <TableCell>
                      {doc.invoice_date
                        ? new Date(doc.invoice_date).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getSupplierName(doc.supplier_id)}
                    </TableCell>
                    <TableCell>
                      {getSupplierTypeBadge(getSupplierType(doc.supplier_id))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(doc.total_ttc, doc.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-primary">
                      {formatCurrency(doc.net_payable, doc.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell>{getPaymentStatusBadge(doc.payment_status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-popover">
                          <DropdownMenuItem onClick={() => handleViewDocument(doc)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('view')}
                          </DropdownMenuItem>
                          {doc.payment_status !== 'paid' && (
                            <DropdownMenuItem onClick={() => handlePayDocument(doc)}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              {t('pay')}
                            </DropdownMenuItem>
                          )}
                          {doc.pdf_url && (
                            <DropdownMenuItem onClick={() => handleOpenPdf(doc.pdf_url!)}>
                              <FileImage className="mr-2 h-4 w-4" />
                              {t('view_pdf')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {renderDocumentsTable(
        pendingDocuments,
        t('pending_documents'),
        <Clock className="h-5 w-5 text-orange-500" />
      )}
      {renderDocumentsTable(
        validatedDocuments,
        t('validated_documents'),
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      )}

      {/* View Document Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('purchase_document')} - {selectedDocument?.invoice_number || '—'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDocument && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 p-1">
                {/* Document Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{t('invoice_number')}</p>
                    <p className="font-mono font-medium">{selectedDocument.invoice_number || '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{t('date')}</p>
                    <p className="font-medium">
                      {selectedDocument.invoice_date 
                        ? new Date(selectedDocument.invoice_date).toLocaleDateString() 
                        : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{t('status')}</p>
                    <div className="mt-1">{getStatusBadge(selectedDocument.status)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{t('payment')}</p>
                    <div className="mt-1">{getPaymentStatusBadge(selectedDocument.payment_status)}</div>
                  </div>
                </div>

                {/* Supplier Info */}
                {selectedDocument.supplier_id && suppliers[selectedDocument.supplier_id] && (
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {t('supplier')}
                      </h4>
                      {getSupplierTypeBadge(getSupplierType(selectedDocument.supplier_id))}
                    </div>
                    <p className="font-medium">{getSupplierName(selectedDocument.supplier_id)}</p>
                    {suppliers[selectedDocument.supplier_id]?.identifier_value && (
                      <p className="text-sm text-muted-foreground font-mono">
                        {suppliers[selectedDocument.supplier_id].identifier_value}
                      </p>
                    )}
                  </div>
                )}

                {/* Products */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('products')} ({documentLines.length})
                  </h4>
                  
                  {isLoadingLines ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : documentLines.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('no_products')}</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>{t('product')}</TableHead>
                            <TableHead className="text-right">{t('quantity')}</TableHead>
                            <TableHead className="text-right">{t('priceHT')}</TableHead>
                            <TableHead className="text-right">{t('vatRate')}</TableHead>
                            <TableHead className="text-right">{t('total_ttc')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {documentLines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell>
                                <p className="font-medium">{line.name}</p>
                                {line.reference && (
                                  <p className="text-xs text-muted-foreground">Réf: {line.reference}</p>
                                )}
                              </TableCell>
                              <TableCell className="text-right">{line.quantity}</TableCell>
                              <TableCell className="text-right font-mono">
                                {line.unit_price_ht?.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-right">{line.vat_rate}%</TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                {line.line_total_ttc?.toFixed(3)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Totals */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('subtotal_ht')}:</span>
                      <span className="font-mono">{formatCurrency(selectedDocument.subtotal_ht, selectedDocument.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('total_vat')}:</span>
                      <span className="font-mono">{formatCurrency(selectedDocument.total_vat, selectedDocument.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('discount')}:</span>
                      <span className="font-mono">{formatCurrency(selectedDocument.total_discount, selectedDocument.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('total_ttc')}:</span>
                      <span className="font-mono">{formatCurrency(selectedDocument.total_ttc, selectedDocument.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('stamp_duty')}:</span>
                      <span className="font-mono">{formatCurrency(selectedDocument.stamp_duty_amount, selectedDocument.currency)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-primary">
                      <span>{t('net_payable')}:</span>
                      <span className="font-mono">{formatCurrency(selectedDocument.net_payable, selectedDocument.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* PDF Link */}
                {selectedDocument.pdf_url && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleOpenPdf(selectedDocument.pdf_url!)}
                    className="w-full gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('view_pdf')}
                  </Button>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};
