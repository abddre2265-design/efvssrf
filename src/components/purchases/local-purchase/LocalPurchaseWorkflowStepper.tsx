import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Upload, 
  Users, 
  Search, 
  Package, 
  Calculator, 
  Tags,
  CheckCircle2,
  Check,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocalPurchaseWorkflowStep } from './types';

interface StepConfig {
  key: LocalPurchaseWorkflowStep;
  label: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  { key: 'transfer', label: 'Transfert', icon: Upload },
  { key: 'supplier', label: 'Fournisseur', icon: Users },
  { key: 'currency', label: 'Devise', icon: Globe },
  { key: 'products', label: 'Analyse', icon: Search },
  { key: 'product_details', label: 'Détails', icon: Package },
  { key: 'totals', label: 'Totaux', icon: Calculator },
  { key: 'family', label: 'Famille', icon: Tags },
  { key: 'complete', label: 'Terminé', icon: CheckCircle2 },
];

interface LocalPurchaseWorkflowStepperProps {
  currentStep: LocalPurchaseWorkflowStep;
}

export const LocalPurchaseWorkflowStepper: React.FC<LocalPurchaseWorkflowStepperProps> = ({
  currentStep,
}) => {
  const { t, isRTL } = useLanguage();

  const getStepIndex = (step: LocalPurchaseWorkflowStep): number => {
    return STEPS.findIndex(s => s.key === step);
  };

  const currentIndex = getStepIndex(currentStep);

  const getStepStatus = (index: number): 'completed' | 'current' | 'upcoming' => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full py-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Desktop View */}
      <div className="hidden md:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const Icon = step.icon;
          const isLast = index === STEPS.length - 1;

          return (
            <React.Fragment key={step.key}>
              {/* Step */}
              <div className="flex flex-col items-center gap-2">
                {/* Circle with icon */}
                <div
                  className={cn(
                    'relative flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300',
                    status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                    status === 'current' && 'bg-primary/10 border-primary text-primary animate-pulse',
                    status === 'upcoming' && 'bg-muted border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] font-medium text-center max-w-[60px] transition-colors',
                    status === 'completed' && 'text-primary',
                    status === 'current' && 'text-primary font-semibold',
                    status === 'upcoming' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-1 h-0.5 relative">
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
            Étape {currentIndex + 1} / {STEPS.length}
          </span>
          <span className="text-sm font-semibold text-primary">
            {STEPS[currentIndex].label}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${((currentIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
