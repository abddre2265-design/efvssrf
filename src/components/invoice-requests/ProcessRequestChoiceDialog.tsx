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
import { FileText, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProcessRequestChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseStandard: () => void;
  onChooseAI: () => void;
}

export const ProcessRequestChoiceDialog: React.FC<ProcessRequestChoiceDialogProps> = ({
  open,
  onOpenChange,
  onChooseStandard,
  onChooseAI,
}) => {
  const { t, isRTL } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{t('choose_creation_method')}</DialogTitle>
          <DialogDescription>
            {t('choose_creation_method_description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-full h-32 flex flex-col gap-3 hover:bg-primary/5 hover:border-primary"
              onClick={onChooseStandard}
            >
              <FileText className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold">{t('standard_creation')}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('standard_creation_desc')}
                </div>
              </div>
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-full h-32 flex flex-col gap-3 hover:bg-accent/10 hover:border-accent"
              onClick={onChooseAI}
            >
              <Sparkles className="h-8 w-8 text-accent animate-pulse" />
              <div className="text-center">
                <div className="font-semibold">{t('ai_generation')}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('ai_generation_desc')}
                </div>
              </div>
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
