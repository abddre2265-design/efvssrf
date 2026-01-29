import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Banknote,
  CreditCard,
  Receipt,
  Building2,
  Globe,
  Wallet,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '@/components/invoices/types';
import { PurchasePaymentRequest, PAYMENT_REQUEST_STATUSES, PaymentMethodLine } from './types';

interface PaymentRequestAnalyzeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PurchasePaymentRequest | null;
  onActionComplete: () => void;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  check: <Receipt className="h-4 w-4" />,
  draft: <FileText className="h-4 w-4" />,
  iban_transfer: <Building2 className="h-4 w-4" />,
  swift_transfer: <Globe className="h-4 w-4" />,
  bank_deposit: <Wallet className="h-4 w-4" />,
  mixed: <Layers className="h-4 w-4" />,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  check: 'Chèque',
  draft: 'Traite',
  iban_transfer: 'Virement IBAN',
  swift_transfer: 'Virement SWIFT',
  bank_deposit: 'Versement',
  mixed: 'Mixte',
};

export const PaymentRequestAnalyzeDialog: React.FC<PaymentRequestAnalyzeDialogProps> = ({
  open,
  onOpenChange,
  request,
  onActionComplete,
}) => {
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  if (!request) return null;

  const statusConfig = PAYMENT_REQUEST_STATUSES[request.status];

  const getSupplierName = () => {
    const supplier = request.purchase_document?.supplier;
    if (!supplier) return 'N/A';
    if (supplier.supplier_type === 'business_local') {
      return supplier.company_name || 'N/A';
    }
    return [supplier.first_name, supplier.last_name].filter(Boolean).join(' ') || 'N/A';
  };

  const handleApprove = async () => {
    if (!request) return;
    
    setIsProcessing(true);
    setAction('approve');
    
    try {
      // Update the payment request status
      const { error: reqError } = await supabase
        .from('purchase_payment_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (reqError) throw reqError;

      // Create the actual payment
      const { error: payError } = await supabase
        .from('purchase_payments')
        .insert({
          purchase_document_id: request.purchase_document_id,
          payment_date: request.payment_date || new Date().toISOString().split('T')[0],
          amount: request.paid_amount || 0,
          withholding_rate: request.withholding_rate,
          withholding_amount: request.withholding_amount,
          net_amount: (request.paid_amount || 0) - request.withholding_amount,
          payment_method: request.payment_method || 'cash',
          reference_number: request.reference_number,
          notes: request.payment_notes,
        });

      if (payError) throw payError;

      // Update document paid amount
      const doc = request.purchase_document;
      if (doc) {
        const newPaidAmount = doc.net_payable; // Assuming full payment for approved requests
        const { error: docError } = await supabase
          .from('purchase_documents')
          .update({
            paid_amount: newPaidAmount,
            payment_status: 'paid',
          })
          .eq('id', request.purchase_document_id);

        if (docError) throw docError;
      }

      toast.success('Paiement validé avec succès');
      onOpenChange(false);
      onActionComplete();
    } catch (error) {
      console.error('Error approving payment:', error);
      toast.error('Erreur lors de la validation');
    } finally {
      setIsProcessing(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!request || !rejectionReason.trim()) {
      toast.error('Le motif de refus est obligatoire');
      return;
    }
    
    setIsProcessing(true);
    setAction('reject');
    
    try {
      const { error } = await supabase
        .from('purchase_payment_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          rejected_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Demande de paiement refusée');
      onOpenChange(false);
      onActionComplete();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Erreur lors du refus');
    } finally {
      setIsProcessing(false);
      setAction(null);
    }
  };

  const renderPaymentMethods = () => {
    if (request.payment_method === 'mixed' && request.payment_methods) {
      const methods = request.payment_methods as PaymentMethodLine[];
      return (
        <div className="space-y-1">
          {methods.map((line, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {PAYMENT_METHOD_ICONS[line.method]}
              <span>{PAYMENT_METHOD_LABELS[line.method]}</span>
              <span className="font-mono">{formatCurrency(line.amount, 'TND')}</span>
              {line.referenceNumber && (
                <span className="text-muted-foreground">({line.referenceNumber})</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {PAYMENT_METHOD_ICONS[request.payment_method || 'cash']}
        <span>{PAYMENT_METHOD_LABELS[request.payment_method || 'cash']}</span>
        {request.reference_number && (
          <span className="text-muted-foreground font-mono">({request.reference_number})</span>
        )}
      </div>
    );
  };

  const isAwaitingApproval = request.status === 'awaiting_approval';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Analyser le paiement
          </DialogTitle>
          <DialogDescription>
            Vérifiez et validez ou refusez cette demande de paiement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request info */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg font-medium">{request.request_number}</span>
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Document info */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Facture</span>
              <span className="font-mono font-medium">
                {request.purchase_document?.invoice_number || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fournisseur</span>
              <span className="font-medium">{getSupplierName()}</span>
            </div>
          </div>

          <Separator />

          {/* Payment details (from public) */}
          <div className="space-y-3">
            <h4 className="font-medium">Détails du paiement reçu</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date de paiement</span>
                <p className="font-medium">
                  {request.payment_date 
                    ? format(new Date(request.payment_date), 'dd MMMM yyyy', { locale: fr })
                    : 'Non spécifiée'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Montant payé</span>
                <p className="font-medium text-lg">
                  {formatCurrency(request.paid_amount || 0, 'TND')}
                </p>
              </div>
            </div>

            <div>
              <span className="text-muted-foreground text-sm">Mode de paiement</span>
              <div className="mt-1">{renderPaymentMethods()}</div>
            </div>

            {request.payment_notes && (
              <div>
                <span className="text-muted-foreground text-sm">Notes</span>
                <p className="text-sm mt-1">{request.payment_notes}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Amount summary */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant demandé</span>
              <span className="font-medium">{formatCurrency(request.requested_amount, 'TND')}</span>
            </div>
            {request.withholding_rate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Retenue ({request.withholding_rate}%)</span>
                <span className="font-medium text-orange-600">
                  -{formatCurrency(request.withholding_amount, 'TND')}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="font-semibold">Montant reçu</span>
              <span className="font-bold text-lg text-primary">
                {formatCurrency(request.paid_amount || 0, 'TND')}
              </span>
            </div>
          </div>

          {/* Rejection reason input (if rejecting) */}
          {isAwaitingApproval && (
            <div className="space-y-2">
              <Label>Motif de refus (si applicable)</Label>
              <Textarea
                placeholder="Indiquez le motif en cas de refus..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          
          {isAwaitingApproval && (
            <>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isProcessing || !rejectionReason.trim()}
              >
                {isProcessing && action === 'reject' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Refuser
              </Button>
              <Button onClick={handleApprove} disabled={isProcessing}>
                {isProcessing && action === 'approve' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Valider
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
