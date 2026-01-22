import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Lock, Loader2, AlertCircle } from 'lucide-react';
import { WithholdingRate, DEFAULT_WITHHOLDING_RATES } from './types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WithholdingRatesBlockProps {
  withholdingRates: WithholdingRate[];
  organizationId: string;
  onRefresh: () => void;
}

export const WithholdingRatesBlock: React.FC<WithholdingRatesBlockProps> = ({
  withholdingRates,
  organizationId,
  onRefresh,
}) => {
  const { t, isRTL } = useLanguage();
  const [newRate, setNewRate] = useState('');
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkingUsage, setCheckingUsage] = useState<string | null>(null);
  const [rateInUse, setRateInUse] = useState<{ id: string; inUse: boolean } | null>(null);

  const allRates = [...DEFAULT_WITHHOLDING_RATES, ...withholdingRates.filter(w => !w.is_default).map(w => w.rate)].sort((a, b) => a - b);

  const handleAddRate = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error(t('invalid_withholding_rate'));
      return;
    }

    if (allRates.includes(rate)) {
      toast.error(t('withholding_rate_exists'));
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('withholding_rates')
        .insert({
          organization_id: organizationId,
          rate: rate,
          name: newName || null,
          is_default: false,
        });

      if (error) throw error;

      toast.success(t('withholding_rate_added'));
      setNewRate('');
      setNewName('');
      onRefresh();
    } catch (error) {
      console.error('Error adding withholding rate:', error);
      toast.error(t('error_adding_withholding_rate'));
    } finally {
      setIsAdding(false);
    }
  };

  const checkRateUsage = async (whRate: WithholdingRate) => {
    setCheckingUsage(whRate.id);
    try {
      const { data, error } = await supabase.rpc('is_withholding_rate_in_use', { rate_value: whRate.rate });
      if (error) throw error;

      setRateInUse({ id: whRate.id, inUse: data as boolean });
      if (data) {
        toast.error(t('withholding_rate_in_use'));
      } else {
        setDeletingId(whRate.id);
      }
    } catch (error) {
      console.error('Error checking withholding rate usage:', error);
      toast.error(t('error_checking_usage'));
    } finally {
      setCheckingUsage(null);
    }
  };

  const handleDeleteRate = async () => {
    if (!deletingId) return;

    try {
      const { error } = await supabase
        .from('withholding_rates')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;

      toast.success(t('withholding_rate_deleted'));
      onRefresh();
    } catch (error) {
      console.error('Error deleting withholding rate:', error);
      toast.error(t('error_deleting_withholding_rate'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('withholding_rates')}
        </CardTitle>
        <CardDescription>
          {t('withholding_rates_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Default rates */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{t('default_values')}</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_WITHHOLDING_RATES.map((rate) => (
              <Badge key={rate} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                <Lock className="w-3 h-3" />
                {rate}%
              </Badge>
            ))}
          </div>
        </div>

        {/* Custom rates */}
        {withholdingRates.filter(w => !w.is_default).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{t('custom_values')}</p>
            <div className="flex flex-wrap gap-2">
              {withholdingRates.filter(w => !w.is_default).map((whRate) => (
                <Badge 
                  key={whRate.id} 
                  variant="outline" 
                  className="flex items-center gap-1 px-3 py-1.5"
                >
                  {whRate.rate}%{whRate.name && ` (${whRate.name})`}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                    onClick={() => checkRateUsage(whRate)}
                    disabled={checkingUsage === whRate.id}
                  >
                    {checkingUsage === whRate.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : rateInUse?.id === whRate.id && rateInUse.inUse ? (
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                    ) : (
                      <Trash2 className="w-3 h-3 text-destructive" />
                    )}
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Add new rate */}
        <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder={t('rate_percent')}
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            className="w-24"
          />
          <Input
            type="text"
            placeholder={t('name_optional')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-40"
          />
          <Button
            onClick={handleAddRate}
            disabled={isAdding || !newRate}
            size="sm"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t('add')}
          </Button>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirm_delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('confirm_delete_withholding_rate')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteRate} className="bg-destructive text-destructive-foreground">
                {t('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
