import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Clock } from 'lucide-react';

interface PaymentPromptDialogProps {
  open: boolean;
  onClose: (processPayment: boolean) => void;
  paidAmount: number;
  paymentStatus: string;
}

export const PaymentPromptDialog: React.FC<PaymentPromptDialogProps> = ({
  open,
  onClose,
  paidAmount,
  paymentStatus,
}) => {
  const { t, isRTL } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={() => onClose(false)}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t('process_payment_question')}
          </DialogTitle>
          <DialogDescription>
            {t('payment_detected_description')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('payment_status')}:</span>
              <span className="font-medium capitalize">
                {paymentStatus === 'paid' ? t('paid') : t('partial')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('paid_amount')}:</span>
              <span className="font-mono font-medium">{paidAmount.toFixed(3)} TND</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onClose(false)} className="gap-2">
            <Clock className="h-4 w-4" />
            {t('later')}
          </Button>
          <Button onClick={() => onClose(true)} className="gap-2">
            <CreditCard className="h-4 w-4" />
            {t('process_now')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
