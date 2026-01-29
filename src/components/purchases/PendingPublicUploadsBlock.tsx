import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Upload, 
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Loader2,
  Trash2,
  ExternalLink,
  Check,
  X,
  Globe,
  FolderOpen,
  ShoppingCart,
  Tags,
  Play
} from 'lucide-react';
import { LocalPurchaseWorkflowDialog } from './local-purchase';
import { ProcessingInitialDialog } from './local-purchase/ProcessingInitialDialog';
import { CustomsReceiptWorkflowDialog } from './customs-receipt';
import { OtherImportDocumentWorkflowDialog } from './other-import-document';

interface ImportFolder {
  id: string;
  folder_number: string;
  folder_month: number;
  folder_year: number;
  country: string;
}

interface PendingUpload {
  id: string;
  organization_id: string;
  original_filename: string;
  storage_path: string;
  supplier_detected: string | null;
  document_number: string | null;
  document_date: string | null;
  new_filename: string | null;
  status: string;
  analysis_data: any;
  created_at: string;
  document_type: string | null;
  import_folder_id: string | null;
  document_category: string | null;
  // Customs receipt specific fields
  quittance_type: string | null;
  customs_office: string | null;
  customs_declaration_number: string | null;
  importer_name: string | null;
  total_amount: number | null;
}

interface PendingPublicUploadsBlockProps {
  onRefresh: () => void;
}

const DOCUMENT_CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  facture_commerciale_etrangere: { label: 'Facture commerciale étrangère', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  facture_locale: { label: 'Facture locale', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  quittance_douaniere: { label: 'Quittance douanière', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  autre: { label: 'Autre document', color: 'bg-slate-500/10 text-slate-600 border-slate-200' },
  // Legacy support
  facture_fournisseur_etranger: { label: 'Facture fournisseur étranger', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
};

const QUITTANCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  droits_taxes_importation: { label: 'Droits et taxes (importation)', color: 'bg-amber-500/10 text-amber-700 border-amber-300' },
  regularisation: { label: 'Régularisation', color: 'bg-blue-500/10 text-blue-700 border-blue-300' },
  penalite_amende: { label: 'Pénalité / Amende', color: 'bg-red-500/10 text-red-700 border-red-300' },
  consignation_garantie: { label: 'Consignation / Garantie', color: 'bg-cyan-500/10 text-cyan-700 border-cyan-300' },
  autre: { label: 'Autre quittance', color: 'bg-slate-500/10 text-slate-600 border-slate-200' },
};

export const PendingPublicUploadsBlock: React.FC<PendingPublicUploadsBlockProps> = ({
  onRefresh,
}) => {
  const { t, isRTL } = useLanguage();
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [importFolders, setImportFolders] = useState<Record<string, ImportFolder>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<PendingUpload | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Local purchase workflow
  const [localPurchaseUpload, setLocalPurchaseUpload] = useState<PendingUpload | null>(null);
  const [isLocalPurchaseDialogOpen, setIsLocalPurchaseDialogOpen] = useState(false);
  
  // Customs receipt workflow
  const [customsReceiptUpload, setCustomsReceiptUpload] = useState<PendingUpload | null>(null);
  const [isCustomsReceiptDialogOpen, setIsCustomsReceiptDialogOpen] = useState(false);
  
  // Other import document workflow
  const [otherDocumentUpload, setOtherDocumentUpload] = useState<PendingUpload | null>(null);
  const [isOtherDocumentDialogOpen, setIsOtherDocumentDialogOpen] = useState(false);
  
  // Initial processing dialog
  const [initialDialogUpload, setInitialDialogUpload] = useState<PendingUpload | null>(null);
  const [isInitialDialogOpen, setIsInitialDialogOpen] = useState(false);

  const fetchUploads = async () => {
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

      setOrganizationId(org.id);

      // Fetch uploads and import folders in parallel
      const [uploadsResult, foldersResult] = await Promise.all([
        supabase
          .from('pending_public_uploads')
          .select('*')
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('import_folders')
          .select('id, folder_number, folder_month, folder_year, country')
          .eq('organization_id', org.id),
      ]);

      if (uploadsResult.error) throw uploadsResult.error;
      
      // Create a map of import folders for quick lookup
      const foldersMap: Record<string, ImportFolder> = {};
      if (foldersResult.data) {
        foldersResult.data.forEach((folder) => {
          foldersMap[folder.id] = folder;
        });
      }
      
      setUploads(uploadsResult.data || []);
      setImportFolders(foldersMap);
    } catch (error) {
      console.error('Error fetching pending uploads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400', icon: Clock, label: 'En attente' },
      approved: { className: 'bg-primary/20 text-primary', icon: CheckCircle2, label: 'Approuvé' },
      rejected: { className: 'bg-destructive/20 text-destructive', icon: XCircle, label: 'Rejeté' },
    }[status] || { className: 'bg-muted text-muted-foreground', icon: Clock, label: status };

    const Icon = config.icon;

    return (
      <Badge variant="secondary" className={`${config.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getDocumentTypeBadges = (upload: PendingUpload) => {
    const badges = [];
    
    if (upload.document_type === 'import') {
      // Import badge
      badges.push(
        <Badge key="import" className="bg-purple-500/10 text-purple-600 border-purple-200 flex items-center gap-1">
          <Globe className="h-3 w-3" />
          Importation
        </Badge>
      );
      
      // Folder badge
      if (upload.import_folder_id && importFolders[upload.import_folder_id]) {
        const folder = importFolders[upload.import_folder_id];
        badges.push(
          <Badge key="folder" variant="outline" className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            #{folder.folder_number}
          </Badge>
        );
      }
      
      // Category badge with specific color
      if (upload.document_category) {
        const categoryConfig = DOCUMENT_CATEGORY_CONFIG[upload.document_category];
        badges.push(
          <Badge key="category" className={categoryConfig?.color || 'bg-muted text-muted-foreground'}>
            {categoryConfig?.label || upload.document_category}
          </Badge>
        );
      }
      
      // Quittance type badge (if applicable)
      if (upload.document_category === 'quittance_douaniere' && upload.quittance_type) {
        const quittanceConfig = QUITTANCE_TYPE_CONFIG[upload.quittance_type];
        badges.push(
          <Badge key="quittance_type" className={quittanceConfig?.color || 'bg-muted text-muted-foreground'}>
            {quittanceConfig?.label || upload.quittance_type}
          </Badge>
        );
      }
    } else {
      // Local purchase badge
      badges.push(
        <Badge key="local" className="bg-primary/10 text-primary flex items-center gap-1">
          <ShoppingCart className="h-3 w-3" />
          Achat local
        </Badge>
      );
    }
    
    return badges;
  };

  const handleViewUpload = (upload: PendingUpload) => {
    setSelectedUpload(upload);
    setIsViewDialogOpen(true);
  };

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
      toast.error('Erreur lors de l\'ouverture du PDF');
    }
  };

  const handleApprove = async (upload: PendingUpload) => {
    setIsProcessing(true);
    try {
      // Update status to approved
      const { error } = await supabase
        .from('pending_public_uploads')
        .update({ status: 'approved' })
        .eq('id', upload.id);

      if (error) throw error;

      toast.success('Document approuvé');
      fetchUploads();
      onRefresh();
    } catch (error) {
      console.error('Error approving upload:', error);
      toast.error('Erreur lors de l\'approbation');
    } finally {
      setIsProcessing(false);
      setIsViewDialogOpen(false);
    }
  };

  const handleReject = async (upload: PendingUpload) => {
    setIsProcessing(true);
    try {
      // Delete the file from storage
      await supabase.storage
        .from('public-uploads')
        .remove([upload.storage_path]);

      // Delete the record
      const { error } = await supabase
        .from('pending_public_uploads')
        .delete()
        .eq('id', upload.id);

      if (error) throw error;

      toast.success('Document rejeté et supprimé');
      fetchUploads();
      onRefresh();
    } catch (error) {
      console.error('Error rejecting upload:', error);
      toast.error('Erreur lors du rejet');
    } finally {
      setIsProcessing(false);
      setIsViewDialogOpen(false);
    }
  };

  const pendingCount = uploads.filter(u => u.status === 'pending').length;

  if (uploads.length === 0 && !isLoading) {
    return null; // Don't show block if no pending uploads
  }

  return (
    <>
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-orange-500" />
            Uploads publics en attente
            {pendingCount > 0 && (
              <Badge className="bg-orange-500 text-white ml-2">{pendingCount}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Type</TableHead>
                    <TableHead>Fichier original</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>N° Document</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Reçu le</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((upload) => (
                    <TableRow key={upload.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getDocumentTypeBadges(upload)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {upload.original_filename}
                      </TableCell>
                      <TableCell>
                        {upload.supplier_detected || '—'}
                      </TableCell>
                      <TableCell className="font-mono">
                        {upload.document_number || '—'}
                      </TableCell>
                      <TableCell>
                        {upload.document_date || '—'}
                      </TableCell>
                      <TableCell>{getStatusBadge(upload.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(upload.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Show "Process" button for all pending documents */}
                          {upload.status === 'pending' && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                setInitialDialogUpload(upload);
                                setIsInitialDialogOpen(true);
                              }}
                            >
                              <Play className="h-3 w-3" />
                              Traiter
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewUpload(upload)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenPdf(upload.storage_path)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View/Approve Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détails du document
            </DialogTitle>
          </DialogHeader>
          
          {selectedUpload && (
            <div className="space-y-4">
              {/* Document type badges */}
              <div className="flex flex-wrap gap-2">
                {getDocumentTypeBadges(selectedUpload)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Fichier original</p>
                  <p className="font-medium text-sm truncate">{selectedUpload.original_filename}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <div className="mt-1">{getStatusBadge(selectedUpload.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Fournisseur détecté</p>
                  <p className="font-medium">{selectedUpload.supplier_detected || '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">N° Document</p>
                  <p className="font-mono font-medium">{selectedUpload.document_number || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Date du document</p>
                  <p className="font-medium">{selectedUpload.document_date || '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Reçu le</p>
                  <p className="font-medium">{new Date(selectedUpload.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Import context section */}
              {selectedUpload.document_type === 'import' && selectedUpload.import_folder_id && importFolders[selectedUpload.import_folder_id] && (
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-200">
                  <p className="text-xs text-purple-600 mb-2 font-medium">Contexte d'importation</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Dossier:</span>{' '}
                      <span className="font-mono font-medium">#{importFolders[selectedUpload.import_folder_id].folder_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pays:</span>{' '}
                      <span className="font-medium">{importFolders[selectedUpload.import_folder_id].country}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Catégorie:</span>{' '}
                      <span className="font-medium">
                        {selectedUpload.document_category 
                          ? DOCUMENT_CATEGORY_CONFIG[selectedUpload.document_category]?.label || selectedUpload.document_category
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Customs receipt (quittance) specific section */}
              {selectedUpload.document_category === 'quittance_douaniere' && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-200">
                  <p className="text-xs text-amber-700 mb-2 font-medium">Détails quittance douanière</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>{' '}
                      <Badge className={QUITTANCE_TYPE_CONFIG[selectedUpload.quittance_type || '']?.color || 'bg-muted'}>
                        {QUITTANCE_TYPE_CONFIG[selectedUpload.quittance_type || '']?.label || selectedUpload.quittance_type || '—'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bureau:</span>{' '}
                      <span className="font-medium">{selectedUpload.customs_office || '—'}</span>
                    </div>
                    {selectedUpload.customs_declaration_number && (
                      <div>
                        <span className="text-muted-foreground">N° Déclaration:</span>{' '}
                        <span className="font-mono font-medium">{selectedUpload.customs_declaration_number}</span>
                      </div>
                    )}
                    {selectedUpload.importer_name && (
                      <div>
                        <span className="text-muted-foreground">Importateur:</span>{' '}
                        <span className="font-medium">{selectedUpload.importer_name}</span>
                      </div>
                    )}
                    {selectedUpload.total_amount != null && (
                      <div>
                        <span className="text-muted-foreground">Montant:</span>{' '}
                        <span className="font-bold">{selectedUpload.total_amount.toLocaleString('fr-TN')} TND</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Nouveau nom de fichier</p>
                <p className="font-mono text-sm">{selectedUpload.new_filename || '—'}</p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOpenPdf(selectedUpload.storage_path)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir le PDF
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => selectedUpload && handleReject(selectedUpload)}
              disabled={isProcessing || selectedUpload?.status !== 'pending'}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Rejeter
            </Button>
            <Button
              onClick={() => selectedUpload && handleApprove(selectedUpload)}
              disabled={isProcessing || selectedUpload?.status !== 'pending'}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Initial Processing Dialog */}
      {initialDialogUpload && (
        <ProcessingInitialDialog
          open={isInitialDialogOpen}
          onOpenChange={setIsInitialDialogOpen}
          pendingUpload={initialDialogUpload}
          onStartProcessing={(docType, docCategory, folderId, folderNumber) => {
            // Update the upload with the selected type/category/folder
            const updatedUpload = {
              ...initialDialogUpload,
              document_type: docType,
              document_category: docCategory,
              import_folder_id: folderId,
            };
            // Store folder number for later use
            (updatedUpload as any).import_folder_number = folderNumber;
            
            setIsInitialDialogOpen(false);
            
            // Branch based on document category
            if (docCategory === 'quittance_douaniere') {
              // Customs receipt workflow
              setCustomsReceiptUpload(updatedUpload);
              setIsCustomsReceiptDialogOpen(true);
            } else if (docCategory === 'facture_locale' || docCategory === 'facture_commerciale_etrangere') {
              // Invoice workflow (local or import)
              setLocalPurchaseUpload(updatedUpload);
              setIsLocalPurchaseDialogOpen(true);
            } else {
              // Other document workflow (autre, etc.) - only requires family selection
              setOtherDocumentUpload(updatedUpload);
              setIsOtherDocumentDialogOpen(true);
            }
          }}
        />
      )}

      {/* Local Purchase Workflow Dialog */}
      {localPurchaseUpload && organizationId && (
        <LocalPurchaseWorkflowDialog
          open={isLocalPurchaseDialogOpen}
          onOpenChange={setIsLocalPurchaseDialogOpen}
          pendingUpload={localPurchaseUpload}
          organizationId={organizationId}
          onComplete={() => {
            fetchUploads();
            onRefresh();
            setLocalPurchaseUpload(null);
            setInitialDialogUpload(null);
          }}
        />
      )}

      {/* Customs Receipt Workflow Dialog */}
      {customsReceiptUpload && organizationId && customsReceiptUpload.import_folder_id && (
        <CustomsReceiptWorkflowDialog
          open={isCustomsReceiptDialogOpen}
          onOpenChange={setIsCustomsReceiptDialogOpen}
          pendingUpload={{
            ...customsReceiptUpload,
            import_folder_number: (customsReceiptUpload as any).import_folder_number || null,
          }}
          organizationId={organizationId}
          onComplete={() => {
            fetchUploads();
            onRefresh();
            setCustomsReceiptUpload(null);
            setInitialDialogUpload(null);
          }}
        />
      )}

      {/* Other Import Document Workflow Dialog */}
      {otherDocumentUpload && organizationId && otherDocumentUpload.import_folder_id && (
        <OtherImportDocumentWorkflowDialog
          open={isOtherDocumentDialogOpen}
          onOpenChange={setIsOtherDocumentDialogOpen}
          pendingUpload={{
            ...otherDocumentUpload,
            import_folder_number: (otherDocumentUpload as any).import_folder_number || null,
          }}
          organizationId={organizationId}
          onComplete={() => {
            fetchUploads();
            onRefresh();
            setOtherDocumentUpload(null);
            setInitialDialogUpload(null);
          }}
        />
      )}
    </>
  );
};
