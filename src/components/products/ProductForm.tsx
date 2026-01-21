import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Wrench, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProductFormData, UNITS, VAT_RATES } from './types';
import { useProductValidation } from './useProductValidation';

interface ProductFormProps {
  initialData?: Partial<ProductFormData>;
  onSubmit: (data: ProductFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isEdit?: boolean;
  isDuplicate?: boolean;
  organizationId?: string | null;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  isEdit = false,
  isDuplicate = false,
  organizationId = null,
}) => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();
  
  // Real-time validation hook
  const { validation, validateField, hasErrors, isValidating } = useProductValidation(organizationId, isEdit);


  const [data, setData] = useState<ProductFormData>({
    reference: initialData?.reference || '',
    ean: isDuplicate ? '' : (initialData?.ean || ''),
    name: isDuplicate ? `${t('copyOf')} ${initialData?.name || ''}` : (initialData?.name || ''),
    productType: initialData?.productType || 'physical',
    vatRate: initialData?.vatRate ?? null,
    priceHt: initialData?.priceHt || '',
    priceTtc: initialData?.priceTtc || '',
    unit: initialData?.unit || '',
    purchaseYear: initialData?.purchaseYear || currentYear,
    maxDiscount: initialData?.maxDiscount || '',
    unlimitedStock: initialData?.unlimitedStock ?? (initialData?.productType === 'service'),
    allowOutOfStockSale: initialData?.allowOutOfStockSale ?? false,
    currentStock: initialData?.currentStock || '',
  });

  const [unitSearch, setUnitSearch] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);

  // Auto-set unlimited stock based on product type
  useEffect(() => {
    if (data.productType === 'service' && !isEdit) {
      setData(prev => ({ ...prev, unlimitedStock: true }));
    } else if (data.productType === 'physical' && !isEdit && !initialData?.unlimitedStock) {
      setData(prev => ({ ...prev, unlimitedStock: false }));
    }
  }, [data.productType, isEdit, initialData?.unlimitedStock]);

  // Calculate prices
  const calculateTTC = (ht: string, vatRate: number | null) => {
    if (!ht || vatRate === null) return '';
    const htNum = parseFloat(ht);
    if (isNaN(htNum)) return '';
    return (htNum * (1 + vatRate / 100)).toFixed(3);
  };

  const calculateHT = (ttc: string, vatRate: number | null) => {
    if (!ttc || vatRate === null) return '';
    const ttcNum = parseFloat(ttc);
    if (isNaN(ttcNum)) return '';
    return (ttcNum / (1 + vatRate / 100)).toFixed(3);
  };

  const handlePriceHtChange = (value: string) => {
    setData(prev => ({
      ...prev,
      priceHt: value,
      priceTtc: calculateTTC(value, prev.vatRate),
    }));
  };

  const handlePriceTtcChange = (value: string) => {
    setData(prev => ({
      ...prev,
      priceTtc: value,
      priceHt: calculateHT(value, prev.vatRate),
    }));
  };

  const handleVatChange = (rate: number) => {
    setData(prev => ({
      ...prev,
      vatRate: rate,
      priceTtc: prev.priceHt ? calculateTTC(prev.priceHt, rate) : prev.priceTtc,
    }));
  };

  const filteredUnits = useMemo(() => {
    if (!unitSearch) return UNITS;
    const search = unitSearch.toLowerCase();
    return UNITS.filter(u => t(u).toLowerCase().includes(search) || u.toLowerCase().includes(search));
  }, [unitSearch, t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!data.name.trim()) {
      return;
    }
    if (data.vatRate === null) {
      return;
    }
    if (!data.priceHt || parseFloat(data.priceHt) < 0) {
      return;
    }
    if (!data.unlimitedStock && data.currentStock === '') {
      return;
    }
    
    onSubmit(data);
  };

  const isPriceDisabled = data.vatRate === null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ScrollArea className="h-[60vh] pr-4">
        <div className="space-y-4">
          {/* Reference & EAN */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {t('reference')}
                {!isEdit && data.reference && (
                  <span className="inline-flex items-center">
                    {validation.reference.isChecking ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : validation.reference.exists ? (
                      <XCircle className="w-3 h-3 text-destructive" />
                    ) : validation.reference.checkedValue === data.reference ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : null}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  value={data.reference}
                  onChange={(e) => {
                    setData(prev => ({ ...prev, reference: e.target.value }));
                    validateField('reference', e.target.value);
                  }}
                  placeholder={t('autoGeneratedIfEmpty')}
                  className={`futuristic-input ${validation.reference.exists ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  disabled={isEdit}
                />
              </div>
              {validation.reference.exists && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {t('productReferenceExists')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {t('eanBarcode')}
                {!isEdit && data.ean && (
                  <span className="inline-flex items-center">
                    {validation.ean.isChecking ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : validation.ean.exists ? (
                      <XCircle className="w-3 h-3 text-destructive" />
                    ) : validation.ean.checkedValue === data.ean ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : null}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  value={data.ean}
                  onChange={(e) => {
                    setData(prev => ({ ...prev, ean: e.target.value }));
                    validateField('ean', e.target.value);
                  }}
                  placeholder={t('optional')}
                  className={`futuristic-input ${validation.ean.exists ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  disabled={isEdit}
                />
              </div>
              {validation.ean.exists && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {t('productEanExists')}
                </p>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {t('productName')} *
              {!isEdit && data.name && (
                <span className="inline-flex items-center">
                  {validation.name.isChecking ? (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  ) : validation.name.exists ? (
                    <XCircle className="w-3 h-3 text-destructive" />
                  ) : validation.name.checkedValue === data.name ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : null}
                </span>
              )}
            </Label>
            <Input
              value={data.name}
              onChange={(e) => {
                setData(prev => ({ ...prev, name: e.target.value }));
                validateField('name', e.target.value);
              }}
              className={`futuristic-input ${validation.name.exists ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              required
              disabled={isEdit}
            />
            {validation.name.exists && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {t('productNameExists')}
              </p>
            )}
          </div>


          {/* Product Type */}
          <div className="space-y-2">
            <Label>{t('productType')} *</Label>
            <RadioGroup
              value={data.productType}
              onValueChange={(value: 'physical' | 'service') => 
                setData(prev => ({ ...prev, productType: value }))
              }
              className="flex gap-4"
              disabled={isEdit}
            >
              <motion.div
                whileHover={{ scale: isEdit ? 1 : 1.02 }}
                className={`flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer ${
                  data.productType === 'physical' ? 'border-primary bg-primary/10' : ''
                } ${isEdit ? 'opacity-60' : ''}`}
              >
                <RadioGroupItem value="physical" id="physical" />
                <Label htmlFor="physical" className="flex items-center gap-2 cursor-pointer">
                  <Package className="w-4 h-4" />
                  {t('physicalProduct')}
                </Label>
              </motion.div>
              <motion.div
                whileHover={{ scale: isEdit ? 1 : 1.02 }}
                className={`flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer ${
                  data.productType === 'service' ? 'border-primary bg-primary/10' : ''
                } ${isEdit ? 'opacity-60' : ''}`}
              >
                <RadioGroupItem value="service" id="service" />
                <Label htmlFor="service" className="flex items-center gap-2 cursor-pointer">
                  <Wrench className="w-4 h-4" />
                  {t('service')}
                </Label>
              </motion.div>
            </RadioGroup>
          </div>

          {/* VAT Rate */}
          <div className="space-y-2">
            <Label>{t('vatRate')} *</Label>
            <div className="flex gap-2">
              {VAT_RATES.map(rate => (
                <motion.button
                  key={rate}
                  type="button"
                  whileHover={{ scale: isEdit ? 1 : 1.05 }}
                  whileTap={{ scale: isEdit ? 1 : 0.95 }}
                  onClick={() => !isEdit && handleVatChange(rate)}
                  disabled={isEdit}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    data.vatRate === rate 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'border-border/50 hover:border-primary/50'
                  } ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {rate}%
                </motion.button>
              ))}
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('priceHT')} *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={data.priceHt}
                onChange={(e) => handlePriceHtChange(e.target.value)}
                className="futuristic-input"
                disabled={isPriceDisabled}
                placeholder={isPriceDisabled ? t('selectVatFirst') : '0.000'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('priceTTC')}</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={data.priceTtc}
                onChange={(e) => handlePriceTtcChange(e.target.value)}
                className="futuristic-input"
                disabled={isPriceDisabled}
                placeholder={isPriceDisabled ? t('selectVatFirst') : '0.000'}
              />
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-2">
            <Label>{t('unit')}</Label>
            <Popover open={unitOpen} onOpenChange={setUnitOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between futuristic-input"
                >
                  {data.unit ? t(data.unit) : t('selectUnit')}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-background border border-border">
                <div className="p-2">
                  <Input
                    placeholder={t('searchUnit')}
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    className="mb-2"
                  />
                  <ScrollArea className="h-[200px]">
                    {filteredUnits.map(unit => (
                      <Button
                        key={unit}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          setData(prev => ({ ...prev, unit }));
                          setUnitOpen(false);
                          setUnitSearch('');
                        }}
                      >
                        {t(unit)}
                      </Button>
                    ))}
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Purchase Year */}
          <div className="space-y-2">
            <Label>{t('purchaseYear')} *</Label>
            <Input
              type="number"
              min="1900"
              max={currentYear + 10}
              value={data.purchaseYear}
              onChange={(e) => setData(prev => ({ ...prev, purchaseYear: parseInt(e.target.value) || currentYear }))}
              className="futuristic-input"
              disabled={isEdit}
            />
          </div>

          {/* Max Discount */}
          <div className="space-y-2">
            <Label>{t('maxDiscount')} *</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={data.maxDiscount}
                onChange={(e) => setData(prev => ({ ...prev, maxDiscount: e.target.value }))}
                className="futuristic-input pr-8"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </div>

          {/* Stock Section */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="unlimitedStock">{t('unlimitedStock')}</Label>
              <Switch
                id="unlimitedStock"
                checked={data.unlimitedStock}
                onCheckedChange={(checked) => setData(prev => ({ ...prev, unlimitedStock: checked }))}
                disabled={isEdit}
              />
            </div>

            <AnimatePresence>
              {!data.unlimitedStock && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowOutOfStock">{t('allowOutOfStockSale')}</Label>
                    <Switch
                      id="allowOutOfStock"
                      checked={data.allowOutOfStockSale}
                      onCheckedChange={(checked) => setData(prev => ({ ...prev, allowOutOfStockSale: checked }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('currentStock')} *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={data.currentStock}
                      onChange={(e) => setData(prev => ({ ...prev, currentStock: e.target.value }))}
                      className="futuristic-input"
                      placeholder="0"
                      disabled={isEdit}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || hasErrors || isValidating}>
          {isLoading ? t('saving') : (isDuplicate ? t('duplicate') : (isEdit ? t('save') : t('create')))}
        </Button>
      </div>
    </form>
  );
};
