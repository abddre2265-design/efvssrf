import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, BadgePercent } from 'lucide-react';

export type CreditNoteType = 'product' | 'commercial_price';

interface CreditNoteTypeChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: CreditNoteType) => void;
}

export const CreditNoteTypeChoiceDialog: React.FC<CreditNoteTypeChoiceDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('select_credit_note_type')}</DialogTitle>
          <DialogDescription>{t('credit_note_type_description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-auto py-4 px-4"
            onClick={() => onSelect('product')}
          >
            <Package className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-medium">{t('credit_note_product')}</div>
              <div className="text-sm text-muted-foreground">{t('credit_note_product_desc')}</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-auto py-4 px-4"
            onClick={() => onSelect('commercial_price')}
          >
            <BadgePercent className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-medium">{t('credit_note_commercial_price')}</div>
              <div className="text-sm text-muted-foreground">{t('credit_note_commercial_price_desc')}</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
