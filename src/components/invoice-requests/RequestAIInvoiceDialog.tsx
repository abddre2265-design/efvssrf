import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Construction } from 'lucide-react';
import { InvoiceRequest } from './types';

interface RequestAIInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: InvoiceRequest;
  onCreated: () => void;
}

export const RequestAIInvoiceDialog: React.FC<RequestAIInvoiceDialogProps> = ({
  open,
  onOpenChange,
  request,
  onCreated,
}) => {
  const { t, isRTL } = useLanguage();

  // TODO: Full implementation similar to AIInvoiceGeneratorDialog
  // For now, show a placeholder
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('ai_generation')}
          </DialogTitle>
        </DialogHeader>

        <div className="py-8 text-center space-y-4">
          <Construction className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            {t('ai_generation_desc')} - {t('from_request')}: #{request.request_number}
          </p>
          <p className="text-sm text-muted-foreground">
            TTC: {request.total_ttc.toFixed(3)} TND
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
