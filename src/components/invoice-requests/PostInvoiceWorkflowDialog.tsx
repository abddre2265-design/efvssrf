import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PasswordConfirmDialog } from './PasswordConfirmDialog';
import { RejectRequestDialog } from './RejectRequestDialog';
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

  const getInitialStep = (): WorkflowStep => {
    if (hasExtra) return 'extra_balance';
    return 'validate';
  };

  const [currentStep, setCurrentStep] = useState<WorkflowStep>(getInitialStep());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirmAction, setIsConfirmAction] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  React.useEffect(() => {
    if (open) {
      const step = getInitialStep();
      setCurrentStep(step);
      setIsConfirmAction(false);
      setRejectDialogOpen(false);
      setConfirmOpen(true);
    }
  }, [open]);

  // When user says "No" at any step: delete the invoice, revert request, show rejection dialog
  const handleReject = async () => {
    try {
      // Delete invoice lines first
      await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId);
      // Delete any payments created
      await supabase.from('payments').delete().eq('invoice_id', invoiceId);
      // Delete the invoice
      await supabase.from('invoices').delete().eq('id', invoiceId);
      // Revert request status to pending (will be set to rejected by RejectRequestDialog)
      await supabase
        .from('invoice_requests')
        .update({ status: 'pending', generated_invoice_id: null })
        .eq('id', request.id);
    } catch (error: any) {
      console.error('Error reverting invoice:', error);
      toast.error(error.message);
    }
    setConfirmOpen(false);
    setRejectDialogOpen(true);
  };

  const handleRejected = () => {
    setRejectDialogOpen(false);
    onClose();
  };

  const handleRejectDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
      // User cancelled reject dialog — still close, request reverted to pending
      setRejectDialogOpen(false);
      onClose();
    }
  };

  const handleExtraBalanceYes = async () => {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('account_balance')
        .eq('id', clientId)
        .single();

      const currentBalance = client?.account_balance || 0;
      const newBalance = currentBalance + extraAmount;

      await supabase
        .from('clients')
        .update({ account_balance: newBalance })
        .eq('id', clientId);

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

    if (request.payment_status !== 'unpaid' && request.paid_amount > 0) {
      setCurrentStep('payment');
      setConfirmOpen(true);
    } else {
      finish();
    }
  };

  const handlePaymentYes = async () => {
    try {
      const paymentMethods = request.payment_methods || [];
      const netPayableVal = request.net_payable || request.total_ttc;
      const effectivePaidAmount = Math.min(request.paid_amount, netPayableVal);

      if (paymentMethods.length > 0) {
        for (const pm of paymentMethods) {
          const amount = Math.min(pm.amount, netPayableVal);
          await supabase.from('payments').insert({
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
        await supabase.from('payments').insert({
          invoice_id: invoiceId,
          amount: effectivePaidAmount,
          net_amount: effectivePaidAmount,
          payment_method: 'cash',
          payment_date: request.purchase_date,
          withholding_amount: 0,
          withholding_rate: 0,
        });
      }

      const paymentStatus = effectivePaidAmount >= netPayableVal ? 'paid' : 'partial';
      await supabase
        .from('invoices')
        .update({ paid_amount: effectivePaidAmount, payment_status: paymentStatus })
        .eq('id', invoiceId);

      toast.success(t('payment_recorded_success'));
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message);
    }

    setCurrentStep('deliver');
    setConfirmOpen(true);
  };

  const handleDeliverYes = () => {
    finish();
    window.location.href = `/dashboard/invoices?openDelivery=${invoiceId}`;
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
          onSkip: handleReject,
        };
      case 'validate':
        return {
          title: t('confirm_validate_invoice_title'),
          description: t('confirm_validate_invoice_description'),
          confirmText: t('yes_continue'),
          onConfirm: handleValidateYes,
          onSkip: handleReject,
        };
      case 'payment':
        return {
          title: t('confirm_pay_invoice_title'),
          description: `${t('confirm_pay_invoice_description')}\n\n${t('paid_amount')}: ${request.paid_amount.toFixed(3)} TND`,
          confirmText: t('yes_continue'),
          onConfirm: handlePaymentYes,
          onSkip: handleReject,
        };
      case 'deliver':
        return {
          title: t('confirm_deliver_invoice_title'),
          description: t('confirm_deliver_invoice_description'),
          confirmText: t('yes_continue'),
          onConfirm: handleDeliverYes,
          onSkip: handleReject,
        };
      default:
        return null;
    }
  };

  const config = getStepConfig();

  if (!open) return null;

  // Show rejection dialog
  if (rejectDialogOpen) {
    return (
      <RejectRequestDialog
        open={rejectDialogOpen}
        onOpenChange={handleRejectDialogClose}
        requestId={request.id}
        onRejected={handleRejected}
      />
    );
  }

  if (!config) return null;

  return (
    <PasswordConfirmDialog
      open={confirmOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          if (isConfirmAction) {
            setIsConfirmAction(false);
            return;
          }
          config.onSkip();
          return;
        }
        setConfirmOpen(true);
      }}
      onConfirm={async () => {
        setIsConfirmAction(true);
        await config.onConfirm();
      }}
      title={config.title}
      description={config.description}
      confirmText={config.confirmText}
      variant="default"
    />
  );
};
