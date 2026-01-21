import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Upload, 
  Users, 
  Search, 
  Package, 
  PackageCheck,
  Calculator, 
  CheckCircle2,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkflowStep = 'upload' | 'supplier' | 'products' | 'product_details' | 'verification' | 'totals' | 'confirm';

interface StepConfig {
  key: WorkflowStep;
  labelKey: string;
  fallbackLabel: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  { key: 'upload', labelKey: 'step_upload', fallbackLabel: 'Upload', icon: Upload },
  { key: 'supplier', labelKey: 'step_supplier', fallbackLabel: 'Fournisseur', icon: Users },
  { key: 'products', labelKey: 'step_analysis', fallbackLabel: 'Analyse', icon: Search },
  { key: 'product_details', labelKey: 'step_details', fallbackLabel: 'Détails', icon: Package },
  { key: 'verification', labelKey: 'step_verification', fallbackLabel: 'Vérification', icon: PackageCheck },
  { key: 'totals', labelKey: 'step_totals', fallbackLabel: 'Totaux', icon: Calculator },
  { key: 'confirm', labelKey: 'step_confirm', fallbackLabel: 'Confirmation', icon: CheckCircle2 },
];

interface WorkflowStepperProps {
  currentStep: WorkflowStep;
  analysisComplete?: boolean;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  analysisComplete = false,
}) => {
  const { t, isRTL } = useLanguage();

  const getStepIndex = (step: WorkflowStep): number => {
    return STEPS.findIndex(s => s.key === step);
  };

  const currentIndex = getStepIndex(currentStep);

  const getStepStatus = (step: StepConfig, index: number): 'completed' | 'current' | 'upcoming' => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full py-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Desktop View */}
      <div className="hidden md:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step, index);
          const Icon = step.icon;
          const isLast = index === STEPS.length - 1;

          return (
            <React.Fragment key={step.key}>
              {/* Step */}
              <div className="flex flex-col items-center gap-2">
                {/* Circle with icon */}
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

                {/* Label */}
                <span
                  className={cn(
                    'text-xs font-medium text-center max-w-[80px] transition-colors',
                    status === 'completed' && 'text-primary',
                    status === 'current' && 'text-primary font-semibold',
                    status === 'upcoming' && 'text-muted-foreground'
                  )}
                >
                  {t(step.labelKey) || step.fallbackLabel}
                </span>
              </div>

              {/* Connector line */}
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

      {/* Mobile View */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t('step') || 'Étape'} {currentIndex + 1} / {STEPS.length}
          </span>
          <span className="text-sm font-semibold text-primary">
            {t(STEPS[currentIndex].labelKey) || STEPS[currentIndex].fallbackLabel}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${((currentIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex justify-between mt-2">
          {STEPS.map((step, index) => {
            const status = getStepStatus(step, index);
            const Icon = step.icon;

            return (
              <div
                key={step.key}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full transition-all',
                  status === 'completed' && 'bg-primary text-primary-foreground',
                  status === 'current' && 'bg-primary/20 text-primary',
                  status === 'upcoming' && 'bg-muted text-muted-foreground'
                )}
              >
                {status === 'completed' ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
