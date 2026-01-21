import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Sparkles, ArrowRight } from 'lucide-react';
import { Client } from './types';

interface CreateInvoiceChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onChooseStandard: () => void;
  onChooseAI: () => void;
}

export const CreateInvoiceChoiceDialog: React.FC<CreateInvoiceChoiceDialogProps> = ({
  open,
  onOpenChange,
  client,
  onChooseStandard,
  onChooseAI,
}) => {
  const { t, isRTL } = useLanguage();

  const getClientName = (c: Client): string => {
    if (c.company_name) return c.company_name;
    return `${c.first_name || ''} ${c.last_name || ''}`.trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('create_invoice')}
          </DialogTitle>
          {client && (
            <p className="text-sm text-muted-foreground">
              {t('for_client')}: <span className="font-medium text-foreground">{getClientName(client)}</span>
            </p>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Card 
            className="cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            onClick={onChooseStandard}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                {t('standard_creation')}
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t('standard_creation_description')}
              </CardDescription>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            onClick={onChooseAI}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                {t('ai_generation')}
                <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {t('ai_generation_description')}
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
