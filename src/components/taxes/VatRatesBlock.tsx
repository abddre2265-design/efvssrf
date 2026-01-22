import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Lock, Loader2, AlertCircle } from 'lucide-react';
import { VatRate, DEFAULT_VAT_RATES } from './types';
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

interface VatRatesBlockProps {
  vatRates: VatRate[];
  organizationId: string;
  onRefresh: () => void;
}

export const VatRatesBlock: React.FC<VatRatesBlockProps> = ({
  vatRates,
  organizationId,
  onRefresh,
}) => {
  const { t, isRTL } = useLanguage();
  const [newRate, setNewRate] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkingUsage, setCheckingUsage] = useState<string | null>(null);
  const [rateInUse, setRateInUse] = useState<{ id: string; inUse: boolean } | null>(null);

  const allRates = [...DEFAULT_VAT_RATES, ...vatRates.filter(v => !v.is_default).map(v => v.rate)].sort((a, b) => a - b);

  const handleAddRate = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error(t('invalid_vat_rate'));
      return;
    }

    if (allRates.includes(rate)) {
      toast.error(t('vat_rate_exists'));
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('vat_rates')
        .insert({
          organization_id: organizationId,
          rate: rate,
          is_default: false,
        });

      if (error) throw error;

      toast.success(t('vat_rate_added'));
      setNewRate('');
      onRefresh();
    } catch (error) {
      console.error('Error adding VAT rate:', error);
      toast.error(t('error_adding_vat_rate'));
    } finally {
      setIsAdding(false);
    }
  };

  const checkRateUsage = async (vatRate: VatRate) => {
    setCheckingUsage(vatRate.id);
    try {
      const { data, error } = await supabase.rpc('is_vat_rate_in_use', { rate_value: vatRate.rate });
      if (error) throw error;

      setRateInUse({ id: vatRate.id, inUse: data as boolean });
      if (data) {
        toast.error(t('vat_rate_in_use'));
      } else {
        setDeletingId(vatRate.id);
      }
    } catch (error) {
      console.error('Error checking VAT rate usage:', error);
      toast.error(t('error_checking_usage'));
    } finally {
      setCheckingUsage(null);
    }
  };

  const handleDeleteRate = async () => {
    if (!deletingId) return;

    try {
      const { error } = await supabase
        .from('vat_rates')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;

      toast.success(t('vat_rate_deleted'));
      onRefresh();
    } catch (error) {
      console.error('Error deleting VAT rate:', error);
      toast.error(t('error_deleting_vat_rate'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('vat_rates')}
        </CardTitle>
        <CardDescription>
          {t('vat_rates_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Default rates */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{t('default_values')}</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_VAT_RATES.map((rate) => (
              <Badge key={rate} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                <Lock className="w-3 h-3" />
                {rate}%
              </Badge>
            ))}
          </div>
        </div>

        {/* Custom rates */}
        {vatRates.filter(v => !v.is_default).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{t('custom_values')}</p>
            <div className="flex flex-wrap gap-2">
              {vatRates.filter(v => !v.is_default).map((vatRate) => (
                <Badge 
                  key={vatRate.id} 
                  variant="outline" 
                  className="flex items-center gap-1 px-3 py-1.5"
                >
                  {vatRate.rate}%
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                    onClick={() => checkRateUsage(vatRate)}
                    disabled={checkingUsage === vatRate.id}
                  >
                    {checkingUsage === vatRate.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : rateInUse?.id === vatRate.id && rateInUse.inUse ? (
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
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder={t('new_vat_rate_placeholder')}
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            className="w-32"
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
                {t('confirm_delete_vat_rate')}
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
