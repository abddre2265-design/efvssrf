import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';

interface UseReservationChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoToInvoice: () => void;
  onAddMore: () => void;
  selectedCount: number;
}

export const UseReservationChoiceDialog: React.FC<UseReservationChoiceDialogProps> = ({
  open,
  onOpenChange,
  onGoToInvoice,
  onAddMore,
  selectedCount,
}) => {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('reservation_action')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t('reservations_selected')}: <span className="font-semibold text-foreground">{selectedCount}</span>
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <Button onClick={onGoToInvoice} className="gap-2 justify-start h-auto py-3">
            <FileText className="h-5 w-5" />
            <div className="text-left">
              <p className="font-medium">{t('go_to_invoice_creation')}</p>
              <p className="text-xs opacity-80">{t('go_to_invoice_creation_desc')}</p>
            </div>
          </Button>

          <Button variant="outline" onClick={onAddMore} className="gap-2 justify-start h-auto py-3">
            <Plus className="h-5 w-5" />
            <div className="text-left">
              <p className="font-medium">{t('add_other_reserved_products')}</p>
              <p className="text-xs opacity-80">{t('add_other_reserved_products_desc')}</p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
