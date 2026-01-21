import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package,
  Globe,
  Building2,
  AlertCircle,
  Loader2,
  ChevronRight,
  RefreshCw,
  DollarSign,
  ArrowRightLeft
} from 'lucide-react';
import { ExtractedProduct, ExtractedTotals } from './types';
import { Supplier } from '@/components/suppliers/types';

// Common currencies with symbols
const CURRENCIES = [
  { code: 'TND', symbol: 'د.ت', name: 'Dinar Tunisien' },
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

// Default exchange rates (approximate - should be updated)
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
  TND: 1.0,
};

interface ProductsAnalysisStepProps {
  extractedProducts: ExtractedProduct[];
  extractedTotals: ExtractedTotals;
  supplierId: string;
  organizationId: string;
  onProductsConfirmed: (products: ExtractedProduct[], currency: string, exchangeRate: number) => void;
}

export const ProductsAnalysisStep: React.FC<ProductsAnalysisStepProps> = ({
  extractedProducts,
  extractedTotals,
  supplierId,
  organizationId,
  onProductsConfirmed,
}) => {
  const { t, isRTL } = useLanguage();
  
  // State
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loadingSupplier, setLoadingSupplier] = useState(true);
  const [currency, setCurrency] = useState<string>(extractedTotals.currency || 'USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>('1.0');
  const [loadingExchangeRate, setLoadingExchangeRate] = useState(false);
  const [savedExchangeRates, setSavedExchangeRates] = useState<Record<string, number>>({});

  const isForeignSupplier = supplier?.supplier_type === 'foreign';
  const isLocalSupplier = !isForeignSupplier;

  // Load supplier info
  useEffect(() => {
    const loadSupplier = async () => {
      setLoadingSupplier(true);
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', supplierId)
          .single();

        if (error) throw error;
        setSupplier(data as Supplier);

        // If local supplier, currency is always TND
        if (data.supplier_type !== 'foreign') {
          setCurrency('TND');
          setExchangeRate(1.0);
          setExchangeRateInput('1.0');
        }
      } catch (error) {
        console.error('Error loading supplier:', error);
        toast.error(t('error_loading_supplier') || 'Erreur de chargement du fournisseur');
      } finally {
        setLoadingSupplier(false);
      }
    };

    loadSupplier();
  }, [supplierId, t]);

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
      } catch (error) {
        console.error('Error loading exchange rates:', error);
      }
    };

    loadExchangeRates();
  }, [organizationId]);

  // Update exchange rate when currency changes
  useEffect(() => {
    if (currency === 'TND') {
      setExchangeRate(1.0);
      setExchangeRateInput('1.0');
      return;
    }

    // First check saved rates, then use defaults
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
    if (currency === 'TND') return;

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

  const handleContinue = () => {
    onProductsConfirmed(extractedProducts, currency, exchangeRate);
  };

  const getCurrencySymbol = (code: string): string => {
    return CURRENCIES.find(c => c.code === code)?.symbol || code;
  };

  // Calculate converted amounts
  const convertedTotalHT = extractedTotals.subtotal_ht * exchangeRate;
  const convertedTotalTTC = extractedTotals.total_ttc * exchangeRate;
  const convertedNetPayable = extractedTotals.net_payable * exchangeRate;

  if (loadingSupplier) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('products_analysis') || 'Analyse des produits'}
        </CardTitle>
        <CardDescription>
          {isForeignSupplier 
            ? (t('foreign_supplier_products_description') || 'Configurez la devise et le taux de change pour ce fournisseur étranger')
            : (t('local_supplier_products_description') || 'Produits extraits du document')
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Supplier Type Badge */}
        <div className="flex items-center gap-3">
          <Badge variant={isForeignSupplier ? 'default' : 'secondary'} className="gap-2">
            {isForeignSupplier ? (
              <>
                <Globe className="h-3 w-3" />
                {t('foreign_supplier') || 'Fournisseur étranger'}
              </>
            ) : (
              <>
                <Building2 className="h-3 w-3" />
                {t('local_supplier') || 'Fournisseur local'}
              </>
            )}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {supplier?.company_name || `${supplier?.first_name} ${supplier?.last_name}`}
          </span>
        </div>

        {/* Currency and Exchange Rate for Foreign Suppliers */}
        {isForeignSupplier && (
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
                    {CURRENCIES.filter(c => c.code !== 'TND').map((curr) => (
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
                <p className="text-xs text-muted-foreground">
                  {t('currency_detected_or_default') || 'Devise détectée ou USD par défaut'}
                </p>
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
                {t('conversion_preview') || 'Aperçu de la conversion'}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('total_ht') || 'Total HT'}</p>
                  <p className="font-medium">
                    {extractedTotals.subtotal_ht.toFixed(2)} {getCurrencySymbol(currency)}
                  </p>
                  <p className="text-primary font-semibold">
                    → {convertedTotalHT.toFixed(3)} TND
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('total_ttc') || 'Total TTC'}</p>
                  <p className="font-medium">
                    {extractedTotals.total_ttc.toFixed(2)} {getCurrencySymbol(currency)}
                  </p>
                  <p className="text-primary font-semibold">
                    → {convertedTotalTTC.toFixed(3)} TND
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('net_payable') || 'Net à payer'}</p>
                  <p className="font-medium">
                    {extractedTotals.net_payable.toFixed(2)} {getCurrencySymbol(currency)}
                  </p>
                  <p className="text-primary font-semibold">
                    → {convertedNetPayable.toFixed(3)} TND
                  </p>
                </div>
              </div>
            </div>

            {/* Foreign supplier VAT info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('foreign_supplier_vat') || 'TVA fournisseur étranger'}</AlertTitle>
              <AlertDescription className="text-sm">
                {t('foreign_supplier_vat_description') || 'Pour les fournisseurs étrangers, la TVA locale de 19% sera appliquée automatiquement. Le timbre fiscal ne s\'applique pas.'}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Local Supplier Info */}
        {isLocalSupplier && (
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">{t('currency') || 'Devise'} :</span>
              <Badge variant="outline">TND - Dinar Tunisien</Badge>
            </div>
          </div>
        )}

        {/* Products Summary */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">{t('extracted_products') || 'Produits extraits'}</span>
            <Badge variant="secondary">{extractedProducts.length}</Badge>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {extractedProducts.map((product, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md text-sm"
              >
                <div className="flex-1">
                  <p className="font-medium truncate">{product.name}</p>
                  {product.reference && (
                    <p className="text-xs text-muted-foreground">Réf: {product.reference}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {product.quantity} × {product.unit_price_ht.toFixed(2)} {getCurrencySymbol(currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    = {product.line_total_ht.toFixed(2)} {getCurrencySymbol(currency)}
                    {isForeignSupplier && (
                      <span className="text-primary ml-1">
                        ({(product.line_total_ht * exchangeRate).toFixed(3)} TND)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Summary */}
        <div className="p-4 border rounded-lg bg-muted/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('total_ht') || 'Total HT'}</p>
              <p className="font-semibold text-lg">
                {isLocalSupplier 
                  ? `${extractedTotals.subtotal_ht.toFixed(3)} TND`
                  : `${convertedTotalHT.toFixed(3)} TND`
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('total_vat') || 'TVA'}</p>
              <p className="font-semibold text-lg">
                {isLocalSupplier 
                  ? `${extractedTotals.total_vat.toFixed(3)} TND`
                  : `${(extractedTotals.total_vat * exchangeRate).toFixed(3)} TND`
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('total_ttc') || 'Total TTC'}</p>
              <p className="font-semibold text-lg">
                {isLocalSupplier 
                  ? `${extractedTotals.total_ttc.toFixed(3)} TND`
                  : `${convertedTotalTTC.toFixed(3)} TND`
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('net_payable') || 'Net à payer'}</p>
              <p className="font-semibold text-lg text-primary">
                {isLocalSupplier 
                  ? `${extractedTotals.net_payable.toFixed(3)} TND`
                  : `${convertedNetPayable.toFixed(3)} TND`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleContinue} className="gap-2">
            {t('continue_to_products_validation') || 'Continuer vers la validation des produits'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
