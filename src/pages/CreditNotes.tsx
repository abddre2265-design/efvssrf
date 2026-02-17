import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { CreditNoteTable, CreditNoteViewDialog, CreditNote } from '@/components/credit-notes';
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

  const handleDeleteRequest = (cn: CreditNote) => {
    setCreditNoteToDelete(cn);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!creditNoteToDelete) return;
    try {
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
      />

      <CreditNoteViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        creditNoteId={selectedCreditNoteId}
      />

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
    </motion.div>
  );
};

export default CreditNotes;
