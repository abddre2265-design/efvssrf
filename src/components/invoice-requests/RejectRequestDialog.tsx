import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RejectRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  onRejected: () => void;
}

export const RejectRequestDialog: React.FC<RejectRequestDialogProps> = ({
  open,
  onOpenChange,
  requestId,
  onRejected,
}) => {
  const { t, isRTL } = useLanguage();
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [reasonError, setReasonError] = useState('');

  const handleReject = async () => {
    if (!reason.trim()) {
      setReasonError(t('rejection_reason_mandatory'));
      return;
    }
    if (!password) {
      setError(t('password_required'));
      return;
    }

    setIsVerifying(true);
    setError('');
    setReasonError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError(t('user_not_found'));
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (signInError) {
        setError(t('invalid_password'));
        return;
      }

      const { error: updateError } = await supabase
        .from('invoice_requests')
        .update({ status: 'rejected', rejection_reason: reason.trim() })
        .eq('id', requestId);

      if (updateError) throw updateError;

      toast.success(t('request_rejected_success'));
      onRejected();
      handleClose();
    } catch (err: any) {
      setError(err.message || t('verification_error'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setPassword('');
    setError('');
    setReasonError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('confirm_reject_request')}
          </DialogTitle>
          <DialogDescription>{t('confirm_reject_request_description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason" className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-destructive" />
              {t('rejection_reason_input')} *
            </Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError('');
              }}
              placeholder={t('rejection_reason_input_placeholder')}
              rows={3}
            />
            {reasonError && (
              <p className="text-sm text-destructive">{reasonError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('enter_password_to_confirm')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder={t('password')}
              onKeyDown={(e) => e.key === 'Enter' && handleReject()}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isVerifying || !password || !reason.trim()}
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('verifying')}
              </>
            ) : (
              t('reject')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
