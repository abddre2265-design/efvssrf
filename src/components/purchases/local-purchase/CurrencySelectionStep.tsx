import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DollarSign,
  ArrowRightLeft,
  Loader2,
  ChevronRight,
  RefreshCw,
  Globe
} from 'lucide-react';

// Common currencies with symbols
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dollar US' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Livre Sterling' },
  { code: 'CNY', symbol: '¥', name: 'Yuan Chinois' },
  { code: 'JPY', symbol: '¥', name: 'Yen Japonais' },
  { code: 'AED', symbol: 'د.إ', name: 'Dirham Emirati' },
  { code: 'SAR', symbol: 'ر.س', name: 'Riyal Saoudien' },
  { code: 'MAD', symbol: 'د.م', name: 'Dirham Marocain' },
  { code: 'DZD', symbol: 'د.ج', name: 'Dinar Algérien' },
  { code: 'LYD', symbol: 'ل.د', name: 'Dinar Libyen' },
  { code: 'TRY', symbol: '₺', name: 'Lire Turque' },
  { code: 'CHF', symbol: 'CHF', name: 'Franc Suisse' },
  { code: 'CAD', symbol: 'C$', name: 'Dollar Canadien' },
];

// Default exchange rates
const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 3.10,
  EUR: 3.40,
  GBP: 3.95,
  CNY: 0.43,
  JPY: 0.021,
  AED: 0.84,
  SAR: 0.83,
  MAD: 0.31,
  DZD: 0.023,
  LYD: 0.64,
  TRY: 0.096,
  CHF: 3.55,
  CAD: 2.30,
};

interface CurrencySelectionStepProps {
  organizationId: string;
  defaultCurrency?: string;
  onCurrencyConfirmed: (currency: string, exchangeRate: number) => void;
}

export const CurrencySelectionStep: React.FC<CurrencySelectionStepProps> = ({
  organizationId,
  defaultCurrency = 'USD',
  onCurrencyConfirmed,
}) => {
  const { t, isRTL } = useLanguage();
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATES[defaultCurrency] || 1.0);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(String(exchangeRate));
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false);
  const [savedExchangeRates, setSavedExchangeRates] = useState<Record<string, number>>({});

  // Load saved exchange rates from database
  useEffect(() => {
    const loadExchangeRates = async () => {
      try {
        const { data, error } = await supabase
          .from('exchange_rates')
          .select('from_currency, rate')
          .eq('organization_id', organizationId);

        if (error) throw error;

        const rates: Record<string, number> = {};
        (data || []).forEach((r: { from_currency: string; rate: number }) => {
          rates[r.from_currency] = r.rate;
        });
        setSavedExchangeRates(rates);
        
        // Update exchange rate if we have a saved one for the current currency
        if (rates[currency]) {
          setExchangeRate(rates[currency]);
          setExchangeRateInput(rates[currency].toFixed(4));
        }
      } catch (error) {
        console.error('Error loading exchange rates:', error);
      }
    };

    loadExchangeRates();
  }, [organizationId]);

  // Update exchange rate when currency changes
  useEffect(() => {
    const rate = savedExchangeRates[currency] || DEFAULT_EXCHANGE_RATES[currency] || 1.0;
    setExchangeRate(rate);
    setExchangeRateInput(rate.toFixed(4));
  }, [currency, savedExchangeRates]);

  const handleExchangeRateChange = (value: string) => {
    setExchangeRateInput(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setExchangeRate(numValue);
    }
  };

  const handleSaveExchangeRate = async () => {
    setLoadingExchangeRate(true);
    try {
      // Check if rate exists
      const { data: existing } = await supabase
        .from('exchange_rates')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('from_currency', currency)
        .single();

      if (existing) {
        // Update existing rate
        const { error } = await supabase
          .from('exchange_rates')
          .update({ rate: exchangeRate, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new rate
        const { error } = await supabase
          .from('exchange_rates')
          .insert({
            organization_id: organizationId,
            from_currency: currency,
            to_currency: 'TND',
            rate: exchangeRate,
          });

        if (error) throw error;
      }

      setSavedExchangeRates(prev => ({ ...prev, [currency]: exchangeRate }));
      toast.success(t('exchange_rate_saved') || 'Taux de change enregistré');
    } catch (error) {
      console.error('Error saving exchange rate:', error);
      toast.error(t('error_saving_exchange_rate') || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoadingExchangeRate(false);
    }
  };

  const handleConfirm = () => {
    onCurrencyConfirmed(currency, exchangeRate);
  };

  const getCurrencySymbol = (code: string): string => {
    return CURRENCIES.find(c => c.code === code)?.symbol || code;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t('currency_selection') || 'Sélection de la devise'}
        </CardTitle>
        <CardDescription>
          {t('currency_selection_description') || 'Sélectionnez la devise de la facture fournisseur étranger'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Supplier type badge */}
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/10 text-primary border-primary/30 gap-2">
            <Globe className="h-3 w-3" />
            {t('foreign_supplier') || 'Fournisseur étranger'}
          </Badge>
        </div>

        {/* Currency and Exchange Rate */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            {t('currency_and_exchange') || 'Devise et taux de change'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Currency Selection */}
            <div className="space-y-2">
              <Label>{t('document_currency') || 'Devise du document'}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono">{curr.symbol}</span>
                        <span>{curr.code}</span>
                        <span className="text-muted-foreground">- {curr.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exchange Rate */}
            <div className="space-y-2">
              <Label>{t('exchange_rate_to_tnd') || 'Taux de change vers TND'}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={exchangeRateInput}
                    onChange={(e) => handleExchangeRateChange(e.target.value)}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    TND/{currency}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSaveExchangeRate}
                  disabled={loadingExchangeRate}
                  title={t('save_rate') || 'Enregistrer le taux'}
                >
                  {loadingExchangeRate ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                1 {currency} = {exchangeRate.toFixed(4)} TND
              </p>
            </div>
          </div>

          {/* Conversion Preview */}
          <div className="mt-4 p-3 bg-background rounded-md border">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <ArrowRightLeft className="h-4 w-4" />
              {t('conversion_example') || 'Exemple de conversion'}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('amount_in_foreign') || 'Montant en devise'}</p>
                <p className="font-medium">1,000.00 {getCurrencySymbol(currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('equivalent_tnd') || 'Équivalent TND'}</p>
                <p className="text-primary font-semibold">
                  {(1000 * exchangeRate).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm button */}
        <div className="flex justify-end">
          <Button onClick={handleConfirm} className="gap-2">
            {t('confirm_and_continue') || 'Confirmer et continuer'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
