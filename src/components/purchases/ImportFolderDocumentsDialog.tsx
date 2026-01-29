import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  FileText, 
  Receipt,
  ShoppingCart,
  Eye,
  ExternalLink,
  Loader2,
  FolderOpen,
  Tags,
  DollarSign,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface ImportFolderDocument {
  id: string;
  document_type: string;
  document_category: string;
  original_filename: string;
  storage_path: string;
  pdf_url: string | null;
  status: string;
  created_at: string;
  document_family?: {
    id: string;
    name: string;
  } | null;
}

interface PurchaseDocument {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_ttc: number;
  payment_status: string;
  status: string;
  supplier?: {
    company_name: string;
  } | null;
  document_family?: {
    id: string;
    name: string;
  } | null;
}

interface CustomsReceipt {
  id: string;
  quittance_type: string;
  document_number: string | null;
  document_date: string | null;
  total_amount: number;
  payment_status: string;
  status: string;
  customs_office: string | null;
}

interface ImportFolderDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderNumber: string;
}

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  facture_commerciale_etrangere: 'Facture étrangère',
  facture_locale: 'Facture locale',
  quittance_douaniere: 'Quittance douanière',
  autre: 'Autre document',
};

const QUITTANCE_TYPE_LABELS: Record<string, string> = {
  droits_taxes_importation: 'Droits et taxes',
  regularisation: 'Régularisation',
  penalite_amende: 'Pénalité / Amende',
  consignation_garantie: 'Consignation',
  autre: 'Autre',
};

export const ImportFolderDocumentsDialog: React.FC<ImportFolderDocumentsDialogProps> = ({
  open,
  onOpenChange,
  folderId,
  folderNumber,
}) => {
  const { language, isRTL } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseDocuments, setPurchaseDocuments] = useState<PurchaseDocument[]>([]);
  const [customsReceipts, setCustomsReceipts] = useState<CustomsReceipt[]>([]);
  const [otherDocuments, setOtherDocuments] = useState<ImportFolderDocument[]>([]);

  const isFr = language === 'fr';

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!open) return;
      
      setIsLoading(true);
      try {
        // Fetch all document types in parallel
        const [purchasesResult, receiptsResult, othersResult] = await Promise.all([
          supabase
            .from('purchase_documents')
            .select(`
              id,
              invoice_number,
              invoice_date,
              total_ttc,
              payment_status,
              status,
              supplier:suppliers(company_name),
              document_family:document_families(id, name)
            `)
            .eq('import_folder_id', folderId)
            .order('created_at', { ascending: false }),
          supabase
            .from('customs_receipts')
            .select('*')
            .eq('import_folder_id', folderId)
            .order('created_at', { ascending: false }),
          supabase
            .from('import_folder_documents')
            .select(`
              id,
              document_type,
              document_category,
              original_filename,
              storage_path,
              pdf_url,
              status,
              created_at,
              document_family:document_families(id, name)
            `)
            .eq('import_folder_id', folderId)
            .order('created_at', { ascending: false }),
        ]);

        if (purchasesResult.error) throw purchasesResult.error;
        if (receiptsResult.error) throw receiptsResult.error;
        if (othersResult.error) throw othersResult.error;

        setPurchaseDocuments((purchasesResult.data || []) as unknown as PurchaseDocument[]);
        setCustomsReceipts(receiptsResult.data || []);
        setOtherDocuments((othersResult.data || []) as unknown as ImportFolderDocument[]);
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast.error(isFr ? 'Erreur lors du chargement' : 'Error loading documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [open, folderId, isFr]);

  const handleOpenPdf = async (storagePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('public-uploads')
        .createSignedUrl(storagePath, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error getting signed URL:', error);
      toast.error(isFr ? 'Erreur lors de l\'ouverture du PDF' : 'Error opening PDF');
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const isUnpaid = status === 'unpaid';
    return (
      <Badge 
        variant="secondary" 
        className={isUnpaid 
          ? 'bg-orange-500/20 text-orange-700' 
          : 'bg-primary/20 text-primary'
        }
      >
        {isUnpaid 
          ? (isFr ? 'Impayé' : 'Unpaid') 
          : (isFr ? 'Payé' : 'Paid')}
      </Badge>
    );
  };

  const totalDocuments = purchaseDocuments.length + customsReceipts.length + otherDocuments.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {isFr ? 'Documents du dossier' : 'Folder Documents'} #{folderNumber}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-150px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : totalDocuments === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>{isFr ? 'Aucun document dans ce dossier' : 'No documents in this folder'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Purchase Documents (Invoices) */}
              {purchaseDocuments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {isFr ? 'Factures d\'achat' : 'Purchase Invoices'}
                    <Badge variant="secondary">{purchaseDocuments.length}</Badge>
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>{isFr ? 'N° Facture' : 'Invoice #'}</TableHead>
                          <TableHead>{isFr ? 'Fournisseur' : 'Supplier'}</TableHead>
                          <TableHead>{isFr ? 'Famille' : 'Family'}</TableHead>
                          <TableHead>{isFr ? 'Montant' : 'Amount'}</TableHead>
                          <TableHead>{isFr ? 'Paiement' : 'Payment'}</TableHead>
                          <TableHead className="w-[80px]">{isFr ? 'Actions' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-mono">{doc.invoice_number || '—'}</TableCell>
                            <TableCell>{doc.supplier?.company_name || '—'}</TableCell>
                            <TableCell>
                              {doc.document_family ? (
                                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                  <Tags className="h-3 w-3" />
                                  {doc.document_family.name}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {doc.total_ttc.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND
                            </TableCell>
                            <TableCell>{getPaymentStatusBadge(doc.payment_status)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Customs Receipts */}
              {customsReceipts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    {isFr ? 'Quittances douanières' : 'Customs Receipts'}
                    <Badge variant="secondary">{customsReceipts.length}</Badge>
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>{isFr ? 'Type' : 'Type'}</TableHead>
                          <TableHead>{isFr ? 'N° Quittance' : 'Receipt #'}</TableHead>
                          <TableHead>{isFr ? 'Bureau' : 'Office'}</TableHead>
                          <TableHead>{isFr ? 'Montant' : 'Amount'}</TableHead>
                          <TableHead>{isFr ? 'Paiement' : 'Payment'}</TableHead>
                          <TableHead className="w-[80px]">{isFr ? 'Actions' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customsReceipts.map((receipt) => (
                          <TableRow key={receipt.id}>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700">
                                {QUITTANCE_TYPE_LABELS[receipt.quittance_type] || receipt.quittance_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{receipt.document_number || '—'}</TableCell>
                            <TableCell>{receipt.customs_office || '—'}</TableCell>
                            <TableCell className="font-medium">
                              {receipt.total_amount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND
                            </TableCell>
                            <TableCell>{getPaymentStatusBadge(receipt.payment_status)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Other Documents */}
              {otherDocuments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {isFr ? 'Autres documents' : 'Other Documents'}
                    <Badge variant="secondary">{otherDocuments.length}</Badge>
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>{isFr ? 'Catégorie' : 'Category'}</TableHead>
                          <TableHead>{isFr ? 'Fichier' : 'File'}</TableHead>
                          <TableHead>{isFr ? 'Famille' : 'Family'}</TableHead>
                          <TableHead>{isFr ? 'Statut' : 'Status'}</TableHead>
                          <TableHead className="w-[80px]">{isFr ? 'Actions' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {otherDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {DOCUMENT_CATEGORY_LABELS[doc.document_category] || doc.document_category}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {doc.original_filename}
                            </TableCell>
                            <TableCell>
                              {doc.document_family ? (
                                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                  <Tags className="h-3 w-3" />
                                  {doc.document_family.name}
                                </Badge>
                              ) : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-primary/20 text-primary">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {isFr ? 'Validé' : 'Validated'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleOpenPdf(doc.storage_path)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isFr ? 'Fermer' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
