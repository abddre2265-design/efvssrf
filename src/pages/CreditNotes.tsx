import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { recalculateFinancialCredit } from '@/utils/financialCreditUtils';
import { CreditNoteTable, CreditNoteViewDialog, ProductReturnValidationDialog, CreditNote } from '@/components/credit-notes';
import { ProductReturnCreditNoteDialog } from '@/components/invoices/ProductReturnCreditNoteDialog';
import { Invoice } from '@/components/invoices/types';
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

const CreditNotes: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditNoteToDelete, setCreditNoteToDelete] = useState<CreditNote | null>(null);
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [creditNoteToValidate, setCreditNoteToValidate] = useState<CreditNote | null>(null);

  // Product return validation dialog
  const [productReturnValidationOpen, setProductReturnValidationOpen] = useState(false);
  const [cnToValidateProductReturn, setCnToValidateProductReturn] = useState<CreditNote | null>(null);

  // Edit product return credit note
  const [editProductReturnOpen, setEditProductReturnOpen] = useState(false);
  const [editProductReturnInvoice, setEditProductReturnInvoice] = useState<Invoice | null>(null);
  const [editProductReturnCnId, setEditProductReturnCnId] = useState<string | null>(null);

  const fetchCreditNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          client:clients(id, client_type, first_name, last_name, company_name),
          invoice:invoices(id, invoice_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCreditNotes((data || []) as unknown as CreditNote[]);
    } catch (error) {
      console.error('Error fetching credit notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  const handleView = (cn: CreditNote) => {
    setSelectedCreditNoteId(cn.id);
    setViewDialogOpen(true);
  };

  const handleEdit = async (cn: CreditNote) => {
    if (cn.credit_note_type === 'product_return') {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', cn.invoice_id)
        .single();
      if (invoice) {
        setEditProductReturnInvoice(invoice as unknown as Invoice);
        setEditProductReturnCnId(cn.id);
        setEditProductReturnOpen(true);
      }
    }
  };

  const handleDeleteRequest = (cn: CreditNote) => {
    setCreditNoteToDelete(cn);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!creditNoteToDelete) return;
    try {
      await supabase
        .from('credit_note_lines')
        .delete()
        .eq('credit_note_id', creditNoteToDelete.id);

      const { error } = await supabase
        .from('credit_notes')
        .delete()
        .eq('id', creditNoteToDelete.id);
      if (error) throw error;
      toast.success(t('credit_note_deleted') || 'Avoir supprimé');
      setDeleteDialogOpen(false);
      setCreditNoteToDelete(null);
      fetchCreditNotes();
    } catch (error) {
      console.error('Error deleting credit note:', error);
      toast.error(t('error_creating_credit_note'));
    }
  };

  const handleCancel = async (cn: CreditNote) => {
    try {
      const { error } = await supabase
        .from('credit_notes')
        .update({ status: 'draft' })
        .eq('id', cn.id);
      if (error) throw error;
      toast.success(t('credit_note_cancelled') || 'Avoir annulé');
      fetchCreditNotes();
    } catch (error) {
      console.error('Error cancelling credit note:', error);
      toast.error(t('error_creating_credit_note'));
    }
  };

  const handleRestore = async (cn: CreditNote) => {
    try {
      const { error } = await supabase
        .from('credit_notes')
        .update({ status: 'created' })
        .eq('id', cn.id);
      if (error) throw error;
      toast.success(t('credit_note_restored') || 'Avoir restauré');
      fetchCreditNotes();
    } catch (error) {
      console.error('Error restoring credit note:', error);
      toast.error(t('error_creating_credit_note'));
    }
  };

  const handleValidateRequest = (cn: CreditNote) => {
    if (cn.credit_note_type === 'product_return') {
      // Open partial validation dialog for product returns
      setCnToValidateProductReturn(cn);
      setProductReturnValidationOpen(true);
    } else {
      // Commercial credit notes: direct full validation
      setCreditNoteToValidate(cn);
      setValidateDialogOpen(true);
    }
  };

  const handleValidateConfirm = async () => {
    if (!creditNoteToValidate) return;
    try {
      // Commercial credit note full validation
      const { error: cnError } = await supabase
        .from('credit_notes')
        .update({ status: 'validated' })
        .eq('id', creditNoteToValidate.id);
      if (cnError) throw cnError;

      const { data: invoice, error: invFetchError } = await supabase
        .from('invoices')
        .select('total_credited, credit_note_count, net_payable')
        .eq('id', creditNoteToValidate.invoice_id)
        .single();
      if (invFetchError) throw invFetchError;

      const creditAmount = creditNoteToValidate.original_net_payable - creditNoteToValidate.new_net_payable;
      const newTotalCredited = (invoice.total_credited || 0) + creditAmount;

      const { error: invUpdateError } = await supabase
        .from('invoices')
        .update({
          total_credited: newTotalCredited,
          credit_note_count: (invoice.credit_note_count || 0) + 1,
        })
        .eq('id', creditNoteToValidate.invoice_id);
      if (invUpdateError) throw invUpdateError;

      // Recalculate financial credit
      const fcResult = await recalculateFinancialCredit(creditNoteToValidate.invoice_id, t);
      if (fcResult && fcResult.delta > 0) {
        toast.info(`${t('financial_credit_created') || 'Avoir financier créé'}: ${fcResult.financialCredit.toFixed(3)} TND`);
      }

      toast.success(t('credit_note_validated') || 'Avoir validé et appliqué à la facture');
      setValidateDialogOpen(false);
      setCreditNoteToValidate(null);
      fetchCreditNotes();
    } catch (error) {
      console.error('Error validating credit note:', error);
      toast.error(t('error_creating_credit_note'));
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
      <div>
        <h1 className="text-2xl font-bold">{t('credit_notes')}</h1>
        <p className="text-muted-foreground">{t('manage_credit_notes')}</p>
      </div>

      <CreditNoteTable
        creditNotes={creditNotes}
        isLoading={isLoading}
        onView={handleView}
        onDelete={handleDeleteRequest}
        onValidate={handleValidateRequest}
        onCancel={handleCancel}
        onRestore={handleRestore}
        onEdit={handleEdit}
      />

      <CreditNoteViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        creditNoteId={selectedCreditNoteId}
      />

      {/* Product Return Validation Dialog */}
      <ProductReturnValidationDialog
        open={productReturnValidationOpen}
        onOpenChange={setProductReturnValidationOpen}
        creditNote={cnToValidateProductReturn}
        onComplete={fetchCreditNotes}
      />

      {/* Edit Product Return Credit Note */}
      <ProductReturnCreditNoteDialog
        open={editProductReturnOpen}
        onOpenChange={setEditProductReturnOpen}
        invoice={editProductReturnInvoice}
        editCreditNoteId={editProductReturnCnId}
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

      {/* Validate Commercial Confirmation */}
      <AlertDialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('validate')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_validate_credit_note') || 'La validation de cet avoir l\'appliquera à la facture et mettra à jour ses montants. Cette action est irréversible.'}
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

export default CreditNotes;
