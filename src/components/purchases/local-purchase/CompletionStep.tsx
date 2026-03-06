import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Package,
  FileText,
  Loader2,
  Plus,
  Truck,
  Tags,
  ArrowRight
} from 'lucide-react';
import { LocalPurchaseWorkflowData } from './types';

interface CompletionStepProps {
  workflowData: LocalPurchaseWorkflowData;
  organizationId: string;
  pendingUploadId: string;
  onComplete: (mode: 'without_supply' | 'with_supply', purchaseDocId: string) => void;
}

export const CompletionStep: React.FC<CompletionStepProps> = ({
  workflowData,
  organizationId,
  pendingUploadId,
  onComplete,
}) => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [creatingMode, setCreatingMode] = useState<'without_supply' | 'with_supply' | null>(null);

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }) + ' TND';
  };

  const createPurchaseDocument = async (mode: 'without_supply' | 'with_supply') => {
    setIsCreating(true);
    setCreatingMode(mode);

    try {
      // Create purchase document
      const { data: purchaseDoc, error: purchaseError } = await supabase
        .from('purchase_documents')
        .insert({
          organization_id: organizationId,
          supplier_id: workflowData.supplierId || null,
          import_folder_id: workflowData.importFolderId || null,
          document_family_id: workflowData.documentFamilyId || null,
          invoice_number: workflowData.invoiceNumber || null,
          invoice_date: isValidDate(workflowData.invoiceDate) ? workflowData.invoiceDate : null,
          currency: workflowData.currency || 'TND',
          exchange_rate: workflowData.exchangeRate || 1.0,
          subtotal_ht: workflowData.subtotalHt || 0,
          total_vat: workflowData.totalVat || 0,
          total_discount: workflowData.totalDiscount || 0,
          total_ttc: workflowData.totalTtc || 0,
          stamp_duty_amount: workflowData.stampDutyAmount || 0,
          net_payable: workflowData.netPayable || 0,
          pdf_url: workflowData.pdfUrl || null,
          pdf_hash: workflowData.pdfHash || null,
          // Status: 'pending' means created without supply validation
          status: 'pending',
          payment_status: 'unpaid',
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase lines from productDetails or verifiedProducts
      const products = workflowData.productDetails.length > 0
        ? workflowData.productDetails.map(pd => ({ productDetails: pd, decision: 'create_new', existingProductId: null }))
        : workflowData.verifiedProducts;

      const purchaseLines = products.map((vp: any, index: number) => {
        const pd = vp.productDetails || vp;
        return {
          purchase_document_id: purchaseDoc.id,
          product_id: (vp.existingProductId && vp.existingProductId.trim() !== "") ? vp.existingProductId : null,
          reference: pd.reference || null,
          ean: pd.ean || null,
          name: pd.name || `Produit ${index + 1}`,
          product_type: pd.product_type || 'physical',
          quantity: Number(pd.quantity) || 1,
          unit_price_ht: Number(pd.unit_price_ht) || 0,
          vat_rate: Number(pd.vat_rate) || 19,
          discount_percent: Number(pd.discount_percent) || 0,
          line_total_ht: Number(pd.line_total_ht) || 0,
          line_vat: Number(pd.line_vat) || 0,
          line_total_ttc: Number(pd.line_total_ttc) || 0,
          is_new_product: vp.decision === 'create_new',
          is_existing_product: vp.decision !== 'create_new',
          line_order: index,
        };
      });

      const { error: linesError } = await supabase
        .from('purchase_lines')
        .insert(purchaseLines);

      if (linesError) {
        console.error('Error creating purchase lines:', linesError);
        throw linesError;
      }

      // Beyond this point, the document is created.
      // We wrap cleanup in a try-catch so it doesn't break the success flow.
      try {
        // Delete the pending upload from database
        console.log('Cleaning up pending upload record:', pendingUploadId);
        const { error: deleteError } = await supabase
          .from('pending_public_uploads')
          .delete()
          .eq('id', pendingUploadId);

        if (deleteError) {
          console.warn('Silent error deleting pending record:', deleteError);
        }

        // Also delete from public-uploads storage
        if (workflowData.storagePath) {
          console.log('Cleaning up file from storage:', workflowData.storagePath);
          const { error: storageError } = await supabase.storage
            .from('public-uploads')
            .remove([workflowData.storagePath]);

          if (storageError) {
            console.warn('Silent error deleting storage file:', storageError);
          }
        }
      } catch (cleanupError) {
        console.warn('Non-blocking cleanup error:', cleanupError);
      }

      if (mode === 'without_supply') {
        toast.success('Document d\'achat créé avec succès');
        onComplete(mode, purchaseDoc.id);
      } else {
        toast.success('Document créé. Redirection vers l\'approvisionnement...');
        onComplete(mode, purchaseDoc.id);
        // Navigate to supply page with pre-loaded PDF and extracted data
        navigate('/dashboard/supply', {
          state: {
            preloadedPdf: {
              pdfUrl: workflowData.pdfUrl,
              storagePath: workflowData.storagePath,
              originalFilename: workflowData.originalFilename,
              extractedSupplier: workflowData.extractedSupplier,
              extractedProducts: workflowData.extractedProducts,
              extractedTotals: workflowData.extractedTotals,
              invoiceNumber: workflowData.invoiceNumber,
              invoiceDate: workflowData.invoiceDate,
              currency: workflowData.currency,
              exchangeRate: workflowData.exchangeRate,
            }
          }
        });
      }
    } catch (error: any) {
      console.error('Error creating purchase document:', error);
      const errorMessage = error.message || error.details || 'Erreur technique';
      toast.error(`Erreur lors de la création du document : ${errorMessage}`);
    } finally {
      setIsCreating(false);
      setCreatingMode(null);
    }
  };

  // Helper to check if a string is a valid ISO date
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr || dateStr.trim() === "" || dateStr === "N/A" || dateStr === "null") return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="bg-primary/5">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Finalisation
        </CardTitle>
        <CardDescription>
          Choisissez comment créer ce document d'achat
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Fournisseur</p>
            <p className="font-medium">{workflowData.supplierName || '—'}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">N° Facture</p>
            <p className="font-mono font-medium">{workflowData.invoiceNumber || '—'}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Produits</p>
            <p className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              {workflowData.verifiedProducts.length}
            </p>
          </div>
          {workflowData.documentFamilyName && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Famille</p>
              <p className="font-medium flex items-center gap-2">
                <Tags className="h-4 w-4" />
                {workflowData.documentFamilyName}
              </p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="p-4 border rounded-lg bg-primary/5">
          <div className="flex items-center justify-between">
            <span className="font-medium">Net à payer</span>
            <span className="text-xl font-bold text-primary">
              {formatAmount(workflowData.netPayable)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-4">
          <h4 className="font-medium">Choisissez une option :</h4>

          {/* Create without supply */}
          <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-muted">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h5 className="font-medium">Créer sans approvisionnement</h5>
                <p className="text-sm text-muted-foreground mt-1">
                  Le document sera créé avec le statut "Créé sans approvisionnement".
                  Les stocks ne seront pas mis à jour.
                </p>
                <Button
                  onClick={() => createPurchaseDocument('without_supply')}
                  disabled={isCreating}
                  variant="outline"
                  className="mt-3 gap-2"
                >
                  {isCreating && creatingMode === 'without_supply' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Créer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Create with supply */}
          <div className="p-4 border-2 border-primary/50 rounded-lg bg-primary/5">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-primary/20">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium">Créer et ajouter approvisionnement</h5>
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    Recommandé
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Le document sera créé et vous serez redirigé vers la page d'approvisionnement
                  pour mettre à jour les stocks avec les nouveaux produits.
                </p>
                <Button
                  onClick={() => createPurchaseDocument('with_supply')}
                  disabled={isCreating}
                  className="mt-3 gap-2"
                >
                  {isCreating && creatingMode === 'with_supply' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Créer et approvisionner
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
