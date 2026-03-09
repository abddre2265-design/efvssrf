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
      // If partially validated, split into two: validated lines stay, non-validated go to draft
      if (cn.status === 'validated_partial' && cn.credit_note_type === 'product_return') {
        // Fetch all lines
        const { data: lines, error: linesErr } = await supabase
          .from('credit_note_lines')
          .select('*')
          .eq('credit_note_id', cn.id);
        if (linesErr) throw linesErr;

        const allLines = (lines || []) as any[];
        const validatedLines = allLines.filter(l => l.validated_quantity > 0);
        const nonValidatedLines = allLines.filter(l => l.validated_quantity <= 0);

        // 1. Update original CN: keep only validated lines, set status to 'validated'
        // Update original CN totals based on validated lines only
        const validatedTotalHt = validatedLines.reduce((s: number, l: any) => {
          const unitHt = l.returned_quantity > 0 ? l.discount_ht / l.returned_quantity : 0;
          return s + unitHt * l.validated_quantity;
        }, 0);
        const validatedTotalTtc = validatedLines.reduce((s: number, l: any) => {
          const unitTtc = l.returned_quantity > 0 ? l.discount_ttc / l.returned_quantity : 0;
          return s + unitTtc * l.validated_quantity;
        }, 0);
        const validatedTotalVat = validatedTotalTtc - validatedTotalHt;

        await supabase
          .from('credit_notes')
          .update({
            status: 'validated',
            subtotal_ht: validatedTotalHt,
            total_vat: validatedTotalVat,
            total_ttc: validatedTotalTtc,
          } as any)
          .eq('id', cn.id);

        // Update validated lines: set returned_quantity = validated_quantity
        for (const vl of validatedLines) {
          const unitHt = vl.returned_quantity > 0 ? vl.discount_ht / vl.returned_quantity : 0;
          const unitTtc = vl.returned_quantity > 0 ? vl.discount_ttc / vl.returned_quantity : 0;
          await supabase
            .from('credit_note_lines')
            .update({
              returned_quantity: vl.validated_quantity,
              discount_ht: unitHt * vl.validated_quantity,
              discount_ttc: unitTtc * vl.validated_quantity,
            } as any)
            .eq('id', vl.id);
        }

        // Remove non-validated lines from original CN
        for (const nvl of nonValidatedLines) {
          await supabase
            .from('credit_note_lines')
            .delete()
            .eq('id', nvl.id);
        }

        // 2. Create new CN in draft with non-validated lines (if any)
        if (nonValidatedLines.length > 0) {
          const currentYear = new Date().getFullYear();
          const { data: lastCn } = await supabase
            .from('credit_notes')
            .select('credit_note_counter')
            .eq('credit_note_year', currentYear)
            .order('credit_note_counter', { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextCounter = ((lastCn as any)?.credit_note_counter || 0) + 1;
          const cnNumber = `AV-${currentYear}-${String(nextCounter).padStart(5, '0')}`;

          const draftTotalHt = nonValidatedLines.reduce((s: number, l: any) => s + (l.discount_ht || 0), 0);
          const draftTotalTtc = nonValidatedLines.reduce((s: number, l: any) => s + (l.discount_ttc || 0), 0);
          const draftTotalVat = draftTotalTtc - draftTotalHt;

          const { data: newCn, error: newCnErr } = await supabase
            .from('credit_notes')
            .insert({
              organization_id: cn.organization_id,
              invoice_id: cn.invoice_id,
              client_id: cn.client_id,
              credit_note_number: cnNumber,
              credit_note_prefix: 'AV',
              credit_note_year: currentYear,
              credit_note_counter: nextCounter,
              credit_note_type: 'product_return',
              credit_note_method: 'lines',
              subtotal_ht: draftTotalHt,
              total_vat: draftTotalVat,
              total_ttc: draftTotalTtc,
              stamp_duty_amount: cn.stamp_duty_amount,
              withholding_rate: cn.withholding_rate,
              withholding_amount: 0,
              original_net_payable: 0,
              new_net_payable: 0,
              financial_credit: 0,
              status: 'draft',
            } as any)
            .select()
            .single();
          if (newCnErr) throw newCnErr;

          // Insert non-validated lines into new CN
          const newLines = nonValidatedLines.map((l: any, idx: number) => ({
            credit_note_id: (newCn as any).id,
            invoice_line_id: l.invoice_line_id,
            product_id: l.product_id,
            product_name: l.product_name,
            product_reference: l.product_reference,
            original_quantity: l.original_quantity,
            original_unit_price_ht: l.original_unit_price_ht,
            original_line_total_ht: l.original_line_total_ht,
            original_line_vat: l.original_line_vat,
            original_line_total_ttc: l.original_line_total_ttc,
            returned_quantity: l.returned_quantity,
            validated_quantity: 0,
            discount_ht: l.discount_ht,
            discount_ttc: l.discount_ttc,
            discount_rate: l.discount_rate,
            new_line_total_ht: l.new_line_total_ht,
            new_line_vat: l.new_line_vat,
            new_line_total_ttc: l.new_line_total_ttc,
            vat_rate: l.vat_rate,
            line_order: idx,
          }));

          await supabase
            .from('credit_note_lines')
            .insert(newLines as any);
        }

        toast.success(t('credit_note_split_success') || 'Avoir scindé : lignes validées conservées, lignes non validées en brouillon');
      } else {
        // Simple cancel for non-partial or non-product-return
        const { error } = await supabase
          .from('credit_notes')
          .update({ status: 'draft' })
          .eq('id', cn.id);
        if (error) throw error;
        toast.success(t('credit_note_cancelled') || 'Avoir annulé');
      }

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
