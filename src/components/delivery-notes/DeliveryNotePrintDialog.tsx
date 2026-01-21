import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DeliveryNotePdfTemplate } from './DeliveryNotePdfTemplate';

interface DeliveryNotePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNoteId: string | null;
}

export const DeliveryNotePrintDialog: React.FC<DeliveryNotePrintDialogProps> = ({
  open,
  onOpenChange,
  deliveryNoteId,
}) => {
  const { t } = useLanguage();
  const [deliveryNote, setDeliveryNote] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!deliveryNoteId) return;
      setIsLoading(true);

      try {
        // Get user's organization
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('user_id', user.id)
          .single();

        setOrganization(orgData);

        // Fetch delivery note with all related data
        const { data: noteData, error: noteError } = await supabase
          .from('delivery_notes')
          .select(`
            *,
            client:clients(*),
            invoice:invoices(id, invoice_number)
          `)
          .eq('id', deliveryNoteId)
          .single();

        if (noteError) throw noteError;

        // Fetch lines with products
        const { data: linesData } = await supabase
          .from('delivery_note_lines')
          .select(`
            *,
            product:products(id, name, reference, ean)
          `)
          .eq('delivery_note_id', deliveryNoteId)
          .order('line_order', { ascending: true });

        // Fetch bank info
        const { data: banksData } = await supabase
          .from('organization_banks')
          .select('*')
          .eq('organization_id', orgData?.id)
          .limit(1);

        setDeliveryNote({
          ...noteData,
          lines: linesData || [],
          bank: banksData?.[0] || null,
        });
      } catch (error) {
        console.error('Error fetching delivery note:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open && deliveryNoteId) {
      fetchData();
    }
  }, [open, deliveryNoteId]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${deliveryNote?.delivery_note_number || 'Bon de livraison'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; }
            @media print {
              @page { size: A4; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('print_delivery_note')}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                {t('print')}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <motion.div
              className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : deliveryNote && organization ? (
          <div ref={printRef}>
            <DeliveryNotePdfTemplate
              deliveryNote={deliveryNote}
              organization={organization}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {t('delivery_note_not_found')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryNotePrintDialog;
