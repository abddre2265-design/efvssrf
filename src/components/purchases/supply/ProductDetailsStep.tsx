import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package,
  ChevronRight,
  Hash,
  Barcode,
  Tag,
  Box,
  Scale,
  Calendar,
  PackageCheck,
  ShoppingCart,
  DollarSign,
  Percent,
  Calculator,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { ExtractedProduct } from './types';
import { UNITS, VAT_RATES } from '@/components/products/types';

// Valid EAN/barcode formats with regex patterns
const BARCODE_PATTERNS: Record<string, RegExp> = {
  'EAN-13': /^[0-9]{13}$/,
  'EAN-8': /^[0-9]{8}$/,
  'UPC-A': /^[0-9]{12}$/,
  'UPC-E': /^[0-9]{8}$/,
  'Code-128': /^[\x00-\x7F]{1,48}$/,
  'Code-39': /^[A-Z0-9\-\.\ \$\/\+\%]{1,43}$/,
  'Code-93': /^[A-Z0-9\-\.\ \$\/\+\%]{1,48}$/,
  'ITF-14': /^[0-9]{14}$/,
};

// Validate barcode and return format if valid
const validateBarcode = (code: string): { valid: boolean; format?: string } => {
  if (!code || code.trim() === '') return { valid: true }; // Empty is valid (optional)
  
  const trimmedCode = code.trim();
  
  for (const [format, pattern] of Object.entries(BARCODE_PATTERNS)) {
    if (pattern.test(trimmedCode)) {
      return { valid: true, format };
    }
  }
  
  return { valid: false };
};

// Generate reference if missing
const generateReference = (index: number, invoiceDate: string | null): string => {
  const datePart = invoiceDate 
    ? new Date(invoiceDate).toISOString().slice(2, 10).replace(/-/g, '')
    : new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `REF-${datePart}-${String(index + 1).padStart(3, '0')}`;
};

// Extract purchase year from invoice date
const extractPurchaseYear = (invoiceDate: string | null): number => {
  if (invoiceDate) {
    const year = new Date(invoiceDate).getFullYear();
    if (!isNaN(year) && year >= 2000 && year <= 2100) {
      return year;
    }
  }
  return new Date().getFullYear();
};

// Product details for all blocks
export interface ProductDetailData {
  // Block 1: Basic Info
  reference: string;
  ean: string;
  name: string;
  product_type: 'physical' | 'service';
  unit: string;
  purchase_year: number;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean;
  current_stock: number;
  // Block 2: Purchase Pricing Info
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount_percent: number;
  line_total_ht: number;
  line_vat: number;
  line_total_ttc: number;
  max_discount: number;
  // Converted values (for foreign suppliers)
  unit_price_ht_converted: number;
  line_total_ht_converted: number;
  line_vat_converted: number;
  line_total_ttc_converted: number;
  // Block 3: Sale Pricing Info
  sale_vat_rate: number | null;  // null = not selected yet
  sale_price_ht: number | null;
  sale_price_ttc: number | null;
  gain_rate: number | null;  // Taux de gain en pourcentage
  sale_max_discount: number | null;  // Remise max pour la vente
}

interface ProductDetailsStepProps {
  extractedProducts: ExtractedProduct[];
  invoiceDate: string | null;
  organizationId: string;
  currency: string;
  exchangeRate: number;
  isForeignSupplier: boolean;
  onProductsDetailsConfirmed: (products: ProductDetailData[]) => void;
}

export const ProductDetailsStep: React.FC<ProductDetailsStepProps> = ({
  extractedProducts,
  invoiceDate,
  organizationId,
  currency,
  exchangeRate,
  isForeignSupplier,
  onProductsDetailsConfirmed,
}) => {
  const { t, isRTL } = useLanguage();
  
  // Initialize product details from extracted products with pricing info
  const [productDetails, setProductDetails] = useState<ProductDetailData[]>(() => 
    extractedProducts.map((p, index) => {
      const unitPriceHt = p.unit_price_ht || 0;
      const quantity = p.quantity || 1;
      const vatRate = p.vat_rate || 19;
      const discountPercent = p.discount_percent || 0;
      
      // Calculate line totals
      const lineTotalHtBeforeDiscount = unitPriceHt * quantity;
      const discountAmount = lineTotalHtBeforeDiscount * (discountPercent / 100);
      const lineTotalHt = lineTotalHtBeforeDiscount - discountAmount;
      const lineVat = lineTotalHt * (vatRate / 100);
      const lineTotalTtc = lineTotalHt + lineVat;
      
      // Apply exchange rate for foreign suppliers
      const rate = isForeignSupplier ? exchangeRate : 1;
      
      return {
        // Block 1: Basic Info
        reference: p.reference || generateReference(index, invoiceDate),
        ean: validateBarcode(p.ean || '').valid ? (p.ean || '') : '',
        name: p.name || `Produit ${index + 1}`,
        product_type: p.product_type || 'physical',
        unit: p.unit || 'piece',
        purchase_year: p.purchase_year || extractPurchaseYear(invoiceDate),
        unlimited_stock: p.unlimited_stock ?? false,
        allow_out_of_stock_sale: p.allow_out_of_stock_sale ?? false,
        current_stock: p.quantity || 0,
        // Block 2: Purchase Pricing Info
        quantity,
        unit_price_ht: unitPriceHt,
        vat_rate: vatRate,
        discount_percent: discountPercent,
        line_total_ht: lineTotalHt,
        line_vat: lineVat,
        line_total_ttc: lineTotalTtc,
        max_discount: p.max_discount || 100,
        // Converted values
        unit_price_ht_converted: unitPriceHt * rate,
        line_total_ht_converted: lineTotalHt * rate,
        line_vat_converted: lineVat * rate,
        line_total_ttc_converted: lineTotalTtc * rate,
        // Block 3: Sale Pricing Info (all null by default)
        sale_vat_rate: null,
        sale_price_ht: null,
        sale_price_ttc: null,
        gain_rate: null,
        sale_max_discount: null,
      };
    })
  );
  
  // Available units from database + defaults
  const [availableUnits, setAvailableUnits] = useState<string[]>(UNITS);
  const [newUnit, setNewUnit] = useState<string>('');
  const [addingUnit, setAddingUnit] = useState<number | null>(null);
  
  // Validation errors
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({});

  // Load any custom units from organization
  useEffect(() => {
    // For now, we use the default UNITS. Custom units can be added via the UI.
    // In the future, we could load organization-specific units from the database.
  }, [organizationId]);

  // Recalculate line totals when pricing fields change
  const recalculatePricing = (index: number, updatedProduct: ProductDetailData): ProductDetailData => {
    const { quantity, unit_price_ht, vat_rate, discount_percent } = updatedProduct;
    
    // Calculate line totals
    const lineTotalHtBeforeDiscount = unit_price_ht * quantity;
    const discountAmount = lineTotalHtBeforeDiscount * (discount_percent / 100);
    const lineTotalHt = lineTotalHtBeforeDiscount - discountAmount;
    const lineVat = lineTotalHt * (vat_rate / 100);
    const lineTotalTtc = lineTotalHt + lineVat;
    
    // Apply exchange rate for foreign suppliers
    const rate = isForeignSupplier ? exchangeRate : 1;
    
    return {
      ...updatedProduct,
      line_total_ht: lineTotalHt,
      line_vat: lineVat,
      line_total_ttc: lineTotalTtc,
      unit_price_ht_converted: unit_price_ht * rate,
      line_total_ht_converted: lineTotalHt * rate,
      line_vat_converted: lineVat * rate,
      line_total_ttc_converted: lineTotalTtc * rate,
    };
  };

  // Calculate sale prices based on what field changed
  const recalculateSalePricing = (
    product: ProductDetailData, 
    changedField: 'sale_vat_rate' | 'sale_price_ht' | 'sale_price_ttc' | 'gain_rate',
    newValue: number | null
  ): ProductDetailData => {
    const updated = { ...product };
    
    // Get the purchase TTC (converted to TND if foreign supplier)
    const purchaseTtcBase = isForeignSupplier 
      ? product.line_total_ttc_converted 
      : product.line_total_ttc;
    
    // Unit purchase TTC
    const unitPurchaseTtc = product.quantity > 0 
      ? purchaseTtcBase / product.quantity 
      : 0;

    const saleVatRate = changedField === 'sale_vat_rate' ? newValue : product.sale_vat_rate;
    
    // If VAT rate is not selected, reset everything
    if (saleVatRate === null) {
      return {
        ...updated,
        sale_vat_rate: null,
        sale_price_ht: null,
        sale_price_ttc: null,
        gain_rate: null,
      };
    }

    updated.sale_vat_rate = saleVatRate;

    switch (changedField) {
      case 'sale_vat_rate': {
        // When VAT rate changes, recalculate based on existing values
        if (product.sale_price_ht !== null) {
          const ttc = product.sale_price_ht * (1 + saleVatRate / 100);
          const gainRate = unitPurchaseTtc > 0 
            ? ((ttc - unitPurchaseTtc) / unitPurchaseTtc) * 100 
            : 0;
          updated.sale_price_ttc = parseFloat(ttc.toFixed(3));
          updated.gain_rate = parseFloat(gainRate.toFixed(2));
        } else if (product.sale_price_ttc !== null) {
          const ht = product.sale_price_ttc / (1 + saleVatRate / 100);
          const gainRate = unitPurchaseTtc > 0 
            ? ((product.sale_price_ttc - unitPurchaseTtc) / unitPurchaseTtc) * 100 
            : 0;
          updated.sale_price_ht = parseFloat(ht.toFixed(3));
          updated.gain_rate = parseFloat(gainRate.toFixed(2));
        } else if (product.gain_rate !== null) {
          const ttc = unitPurchaseTtc * (1 + product.gain_rate / 100);
          const ht = ttc / (1 + saleVatRate / 100);
          updated.sale_price_ttc = parseFloat(ttc.toFixed(3));
          updated.sale_price_ht = parseFloat(ht.toFixed(3));
        }
        break;
      }
      case 'sale_price_ht': {
        // HT changed: calculate TTC and gain rate
        if (newValue !== null) {
          const ttc = newValue * (1 + saleVatRate / 100);
          const gainRate = unitPurchaseTtc > 0 
            ? ((ttc - unitPurchaseTtc) / unitPurchaseTtc) * 100 
            : 0;
          updated.sale_price_ht = newValue;
          updated.sale_price_ttc = parseFloat(ttc.toFixed(3));
          updated.gain_rate = parseFloat(gainRate.toFixed(2));
        }
        break;
      }
      case 'sale_price_ttc': {
        // TTC changed: calculate HT and gain rate
        if (newValue !== null) {
          const ht = newValue / (1 + saleVatRate / 100);
          const gainRate = unitPurchaseTtc > 0 
            ? ((newValue - unitPurchaseTtc) / unitPurchaseTtc) * 100 
            : 0;
          updated.sale_price_ht = parseFloat(ht.toFixed(3));
          updated.sale_price_ttc = newValue;
          updated.gain_rate = parseFloat(gainRate.toFixed(2));
        }
        break;
      }
      case 'gain_rate': {
        // Gain rate changed: calculate TTC then HT
        if (newValue !== null) {
          const ttc = unitPurchaseTtc * (1 + newValue / 100);
          const ht = ttc / (1 + saleVatRate / 100);
          updated.sale_price_ttc = parseFloat(ttc.toFixed(3));
          updated.sale_price_ht = parseFloat(ht.toFixed(3));
          updated.gain_rate = newValue;
        }
        break;
      }
    }

    return updated;
  };

  const updateProductDetail = (index: number, field: keyof ProductDetailData, value: any) => {
    setProductDetails(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate purchase pricing if purchase-related field changed
      const purchasePricingFields: (keyof ProductDetailData)[] = ['quantity', 'unit_price_ht', 'vat_rate', 'discount_percent'];
      if (purchasePricingFields.includes(field)) {
        updated[index] = recalculatePricing(index, updated[index]);
        // Also recalculate sale pricing if gain_rate is set (to update based on new purchase price)
        if (updated[index].sale_vat_rate !== null && updated[index].gain_rate !== null) {
          updated[index] = recalculateSalePricing(updated[index], 'gain_rate', updated[index].gain_rate);
        }
      }
      
      // Recalculate sale pricing if sale-related field changed
      const salePricingFields: (keyof ProductDetailData)[] = ['sale_vat_rate', 'sale_price_ht', 'sale_price_ttc', 'gain_rate'];
      if (salePricingFields.includes(field)) {
        updated[index] = recalculateSalePricing(updated[index], field as any, value);
      }
      
      return updated;
    });
    
    // Clear error for this field
    setErrors(prev => {
      const updated = { ...prev };
      if (updated[index]) {
        delete updated[index][field];
        if (Object.keys(updated[index]).length === 0) {
          delete updated[index];
        }
      }
      return updated;
    });
  };

  const handleEanChange = (index: number, value: string) => {
    updateProductDetail(index, 'ean', value);
    
    // Validate EAN format
    if (value && value.trim() !== '') {
      const validation = validateBarcode(value);
      if (!validation.valid) {
        setErrors(prev => ({
          ...prev,
          [index]: { ...prev[index], ean: t('invalid_barcode_format') || 'Format de code-barres invalide' }
        }));
      }
    }
  };

  const handleAddNewUnit = async (index: number) => {
    if (!newUnit.trim()) return;
    
    const unitToAdd = newUnit.trim().toLowerCase();
    
    if (availableUnits.includes(unitToAdd)) {
      toast.info(t('unit_already_exists') || 'Cette unité existe déjà');
      updateProductDetail(index, 'unit', unitToAdd);
      setNewUnit('');
      setAddingUnit(null);
      return;
    }
    
    // Add new unit to the list
    setAvailableUnits(prev => [...prev, unitToAdd]);
    updateProductDetail(index, 'unit', unitToAdd);
    setNewUnit('');
    setAddingUnit(null);
    toast.success(t('unit_added') || 'Unité ajoutée');
  };

  const validateAllProducts = (): boolean => {
    const newErrors: Record<number, Record<string, string>> = {};
    let isValid = true;
    
    productDetails.forEach((product, index) => {
      const productErrors: Record<string, string> = {};
      
      // Validate name
      if (!product.name || product.name.trim() === '') {
        productErrors.name = t('name_required') || 'Le nom est requis';
        isValid = false;
      }
      
      // Validate reference
      if (!product.reference || product.reference.trim() === '') {
        productErrors.reference = t('reference_required') || 'La référence est requise';
        isValid = false;
      }
      
      // Validate EAN if provided
      if (product.ean && product.ean.trim() !== '') {
        const validation = validateBarcode(product.ean);
        if (!validation.valid) {
          productErrors.ean = t('invalid_barcode_format') || 'Format de code-barres invalide';
          isValid = false;
        }
      }
      
      // Validate unit
      if (!product.unit || product.unit.trim() === '') {
        productErrors.unit = t('unit_required') || 'L\'unité est requise';
        isValid = false;
      }
      
      // Validate purchase year
      if (!product.purchase_year || product.purchase_year < 2000 || product.purchase_year > 2100) {
        productErrors.purchase_year = t('invalid_year') || 'Année invalide';
        isValid = false;
      }
      
      // Validate stock (must be >= 0)
      if (product.current_stock < 0) {
        productErrors.current_stock = t('stock_must_be_positive') || 'Le stock doit être positif';
        isValid = false;
      }
      
      if (Object.keys(productErrors).length > 0) {
        newErrors[index] = productErrors;
      }
    });
    
    setErrors(newErrors);
    return isValid;
  };

  const handleContinue = () => {
    if (!validateAllProducts()) {
      toast.error(t('fix_errors_before_continue') || 'Veuillez corriger les erreurs avant de continuer');
      return;
    }
    
    onProductsDetailsConfirmed(productDetails);
  };

  const getUnitLabel = (unit: string): string => {
    const unitLabels: Record<string, string> = {
      piece: t('unit_piece') || 'Pièce',
      kg: t('unit_kg') || 'Kilogramme',
      g: t('unit_g') || 'Gramme',
      l: t('unit_l') || 'Litre',
      ml: t('unit_ml') || 'Millilitre',
      m: t('unit_m') || 'Mètre',
      cm: t('unit_cm') || 'Centimètre',
      m2: t('unit_m2') || 'Mètre carré',
      m3: t('unit_m3') || 'Mètre cube',
      hour: t('unit_hour') || 'Heure',
      day: t('unit_day') || 'Jour',
      week: t('unit_week') || 'Semaine',
      month: t('unit_month') || 'Mois',
      year: t('unit_year') || 'Année',
      pack: t('unit_pack') || 'Pack',
      box: t('unit_box') || 'Boîte',
      pallet: t('unit_pallet') || 'Palette',
      roll: t('unit_roll') || 'Rouleau',
      sheet: t('unit_sheet') || 'Feuille',
      unit: t('unit_unit') || 'Unité',
    };
    return unitLabels[unit] || unit;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {t('product_details') || 'Détails des produits'}
        </CardTitle>
        <CardDescription>
          {t('product_details_description') || 'Vérifiez et complétez les informations de chaque produit'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Products Count */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-2">
            <Package className="h-3 w-3" />
            {extractedProducts.length} {t('products') || 'produits'}
          </Badge>
        </div>

        {/* Product List */}
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {productDetails.map((product, index) => (
              <div 
                key={index}
                className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow"
              >
                {/* Product Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Hash className="h-3 w-3" />
                      {index + 1}
                    </Badge>
                    <span className="font-medium text-sm truncate max-w-[200px]">
                      {extractedProducts[index]?.name || `Produit ${index + 1}`}
                    </span>
                  </div>
                  <Badge variant={product.product_type === 'physical' ? 'default' : 'secondary'}>
                    {product.product_type === 'physical' 
                      ? (t('physical') || 'Physique')
                      : (t('service') || 'Service')
                    }
                  </Badge>
                </div>

                {/* First Block: Product Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Reference */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Tag className="h-3 w-3" />
                      {t('reference') || 'Référence'}
                    </Label>
                    <Input
                      value={product.reference}
                      onChange={(e) => updateProductDetail(index, 'reference', e.target.value)}
                      placeholder={t('auto_generated') || 'Auto-généré'}
                      className={errors[index]?.reference ? 'border-destructive' : ''}
                    />
                    {errors[index]?.reference && (
                      <p className="text-xs text-destructive">{errors[index].reference}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('reference_auto_if_empty') || 'Générée automatiquement si absente'}
                    </p>
                  </div>

                  {/* EAN / Barcode */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Barcode className="h-3 w-3" />
                      {t('ean_barcode') || 'EAN / Code-barres'}
                    </Label>
                    <Input
                      value={product.ean}
                      onChange={(e) => handleEanChange(index, e.target.value)}
                      placeholder={t('ean_placeholder') || 'EAN-13, UPC-A, Code-128...'}
                      className={errors[index]?.ean ? 'border-destructive' : ''}
                    />
                    {errors[index]?.ean && (
                      <p className="text-xs text-destructive">{errors[index].ean}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('ean_formats_supported') || 'EAN-13/8, UPC-A/E, Code-128/39/93, ITF-14'}
                    </p>
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Box className="h-3 w-3" />
                      {t('product_name') || 'Nom du produit'} *
                    </Label>
                    <Input
                      value={product.name}
                      onChange={(e) => updateProductDetail(index, 'name', e.target.value)}
                      placeholder={t('product_name_placeholder') || 'Nom du produit'}
                      className={errors[index]?.name ? 'border-destructive' : ''}
                    />
                    {errors[index]?.name && (
                      <p className="text-xs text-destructive">{errors[index].name}</p>
                    )}
                  </div>

                  {/* Product Type */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Package className="h-3 w-3" />
                      {t('product_type') || 'Type de produit'}
                    </Label>
                    <Select
                      value={product.product_type}
                      onValueChange={(value: 'physical' | 'service') => 
                        updateProductDetail(index, 'product_type', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">
                          {t('physical') || 'Physique'}
                        </SelectItem>
                        <SelectItem value="service">
                          {t('service') || 'Service'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('physical_by_default') || 'Physique par défaut'}
                    </p>
                  </div>

                  {/* Unit */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Scale className="h-3 w-3" />
                      {t('unit') || 'Unité'}
                    </Label>
                    {addingUnit === index ? (
                      <div className="flex gap-2">
                        <Input
                          value={newUnit}
                          onChange={(e) => setNewUnit(e.target.value)}
                          placeholder={t('new_unit') || 'Nouvelle unité'}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewUnit(index);
                            }
                            if (e.key === 'Escape') {
                              setAddingUnit(null);
                              setNewUnit('');
                            }
                          }}
                        />
                        <Button size="sm" onClick={() => handleAddNewUnit(index)}>
                          {t('add') || 'Ajouter'}
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={product.unit}
                        onValueChange={(value) => {
                          if (value === '__new__') {
                            setAddingUnit(index);
                          } else {
                            updateProductDetail(index, 'unit', value);
                          }
                        }}
                      >
                        <SelectTrigger className={errors[index]?.unit ? 'border-destructive' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUnits.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {getUnitLabel(unit)}
                            </SelectItem>
                          ))}
                          <SelectItem value="__new__" className="text-primary">
                            + {t('add_new_unit') || 'Ajouter une unité'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {errors[index]?.unit && (
                      <p className="text-xs text-destructive">{errors[index].unit}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('piece_by_default') || 'Pièce par défaut'}
                    </p>
                  </div>

                  {/* Purchase Year */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3 w-3" />
                      {t('purchase_year') || 'Année d\'achat'}
                    </Label>
                    <Input
                      type="number"
                      min={2000}
                      max={2100}
                      value={product.purchase_year}
                      onChange={(e) => updateProductDetail(index, 'purchase_year', parseInt(e.target.value) || new Date().getFullYear())}
                      className={errors[index]?.purchase_year ? 'border-destructive' : ''}
                    />
                    {errors[index]?.purchase_year && (
                      <p className="text-xs text-destructive">{errors[index].purchase_year}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('from_invoice_date') || 'Selon date de facture'}
                    </p>
                  </div>

                  {/* Unlimited Stock */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <PackageCheck className="h-3 w-3" />
                      {t('unlimited_stock') || 'Stock illimité'}
                    </Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={product.unlimited_stock}
                        onCheckedChange={(checked) => updateProductDetail(index, 'unlimited_stock', checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {product.unlimited_stock 
                          ? (t('yes') || 'Oui') 
                          : (t('no') || 'Non')
                        }
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('no_by_default') || 'Non par défaut'}
                    </p>
                  </div>

                  {/* Allow Out of Stock Sale */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <ShoppingCart className="h-3 w-3" />
                      {t('allow_out_of_stock_sale') || 'Vente hors stock'}
                    </Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={product.allow_out_of_stock_sale}
                        onCheckedChange={(checked) => updateProductDetail(index, 'allow_out_of_stock_sale', checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {product.allow_out_of_stock_sale 
                          ? (t('yes') || 'Oui') 
                          : (t('no') || 'Non')
                        }
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('no_by_default') || 'Non par défaut'}
                    </p>
                  </div>

                  {/* Current Stock */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Package className="h-3 w-3" />
                      {t('current_stock') || 'Stock actuel'}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={product.current_stock}
                      onChange={(e) => updateProductDetail(index, 'current_stock', parseFloat(e.target.value) || 0)}
                      className={errors[index]?.current_stock ? 'border-destructive' : ''}
                    />
                    {errors[index]?.current_stock && (
                      <p className="text-xs text-destructive">{errors[index].current_stock}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('from_extracted_quantity') || 'Quantité extraite du document'}
                    </p>
                  </div>
                </div>

                {/* Second Block: Pricing Info */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">
                      {t('purchase_pricing') || 'Prix d\'achat'}
                    </span>
                    {isForeignSupplier && (
                      <Badge variant="outline" className="ml-auto gap-1 text-xs">
                        <RefreshCw className="h-3 w-3" />
                        {currency} <ArrowRight className="h-3 w-3" /> TND × {exchangeRate.toFixed(4)}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Quantity */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Package className="h-3 w-3" />
                        {t('quantity') || 'Quantité'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={product.quantity}
                        onChange={(e) => updateProductDetail(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className={errors[index]?.quantity ? 'border-destructive' : ''}
                      />
                      {errors[index]?.quantity && (
                        <p className="text-xs text-destructive">{errors[index].quantity}</p>
                      )}
                    </div>

                    {/* Unit Price HT */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <DollarSign className="h-3 w-3" />
                        {t('unit_price_ht') || 'Prix unitaire HT'} ({currency})
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        value={product.unit_price_ht}
                        onChange={(e) => updateProductDetail(index, 'unit_price_ht', parseFloat(e.target.value) || 0)}
                        className={errors[index]?.unit_price_ht ? 'border-destructive' : ''}
                      />
                      {errors[index]?.unit_price_ht && (
                        <p className="text-xs text-destructive">{errors[index].unit_price_ht}</p>
                      )}
                      {isForeignSupplier && (
                        <p className="text-xs text-muted-foreground">
                          ≈ {product.unit_price_ht_converted.toFixed(3)} TND
                        </p>
                      )}
                    </div>

                    {/* VAT Rate */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Percent className="h-3 w-3" />
                        {t('vat_rate') || 'Taux TVA'} (%)
                      </Label>
                      <Select
                        value={String(product.vat_rate)}
                        onValueChange={(value) => updateProductDetail(index, 'vat_rate', parseFloat(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="7">7%</SelectItem>
                          <SelectItem value="13">13%</SelectItem>
                          <SelectItem value="19">19%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Discount Percent */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Percent className="h-3 w-3" />
                        {t('discount') || 'Remise'} (%)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={product.max_discount}
                        step={0.01}
                        value={product.discount_percent}
                        onChange={(e) => updateProductDetail(index, 'discount_percent', Math.min(parseFloat(e.target.value) || 0, product.max_discount))}
                        className={errors[index]?.discount_percent ? 'border-destructive' : ''}
                      />
                      {errors[index]?.discount_percent && (
                        <p className="text-xs text-destructive">{errors[index].discount_percent}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t('max') || 'Max'}: {product.max_discount}%
                      </p>
                    </div>
                  </div>

                  {/* Calculated Totals */}
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        {t('calculated_totals') || 'Totaux calculés'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {/* Total HT */}
                      <div>
                        <span className="text-muted-foreground text-xs">{t('total_ht') || 'Total HT'}</span>
                        <p className="font-medium">
                          {product.line_total_ht.toFixed(3)} {currency}
                        </p>
                        {isForeignSupplier && (
                          <p className="text-xs text-primary">
                            {product.line_total_ht_converted.toFixed(3)} TND
                          </p>
                        )}
                      </div>

                      {/* TVA */}
                      <div>
                        <span className="text-muted-foreground text-xs">{t('vat') || 'TVA'} ({product.vat_rate}%)</span>
                        <p className="font-medium">
                          {product.line_vat.toFixed(3)} {currency}
                        </p>
                        {isForeignSupplier && (
                          <p className="text-xs text-primary">
                            {product.line_vat_converted.toFixed(3)} TND
                          </p>
                        )}
                      </div>

                      {/* Total TTC */}
                      <div>
                        <span className="text-muted-foreground text-xs">{t('total_ttc') || 'Total TTC'}</span>
                        <p className="font-semibold text-primary">
                          {product.line_total_ttc.toFixed(3)} {currency}
                        </p>
                        {isForeignSupplier && (
                          <p className="text-xs text-primary font-medium">
                            {product.line_total_ttc_converted.toFixed(3)} TND
                          </p>
                        )}
                      </div>

                      {/* Max Discount */}
                      <div>
                        <span className="text-muted-foreground text-xs">{t('max_discount') || 'Remise max'}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={product.max_discount}
                            onChange={(e) => updateProductDetail(index, 'max_discount', Math.min(parseFloat(e.target.value) || 0, 100))}
                            className="h-7 text-sm w-20"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Third Block: Sale Pricing Info */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">
                      {t('sale_pricing') || 'Prix de vente'}
                    </span>
                    {product.sale_vat_rate !== null && product.gain_rate !== null && (
                      <Badge variant="outline" className={`ml-auto gap-1 text-xs ${product.gain_rate >= 0 ? 'text-green-600 border-green-600' : 'text-destructive border-destructive'}`}>
                        {product.gain_rate >= 0 ? '+' : ''}{product.gain_rate?.toFixed(2)}% {t('gain') || 'marge'}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Sale VAT Rate */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Percent className="h-3 w-3" />
                        {t('sale_vat_rate') || 'Taux TVA vente'} *
                      </Label>
                      <Select
                        value={product.sale_vat_rate !== null ? String(product.sale_vat_rate) : ''}
                        onValueChange={(value) => {
                          const rate = value === '' ? null : parseFloat(value);
                          updateProductDetail(index, 'sale_vat_rate', rate);
                        }}
                      >
                        <SelectTrigger className={!product.sale_vat_rate && product.sale_vat_rate !== 0 ? 'text-muted-foreground' : ''}>
                          <SelectValue placeholder={t('select_vat_rate') || 'Choisir TVA'} />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_RATES.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>
                              {rate}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t('required_for_sale_prices') || 'Requis pour les prix'}
                      </p>
                    </div>

                    {/* Sale Price HT - Only enabled if VAT rate is selected */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <DollarSign className="h-3 w-3" />
                        {t('sale_price_ht') || 'Prix HT'} (TND)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        value={product.sale_price_ht ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value);
                          updateProductDetail(index, 'sale_price_ht', value);
                        }}
                        disabled={product.sale_vat_rate === null}
                        placeholder={product.sale_vat_rate === null ? (t('select_vat_first') || 'Choisir TVA') : '0.000'}
                        className={product.sale_vat_rate === null ? 'bg-muted' : ''}
                      />
                    </div>

                    {/* Sale Price TTC - Only enabled if VAT rate is selected */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <DollarSign className="h-3 w-3" />
                        {t('sale_price_ttc') || 'Prix TTC'} (TND)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        value={product.sale_price_ttc ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value);
                          updateProductDetail(index, 'sale_price_ttc', value);
                        }}
                        disabled={product.sale_vat_rate === null}
                        placeholder={product.sale_vat_rate === null ? (t('select_vat_first') || 'Choisir TVA') : '0.000'}
                        className={product.sale_vat_rate === null ? 'bg-muted' : ''}
                      />
                    </div>

                    {/* Gain Rate - Only enabled if VAT rate is selected */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Percent className="h-3 w-3" />
                        {t('gain_rate') || 'Taux de gain'} (%)
                      </Label>
                      <Input
                        type="number"
                        step={0.01}
                        value={product.gain_rate ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value);
                          updateProductDetail(index, 'gain_rate', value);
                        }}
                        disabled={product.sale_vat_rate === null}
                        placeholder={product.sale_vat_rate === null ? (t('select_vat_first') || 'Choisir TVA') : '0.00'}
                        className={`${product.sale_vat_rate === null ? 'bg-muted' : ''} ${
                          product.gain_rate !== null && product.gain_rate < 0 ? 'text-destructive border-destructive' : ''
                        }`}
                      />
                      {product.gain_rate !== null && product.gain_rate < 0 && (
                        <p className="text-xs text-destructive">
                          {t('negative_margin_warning') || 'Marge négative !'}
                        </p>
                      )}
                    </div>

                    {/* Sale Max Discount */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Percent className="h-3 w-3" />
                        {t('sale_max_discount') || 'Remise max'} (%)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={product.sale_max_discount ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Math.min(parseFloat(e.target.value) || 0, 100);
                          updateProductDetail(index, 'sale_max_discount', value);
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Sale Price Summary */}
                  {product.sale_vat_rate !== null && product.sale_price_ttc !== null && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">{t('unit_purchase_ttc') || 'Achat unit. TTC'}</span>
                          <p className="font-medium">
                            {(product.quantity > 0 
                              ? (isForeignSupplier 
                                  ? product.line_total_ttc_converted 
                                  : product.line_total_ttc
                                ) / product.quantity 
                              : 0
                            ).toFixed(3)} TND
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">{t('sale_price_ht') || 'Prix HT'}</span>
                          <p className="font-medium">{product.sale_price_ht?.toFixed(3) ?? '-'} TND</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">{t('sale_price_ttc') || 'Prix TTC'}</span>
                          <p className="font-semibold text-green-600">{product.sale_price_ttc?.toFixed(3) ?? '-'} TND</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">{t('margin') || 'Marge'}</span>
                          <p className={`font-semibold ${product.gain_rate !== null && product.gain_rate >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {product.gain_rate !== null ? `${product.gain_rate >= 0 ? '+' : ''}${product.gain_rate.toFixed(2)}%` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Continue Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleContinue} className="gap-2">
            {t('continue') || 'Continuer'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
