import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { DeliveryNoteTable, DeliveryNoteViewDialog, DeliveryNote } from '@/components/delivery-notes';

const DeliveryNotes: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDeliveryNoteId, setSelectedDeliveryNoteId] = useState<string | null>(null);

  const fetchDeliveryNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!org) return;

      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          *,
          client:clients(id, client_type, first_name, last_name, company_name),
          invoice:invoices(id, invoice_number)
        `)
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliveryNotes(data as DeliveryNote[]);
    } catch (error) {
      console.error('Error fetching delivery notes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveryNotes();
  }, [fetchDeliveryNotes]);

  const handleView = (deliveryNote: DeliveryNote) => {
    setSelectedDeliveryNoteId(deliveryNote.id);
    setViewDialogOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('delivery_notes')}</h1>
            <p className="text-muted-foreground">{t('delivery_notes_description')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchDeliveryNotes}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('refresh')}
        </Button>
      </div>

      {/* Table */}
      <DeliveryNoteTable
        deliveryNotes={deliveryNotes}
        isLoading={isLoading}
        onView={handleView}
      />

      {/* View Dialog */}
      <DeliveryNoteViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        deliveryNoteId={selectedDeliveryNoteId}
      />
    </motion.div>
  );
};

export default DeliveryNotes;
