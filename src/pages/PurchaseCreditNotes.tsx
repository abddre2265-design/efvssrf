import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  PurchaseCreditNoteTable,
  PurchaseCreditNoteViewDialog,
  PurchaseCreditNoteCreateDialog,
  PurchaseCreditNote,
} from '@/components/purchase-credit-notes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const PurchaseCreditNotes: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [creditNotes, setCreditNotes] = useState<PurchaseCreditNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditNoteToDelete, setCreditNoteToDelete] = useState<PurchaseCreditNote | null>(null);
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [creditNoteToValidate, setCreditNoteToValidate] = useState<PurchaseCreditNote | null>(null);

  const fetchCreditNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_credit_notes')
        .select(`
          *,
          supplier:suppliers(id, supplier_type, first_name, last_name, company_name),
          purchase_document:purchase_documents(id, invoice_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCreditNotes((data || []) as unknown as PurchaseCreditNote[]);
    } catch (error) {
      console.error('Error fetching purchase credit notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCreditNotes(); }, []);

  const handleView = (cn: PurchaseCreditNote) => {
    setSelectedCreditNoteId(cn.id);
    setViewDialogOpen(true);
  };

  const handleDeleteRequest = (cn: PurchaseCreditNote) => {
    setCreditNoteToDelete(cn);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!creditNoteToDelete) return;
    try {
      await supabase.from('purchase_credit_note_lines').delete().eq('credit_note_id', creditNoteToDelete.id);
      const { error } = await supabase.from('purchase_credit_notes').delete().eq('id', creditNoteToDelete.id);
      if (error) throw error;
      toast.success(t('credit_note_deleted') || 'Avoir supprimé');
      setDeleteDialogOpen(false);
      setCreditNoteToDelete(null);
      fetchCreditNotes();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(t('genericError'));
    }
  };

  const handleCancel = async (cn: PurchaseCreditNote) => {
    try {
      const { error } = await supabase
        .from('purchase_credit_notes')
        .update({ status: 'draft' })
        .eq('id', cn.id);
      if (error) throw error;
      toast.success(t('credit_note_cancelled') || 'Avoir annulé');
      fetchCreditNotes();
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('genericError'));
    }
  };

  const handleRestore = async (cn: PurchaseCreditNote) => {
    try {
      const { error } = await supabase
        .from('purchase_credit_notes')
        .update({ status: 'created' })
        .eq('id', cn.id);
      if (error) throw error;
      toast.success(t('credit_note_restored') || 'Avoir restauré');
      fetchCreditNotes();
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('genericError'));
    }
  };

  const handleValidateRequest = (cn: PurchaseCreditNote) => {
    setCreditNoteToValidate(cn);
    setValidateDialogOpen(true);
  };

  const handleValidateConfirm = async () => {
    if (!creditNoteToValidate) return;
    try {
      // Validate credit note
      const { error: cnError } = await supabase
        .from('purchase_credit_notes')
        .update({ status: 'validated' })
        .eq('id', creditNoteToValidate.id);
      if (cnError) throw cnError;

      // Update purchase document totals
      const creditAmount = creditNoteToValidate.original_net_payable - creditNoteToValidate.new_net_payable;
      const { data: doc } = await supabase
        .from('purchase_documents')
        .select('total_credited, credit_note_count')
        .eq('id', creditNoteToValidate.purchase_document_id)
        .single();

      if (doc) {
        await supabase
          .from('purchase_documents')
          .update({
            total_credited: ((doc as any).total_credited || 0) + creditAmount,
            credit_note_count: ((doc as any).credit_note_count || 0) + 1,
          })
          .eq('id', creditNoteToValidate.purchase_document_id);
      }

      // For product returns, restore stock (add back to inventory)
      if (creditNoteToValidate.credit_note_type === 'product_return') {
        const { data: lines } = await supabase
          .from('purchase_credit_note_lines')
          .select('product_id, returned_quantity')
          .eq('credit_note_id', creditNoteToValidate.id);

        if (lines) {
          for (const line of lines as any[]) {
            if (line.product_id && line.returned_quantity > 0) {
              // Decrease stock (returned to supplier)
              const { data: product } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', line.product_id)
                .single();

              if (product) {
                await supabase
                  .from('products')
                  .update({ current_stock: Math.max(0, (product as any).current_stock - line.returned_quantity) })
                  .eq('id', line.product_id);

                await supabase
                  .from('stock_movements')
                  .insert({
                    product_id: line.product_id,
                    movement_type: 'remove',
                    quantity: line.returned_quantity,
                    reason: `Avoir achat retour - ${creditNoteToValidate.credit_note_number}`,
                    category: 'purchase_return',
                  } as any);
              }
            }
          }
        }
      }

      toast.success(t('credit_note_validated') || 'Avoir validé');
      setValidateDialogOpen(false);
      setCreditNoteToValidate(null);
      fetchCreditNotes();
    } catch (error) {
      console.error('Error validating:', error);
      toast.error(t('genericError'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('purchase_credit_notes_title') || 'Avoirs Achats'}</h1>
          <p className="text-muted-foreground">{t('manage_purchase_credit_notes') || 'Gérer les avoirs d\'achat fournisseurs'}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('create_purchase_credit_note') || 'Créer un avoir'}
        </Button>
      </div>

      <PurchaseCreditNoteTable
        creditNotes={creditNotes}
        isLoading={isLoading}
        onView={handleView}
        onDelete={handleDeleteRequest}
        onValidate={handleValidateRequest}
        onCancel={handleCancel}
        onRestore={handleRestore}
      />

      <PurchaseCreditNoteViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        creditNoteId={selectedCreditNoteId}
      />

      <PurchaseCreditNoteCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onComplete={fetchCreditNotes}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_delete_invoice')}
              {creditNoteToDelete && (
                <span className="block font-mono font-medium mt-2">{creditNoteToDelete.credit_note_number}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validate Confirmation */}
      <AlertDialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('validate')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_validate_credit_note') || 'La validation appliquera cet avoir à la facture d\'achat. Cette action est irréversible.'}
              {creditNoteToValidate && (
                <span className="block font-mono font-medium mt-2">{creditNoteToValidate.credit_note_number}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleValidateConfirm}>
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default PurchaseCreditNotes;
