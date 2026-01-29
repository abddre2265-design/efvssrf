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
          supplier_id: workflowData.supplierId,
          import_folder_id: workflowData.importFolderId,
          document_family_id: workflowData.documentFamilyId,
          invoice_number: workflowData.invoiceNumber,
          invoice_date: workflowData.invoiceDate,
          currency: workflowData.currency,
          exchange_rate: workflowData.exchangeRate,
          subtotal_ht: workflowData.subtotalHt,
          total_vat: workflowData.totalVat,
          total_discount: workflowData.totalDiscount,
          total_ttc: workflowData.totalTtc,
          stamp_duty_amount: workflowData.stampDutyAmount,
          net_payable: workflowData.netPayable,
          pdf_url: workflowData.pdfUrl,
          pdf_hash: workflowData.pdfHash,
          // Status: 'pending' means created without supply validation
          status: mode === 'without_supply' ? 'pending' : 'pending',
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
          product_id: vp.existingProductId || null,
          reference: pd.reference || null,
          ean: pd.ean || null,
          name: pd.name || `Produit ${index + 1}`,
          product_type: pd.product_type || 'physical',
          quantity: pd.quantity || 1,
          unit_price_ht: pd.unit_price_ht || 0,
          vat_rate: pd.vat_rate || 19,
          discount_percent: pd.discount_percent || 0,
          line_total_ht: pd.line_total_ht || 0,
          line_vat: pd.line_vat || 0,
          line_total_ttc: pd.line_total_ttc || 0,
          is_new_product: vp.decision === 'create_new',
          is_existing_product: vp.decision !== 'create_new',
          line_order: index,
        };
      });

      const { error: linesError } = await supabase
        .from('purchase_lines')
        .insert(purchaseLines);

      if (linesError) throw linesError;

      // Delete the pending upload
      await supabase
        .from('pending_public_uploads')
        .delete()
        .eq('id', pendingUploadId);

      // Also delete from public-uploads storage
      await supabase.storage
        .from('public-uploads')
        .remove([workflowData.storagePath]);

      if (mode === 'without_supply') {
        toast.success('Document d\'achat créé sans approvisionnement');
        onComplete(mode, purchaseDoc.id);
      } else {
        // Redirect to supply tab
        toast.success('Document créé. Redirection vers l\'approvisionnement...');
        onComplete(mode, purchaseDoc.id);
        // Navigate to purchases page with supply tab active
        navigate('/purchases?tab=supply');
      }
    } catch (error) {
      console.error('Error creating purchase document:', error);
      toast.error('Erreur lors de la création du document');
    } finally {
      setIsCreating(false);
      setCreatingMode(null);
    }
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
