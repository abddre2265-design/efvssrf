import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { StampDutySetting, DEFAULT_STAMP_DUTY } from './types';

interface StampDutyBlockProps {
  stampDuty: StampDutySetting | null;
  organizationId: string;
  onRefresh: () => void;
}

export const StampDutyBlock: React.FC<StampDutyBlockProps> = ({
  stampDuty,
  organizationId,
  onRefresh,
}) => {
  const { t, isRTL } = useLanguage();
  const [amount, setAmount] = useState<string>(String(stampDuty?.amount || DEFAULT_STAMP_DUTY));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAmount(String(stampDuty?.amount || DEFAULT_STAMP_DUTY));
  }, [stampDuty]);

  const handleSave = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value < 0) {
      toast.error(t('invalid_stamp_duty_amount'));
      return;
    }

    setIsSaving(true);
    try {
      if (stampDuty) {
        // Update existing
        const { error } = await supabase
          .from('stamp_duty_settings')
          .update({ amount: value })
          .eq('id', stampDuty.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('stamp_duty_settings')
          .insert({
            organization_id: organizationId,
            amount: value,
          });

        if (error) throw error;
      }

      toast.success(t('stamp_duty_saved'));
      onRefresh();
    } catch (error) {
      console.error('Error saving stamp duty:', error);
      toast.error(t('error_saving_stamp_duty'));
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanged = parseFloat(amount) !== (stampDuty?.amount || DEFAULT_STAMP_DUTY);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('stamp_duty')}
        </CardTitle>
        <CardDescription>
          {t('stamp_duty_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32"
            />
            <span className="text-muted-foreground">TND</span>
          </div>
          
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanged}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('save')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('stamp_duty_note')}
        </p>
      </CardContent>
    </Card>
  );
};
