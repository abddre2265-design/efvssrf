import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PasswordConfirmDialog } from './PasswordConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InvoiceRequest } from './types';

type WorkflowStep = 'extra_balance' | 'validate' | 'payment' | 'deliver' | 'done';

interface PostInvoiceWorkflowDialogProps {
  open: boolean;
  onClose: () => void;
  request: InvoiceRequest;
  invoiceId: string;
  clientId: string;
  organizationId: string;
}

export const PostInvoiceWorkflowDialog: React.FC<PostInvoiceWorkflowDialogProps> = ({
  open,
  onClose,
  request,
  invoiceId,
  clientId,
  organizationId,
}) => {
  const { t } = useLanguage();
  const netPayable = request.net_payable || request.total_ttc;
  const extraAmount = Math.max(0, request.paid_amount - netPayable);
  const hasExtra = extraAmount > 0.001;

  // Determine initial step
  const getInitialStep = (): WorkflowStep => {
    if (hasExtra) return 'extra_balance';
    return 'validate';
  };

  const [currentStep, setCurrentStep] = useState<WorkflowStep>(getInitialStep());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirmAction, setIsConfirmAction] = useState(false);

  // Sync open state
  React.useEffect(() => {
    if (open) {
      const step = getInitialStep();
      setCurrentStep(step);
      setConfirmOpen(true);
    }
  }, [open]);

  const handleExtraBalanceYes = async () => {
    try {
      // Get current client balance
      const { data: client } = await supabase
        .from('clients')
        .select('account_balance')
        .eq('id', clientId)
        .single();

      const currentBalance = client?.account_balance || 0;
      const newBalance = currentBalance + extraAmount;

      // Update client balance
      await supabase
        .from('clients')
        .update({ account_balance: newBalance })
        .eq('id', clientId);

      // Create account movement
      await supabase
        .from('client_account_movements')
        .insert({
          client_id: clientId,
          organization_id: organizationId,
          movement_type: 'credit',
          amount: extraAmount,
          balance_after: newBalance,
          source_type: 'invoice_request_extra',
          source_id: request.id,
          notes: `Solde extra - Demande ${request.request_number}`,
        });

      toast.success(t('balance_added_success'));
    } catch (error: any) {
      console.error('Error adding balance:', error);
      toast.error(error.message);
    }
    setCurrentStep('validate');
    setConfirmOpen(true);
  };

  const handleExtraBalanceNo = () => {
    setCurrentStep('validate');
    setConfirmOpen(true);
  };

  const handleValidateYes = async () => {
    try {
      await supabase
        .from('invoices')
        .update({ status: 'validated' })
        .eq('id', invoiceId);

      toast.success(t('invoice_validated_success'));
    } catch (error: any) {
      console.error('Error validating invoice:', error);
      toast.error(error.message);
    }

    // If payment data exists, show payment step
    if (request.payment_status !== 'unpaid' && request.paid_amount > 0) {
      setCurrentStep('payment');
      setConfirmOpen(true);
    } else {
      finish();
    }
  };

  const handleValidateNo = () => {
    // Invoice stays as 'created'
    finish();
  };

  const handlePaymentYes = async () => {
    try {
      // Determine payment methods from request
      const paymentMethods = request.payment_methods || [];
      const netPayableVal = request.net_payable || request.total_ttc;
      const effectivePaidAmount = Math.min(request.paid_amount, netPayableVal);

      if (paymentMethods.length > 0) {
        // Create payments for each method
        for (const pm of paymentMethods) {
          const amount = Math.min(pm.amount, netPayableVal);
          await supabase
            .from('payments')
            .insert({
              invoice_id: invoiceId,
              amount: amount,
              net_amount: amount,
              payment_method: pm.method,
              payment_date: request.purchase_date,
              withholding_amount: 0,
              withholding_rate: 0,
            });
        }
      } else {
        // Single payment
        await supabase
          .from('payments')
          .insert({
            invoice_id: invoiceId,
            amount: effectivePaidAmount,
            net_amount: effectivePaidAmount,
            payment_method: 'cash',
            payment_date: request.purchase_date,
            withholding_amount: 0,
            withholding_rate: 0,
          });
      }

      // Update invoice payment status
      const paymentStatus = effectivePaidAmount >= netPayableVal ? 'paid' : 'partial';
      await supabase
        .from('invoices')
        .update({ 
          paid_amount: effectivePaidAmount, 
          payment_status: paymentStatus 
        })
        .eq('id', invoiceId);

      toast.success(t('payment_recorded_success'));
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message);
    }

    setCurrentStep('deliver');
    setConfirmOpen(true);
  };

  const handlePaymentNo = () => {
    // Invoice stays validated without payment
    finish();
  };

  const handleDeliverYes = () => {
    // Navigate to delivery note creation
    finish();
    window.location.href = `/dashboard/invoices?openDelivery=${invoiceId}`;
  };

  const handleDeliverNo = () => {
    finish();
  };

  const finish = () => {
    setCurrentStep('done');
    setConfirmOpen(false);
    onClose();
  };

  const getStepConfig = () => {
    switch (currentStep) {
      case 'extra_balance':
        return {
          title: t('confirm_extra_balance_title'),
          description: `${t('confirm_extra_balance_description')}\n\n${t('extra_amount_to_add')}: ${extraAmount.toFixed(3)} TND`,
          confirmText: t('add_to_balance'),
          onConfirm: handleExtraBalanceYes,
          onSkip: handleExtraBalanceNo,
          variant: 'default' as const,
        };
      case 'validate':
        return {
          title: t('confirm_validate_invoice_title'),
          description: t('confirm_validate_invoice_description'),
          confirmText: t('yes_continue'),
          onConfirm: handleValidateYes,
          onSkip: handleValidateNo,
          variant: 'default' as const,
        };
      case 'payment':
        return {
          title: t('confirm_pay_invoice_title'),
          description: `${t('confirm_pay_invoice_description')}\n\n${t('paid_amount')}: ${request.paid_amount.toFixed(3)} TND`,
          confirmText: t('yes_continue'),
          onConfirm: handlePaymentYes,
          onSkip: handlePaymentNo,
          variant: 'default' as const,
        };
      case 'deliver':
        return {
          title: t('confirm_deliver_invoice_title'),
          description: t('confirm_deliver_invoice_description'),
          confirmText: t('yes_continue'),
          onConfirm: handleDeliverYes,
          onSkip: handleDeliverNo,
          variant: 'default' as const,
        };
      default:
        return null;
    }
  };

  const config = getStepConfig();

  if (!config || !open) return null;

  return (
    <>
      <PasswordConfirmDialog
        open={confirmOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            config.onSkip();
          }
          setConfirmOpen(isOpen);
        }}
        onConfirm={config.onConfirm}
        title={config.title}
        description={config.description}
        confirmText={config.confirmText}
        variant={config.variant}
      />
    </>
  );
};
