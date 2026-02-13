import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/components/invoices/types';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { InvoiceCreateDialog } from '@/components/invoices/InvoiceCreateDialog';
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog';
import { InvoiceEditDialog } from '@/components/invoices/InvoiceEditDialog';
import { PaymentDialog } from '@/components/invoices/PaymentDialog';
import { InvoiceAISearch } from '@/components/invoices/InvoiceAISearch';
import { AIInvoiceGeneratorDialog } from '@/components/invoices/AIInvoiceGeneratorDialog';
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

const Invoices: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  
  // Use invoice state (opens edit dialog in "use" mode)
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [invoiceToUse, setInvoiceToUse] = useState<string | null>(null);
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null);

  // AI Generator dialog state
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false);

  const fetchInvoices = async () => {
    try {
      // Fetch organization ID
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (orgData) setOrganizationId(orgData.id);
      }

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, client_type, first_name, last_name, company_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const invoiceData = (data || []) as unknown as Invoice[];
      setInvoices(invoiceData);
      setFilteredInvoices(invoiceData);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleView = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id);
    setViewDialogOpen(true);
  };

  const handleEdit = (invoice: Invoice) => {
    setSelectedInvoiceId(invoice.id);
    setEditDialogOpen(true);
  };

  const handleCancel = async (invoice: Invoice) => {
    try {
      // 1. Fetch invoice lines to restore stock
      const { data: invoiceLines, error: linesError } = await supabase
        .from('invoice_lines')
        .select('product_id, quantity')
        .eq('invoice_id', invoice.id);

      if (linesError) throw linesError;

      // 2. For each line, restore the stock
      if (invoiceLines && invoiceLines.length > 0) {
        for (const line of invoiceLines) {
          // Get current product stock
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('current_stock, unlimited_stock')
            .eq('id', line.product_id)
            .maybeSingle();

          if (productError) throw productError;
          if (!product || product.unlimited_stock) continue;

          const previousStock = product.current_stock ?? 0;
          const newStock = previousStock + line.quantity;

          // Update product stock
          const { error: updateError } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', line.product_id);

          if (updateError) throw updateError;

          // Create stock movement record
          await supabase
            .from('stock_movements')
            .insert([{
              product_id: line.product_id,
              movement_type: 'add' as const,
              quantity: line.quantity,
              previous_stock: previousStock,
              new_stock: newStock,
              reason_category: 'Annulation facture',
              reason_detail: `Annulation facture ${invoice.invoice_number}`,
            }]);
        }
      }

      // 3. Update invoice status to draft
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'draft' })
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success(t('invoice_cancelled'));
      fetchInvoices();
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      toast.error(t('error_cancelling_invoice'));
    }
  };

  const handleValidate = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'validated' })
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success(t('invoice_validated'));
      fetchInvoices();
    } catch (error) {
      console.error('Error validating invoice:', error);
      toast.error(t('error_validating_invoice'));
    }
  };

  const handleDeleteRequest = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    
    try {
      // 1. Delete invoice lines first (foreign key constraint)
      const { error: linesError } = await supabase
        .from('invoice_lines')
        .delete()
        .eq('invoice_id', invoiceToDelete.id);

      if (linesError) throw linesError;

      // 2. Delete the invoice
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceToDelete.id);

      if (error) throw error;

      toast.success(t('invoice_deleted'));
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error(t('error_deleting_invoice'));
    }
  };

  const handleUse = (invoice: Invoice) => {
    setInvoiceToUse(invoice.id);
    setUseDialogOpen(true);
  };

  const handlePay = (invoice: Invoice) => {
    setInvoiceToPay(invoice);
    setPaymentDialogOpen(true);
  };

  const handleDeliver = async (invoice: Invoice) => {
    try {
      // 1. Get current year and next counter for delivery note
      const currentYear = new Date().getFullYear();
      
      const { data: lastNote } = await supabase
        .from('delivery_notes')
        .select('delivery_note_counter')
        .eq('delivery_note_year', currentYear)
        .order('delivery_note_counter', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextCounter = (lastNote?.delivery_note_counter || 0) + 1;
      const deliveryNoteNumber = `BL-${currentYear}-${String(nextCounter).padStart(5, '0')}`;

      // 2. Create delivery note
      const { data: deliveryNote, error: dnError } = await supabase
        .from('delivery_notes')
        .insert({
          organization_id: organizationId,
          invoice_id: invoice.id,
          client_id: invoice.client_id,
          delivery_note_number: deliveryNoteNumber,
          delivery_note_prefix: 'BL',
          delivery_note_year: currentYear,
          delivery_note_counter: nextCounter,
          currency: invoice.currency,
          exchange_rate: invoice.exchange_rate,
          subtotal_ht: invoice.subtotal_ht,
          total_vat: invoice.total_vat,
          total_discount: invoice.total_discount,
          total_ttc: invoice.total_ttc,
          notes: invoice.notes,
        })
        .select()
        .single();

      if (dnError) throw dnError;

      // 3. Copy invoice lines to delivery note lines
      const { data: invoiceLines } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (invoiceLines && invoiceLines.length > 0) {
        const deliveryNoteLines = invoiceLines.map(line => ({
          delivery_note_id: deliveryNote.id,
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price_ht: line.unit_price_ht,
          vat_rate: line.vat_rate,
          discount_percent: line.discount_percent,
          line_total_ht: line.line_total_ht,
          line_vat: line.line_vat,
          line_total_ttc: line.line_total_ttc,
          line_order: line.line_order,
        }));

        await supabase.from('delivery_note_lines').insert(deliveryNoteLines);
      }

      // 4. Update invoice delivery status
      await supabase
        .from('invoices')
        .update({ delivery_status: 'delivered' })
        .eq('id', invoice.id);

      toast.success(t('invoice_delivered'));
      fetchInvoices();
    } catch (error) {
      console.error('Error delivering invoice:', error);
      toast.error(t('error_delivering_invoice'));
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('invoices')}</h1>
          <p className="text-muted-foreground">{t('manage_invoices')}</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setAiGeneratorOpen(true)}>
            <Sparkles className="h-4 w-4" />
            {t('ai_invoice_generator')}
          </Button>
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('create_invoice')}
          </Button>
        </div>
      </div>

      {/* AI Search */}
      <InvoiceAISearch
        invoices={invoices}
        onFilteredInvoices={setFilteredInvoices}
        organizationId={organizationId}
      />

      {/* Invoice Table */}
      <InvoiceTable
        invoices={filteredInvoices}
        isLoading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onValidate={handleValidate}
        onDelete={handleDeleteRequest}
        onUse={handleUse}
        onPay={handlePay}
        onDeliver={handleDeliver}
      />

      {/* Create Dialog */}
      <InvoiceCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={fetchInvoices}
      />

      {/* View Dialog */}
      <InvoiceViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        invoiceId={selectedInvoiceId}
      />

      {/* Edit Dialog */}
      <InvoiceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={fetchInvoices}
        invoiceId={selectedInvoiceId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_invoice')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{t('confirm_delete_invoice')}</p>
              <p className="text-sm text-muted-foreground">{t('delete_invoice_warning')}</p>
              {invoiceToDelete && (
                <p className="font-mono font-medium text-foreground">
                  {invoiceToDelete.invoice_number}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Use Invoice Dialog (Edit with status change to created) */}
      <InvoiceEditDialog
        open={useDialogOpen}
        onOpenChange={setUseDialogOpen}
        onUpdated={fetchInvoices}
        invoiceId={invoiceToUse}
        useMode={true}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={invoiceToPay}
        onPaymentComplete={fetchInvoices}
      />

      {/* AI Invoice Generator Dialog */}
      <AIInvoiceGeneratorDialog
        open={aiGeneratorOpen}
        onOpenChange={setAiGeneratorOpen}
        onGenerated={fetchInvoices}
      />
    </motion.div>
  );
};

export default Invoices;
