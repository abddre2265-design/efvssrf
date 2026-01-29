import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, X, FileText, Check, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CustomsReceiptWorkflowStep,
  CustomsReceiptData,
  PendingUploadForCustomsReceipt,
} from './types';
import { CustomsReceiptOCRStep } from './CustomsReceiptOCRStep';
import { CustomsReceiptValidationStep } from './CustomsReceiptValidationStep';
import { CustomsReceiptCompletionStep } from './CustomsReceiptCompletionStep';

interface CustomsReceiptWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUpload: PendingUploadForCustomsReceipt;
  organizationId: string;
  onComplete: () => void;
}

const STEPS: { key: CustomsReceiptWorkflowStep; label: string; icon: React.ElementType }[] = [
  { key: 'extraction', label: 'Extraction', icon: FileText },
  { key: 'validation', label: 'Validation', icon: ClipboardCheck },
  { key: 'complete', label: 'Terminé', icon: CheckCircle2 },
];

export const CustomsReceiptWorkflowDialog: React.FC<CustomsReceiptWorkflowDialogProps> = ({
  open,
  onOpenChange,
  pendingUpload,
  organizationId,
  onComplete,
}) => {
  const { isRTL } = useLanguage();
  const [currentStep, setCurrentStep] = useState<CustomsReceiptWorkflowStep>('extraction');
  const [extractedData, setExtractedData] = useState<CustomsReceiptData | null>(null);
  const [validatedData, setValidatedData] = useState<CustomsReceiptData | null>(null);

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);

  const handleExtractionComplete = (data: CustomsReceiptData) => {
    setExtractedData(data);
    setCurrentStep('validation');
  };

  const handleValidationComplete = (data: CustomsReceiptData) => {
    setValidatedData(data);
    setCurrentStep('complete');
  };

  const handleComplete = (receiptId: string) => {
    onComplete();
    onOpenChange(false);
  };

  const handleClose = () => {
    if (currentStep !== 'extraction') {
      if (!confirm('Voulez-vous vraiment fermer ? Les données non sauvegardées seront perdues.')) {
        return;
      }
    }
    onOpenChange(false);
  };

  const goToPreviousStep = () => {
    if (currentStep === 'validation') {
      setCurrentStep('extraction');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0 flex flex-row items-center justify-between border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            Traitement quittance douanière
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Stepper */}
        <div className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const status = index < currentStepIndex 
                ? 'completed' 
                : index === currentStepIndex 
                  ? 'current' 
                  : 'upcoming';
              const Icon = step.icon;
              const isLast = index === STEPS.length - 1;

              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        'relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                        status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                        status === 'current' && 'bg-primary/10 border-primary text-primary animate-pulse',
                        status === 'upcoming' && 'bg-muted border-muted-foreground/30 text-muted-foreground'
                      )}
                    >
                      {status === 'completed' ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium transition-colors',
                        status === 'completed' && 'text-primary',
                        status === 'current' && 'text-primary font-semibold',
                        status === 'upcoming' && 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>

                  {!isLast && (
                    <div className="flex-1 mx-2 h-0.5 relative">
                      <div className="absolute inset-0 bg-muted-foreground/20 rounded-full" />
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500',
                          status === 'completed' ? 'w-full' : 'w-0'
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-6 py-4">
              {currentStep === 'extraction' && (
                <CustomsReceiptOCRStep
                  pendingUpload={pendingUpload}
                  onExtractionComplete={handleExtractionComplete}
                />
              )}

              {currentStep === 'validation' && extractedData && (
                <CustomsReceiptValidationStep
                  extractedData={extractedData}
                  importFolderNumber={pendingUpload.import_folder_number || '—'}
                  onValidate={handleValidationComplete}
                />
              )}

              {currentStep === 'complete' && validatedData && (
                <CustomsReceiptCompletionStep
                  validatedData={validatedData}
                  organizationId={organizationId}
                  importFolderId={pendingUpload.import_folder_id!}
                  importFolderNumber={pendingUpload.import_folder_number || '—'}
                  pendingUploadId={pendingUpload.id}
                  storagePath={pendingUpload.storage_path}
                  onComplete={handleComplete}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        {currentStep === 'validation' && (
          <div className="px-6 py-4 border-t bg-background flex-shrink-0">
            <Button variant="outline" onClick={goToPreviousStep} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
