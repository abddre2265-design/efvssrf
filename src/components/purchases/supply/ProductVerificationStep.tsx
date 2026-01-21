import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Link2,
  PackageCheck,
  ArrowRight,
  AlertCircle,
  Edit
} from 'lucide-react';
import { ProductDetailData } from './ProductDetailsStep';
import { ProductForm } from '@/components/products/ProductForm';
import { ProductFormData } from '@/components/products/types';

// Product matching result
interface ProductMatch {
  id: string;
  name: string;
  reference: string | null;
  ean: string | null;
  current_stock: number | null;
  price_ht: number;
  price_ttc: number;
  vat_rate: number;
  product_type: 'physical' | 'service';
  unit: string | null;
  matchType: 'reference' | 'ean' | 'name';
  matchScore: number;
}

// Decision for each product line
export type ProductDecision = 'use_existing' | 'select_other' | 'create_new';

// Verified product data
export interface VerifiedProduct {
  lineIndex: number;
  decision: ProductDecision;
  existingProductId: string | null;
  existingProduct: ProductMatch | null;
  productDetails: ProductDetailData;
  validationErrors: string[];
  isValidated: boolean;
  isProcessing: boolean;
  productFormData: ProductFormData;
}

interface ProductVerificationStepProps {
  productDetails: ProductDetailData[];
  organizationId: string;
  onVerificationComplete: (verifiedProducts: VerifiedProduct[]) => void;
}

// Convert ProductDetailData to ProductFormData with default unit 'piece' if not detected
const convertToProductFormData = (pd: ProductDetailData): ProductFormData => {
  // Use 'piece' as default if no unit is detected or unit is empty
  const unit = pd.unit && pd.unit.trim() !== '' ? pd.unit : 'piece';
  
  return {
    reference: pd.reference || '',
    ean: pd.ean || '',
    name: pd.name || '',
    productType: pd.product_type || 'physical',
    vatRate: pd.sale_vat_rate ?? pd.vat_rate ?? null,
    priceHt: pd.sale_price_ht?.toString() || '',
    priceTtc: pd.sale_price_ttc?.toString() || '',
    unit: unit,
    purchaseYear: pd.purchase_year || new Date().getFullYear(),
    maxDiscount: pd.sale_max_discount?.toString() || pd.max_discount?.toString() || '',
    unlimitedStock: pd.unlimited_stock ?? false,
    allowOutOfStockSale: pd.allow_out_of_stock_sale ?? false,
    currentStock: pd.current_stock?.toString() || pd.quantity?.toString() || '0',
  };
};

export const ProductVerificationStep: React.FC<ProductVerificationStepProps> = ({
  productDetails,
  organizationId,
  onVerificationComplete,
}) => {
  const { t, isRTL } = useLanguage();
  
  // State for verified products
  const [verifiedProducts, setVerifiedProducts] = useState<VerifiedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const [searchResults, setSearchResults] = useState<Record<number, ProductMatch[]>>({});
  const [productSearchQuery, setProductSearchQuery] = useState<Record<number, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  
  // Product form dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  
  // Initialize verified products from product details
  useEffect(() => {
    const initializeProducts = async () => {
      setIsSearching(true);
      
      const initialProducts: VerifiedProduct[] = productDetails.map((pd, index) => ({
        lineIndex: index,
        decision: 'create_new',
        existingProductId: null,
        existingProduct: null,
        productDetails: pd,
        validationErrors: [],
        isValidated: false,
        isProcessing: false,
        productFormData: convertToProductFormData(pd),
      }));
      
      // Search for matching products in database
      try {
        const { data: existingProducts, error } = await supabase
          .from('products')
          .select('id, name, reference, ean, current_stock, price_ht, price_ttc, vat_rate, product_type, unit, status')
          .eq('organization_id', organizationId)
          .eq('status', 'active');
        
        if (error) throw error;
        
        // Find matches for each product
        initialProducts.forEach((vp, index) => {
          const pd = vp.productDetails;
          const matches: ProductMatch[] = [];
          
          existingProducts?.forEach(ep => {
            let matchType: 'reference' | 'ean' | 'name' | null = null;
            let matchScore = 0;
            
            // Check reference match (highest priority)
            if (pd.reference && ep.reference && 
                pd.reference.toLowerCase().trim() === ep.reference.toLowerCase().trim()) {
              matchType = 'reference';
              matchScore = 3;
            }
            // Check EAN match (high priority)
            else if (pd.ean && ep.ean && 
                     pd.ean.toLowerCase().trim() === ep.ean.toLowerCase().trim()) {
              matchType = 'ean';
              matchScore = 3;
            }
            // Check name match (lower priority)
            else if (pd.name && ep.name && 
                     pd.name.toLowerCase().trim() === ep.name.toLowerCase().trim()) {
              matchType = 'name';
              matchScore = 2;
            }
            
            if (matchType) {
              matches.push({
                id: ep.id,
                name: ep.name,
                reference: ep.reference,
                ean: ep.ean,
                current_stock: ep.current_stock,
                price_ht: ep.price_ht,
                price_ttc: ep.price_ttc,
                vat_rate: ep.vat_rate,
                product_type: ep.product_type,
                unit: ep.unit,
                matchType,
                matchScore,
              });
            }
          });
          
          // Sort matches by score (highest first)
          matches.sort((a, b) => b.matchScore - a.matchScore);
          
          // Store matches
          setSearchResults(prev => ({ ...prev, [index]: matches }));
          
          // If we have a match, set the decision to use existing
          if (matches.length > 0) {
            initialProducts[index].decision = 'use_existing';
            initialProducts[index].existingProductId = matches[0].id;
            initialProducts[index].existingProduct = matches[0];
          }
        });
        
        setVerifiedProducts(initialProducts);
        
        // Expand lines with matches
        const linesWithMatches = new Set<number>();
        initialProducts.forEach((vp, index) => {
          if (vp.existingProductId) {
            linesWithMatches.add(index);
          }
        });
        if (linesWithMatches.size > 0) {
          setExpandedLines(linesWithMatches);
        }
        
      } catch (error) {
        console.error('Error searching for products:', error);
        toast.error(t('error_searching_products') || 'Erreur lors de la recherche des produits');
        setVerifiedProducts(initialProducts);
      }
      
      setIsSearching(false);
    };
    
    initializeProducts();
  }, [productDetails, organizationId, t]);
  
  // Handle decision change
  const handleDecisionChange = (lineIndex: number, decision: ProductDecision) => {
    setVerifiedProducts(prev => prev.map(vp => {
      if (vp.lineIndex === lineIndex) {
        return {
          ...vp,
          decision,
          existingProductId: decision === 'use_existing' && searchResults[lineIndex]?.[0] 
            ? searchResults[lineIndex][0].id 
            : null,
          existingProduct: decision === 'use_existing' && searchResults[lineIndex]?.[0] 
            ? searchResults[lineIndex][0] 
            : null,
          isValidated: false,
        };
      }
      return vp;
    }));
  };
  
  // Handle existing product selection
  const handleSelectExistingProduct = (lineIndex: number, product: ProductMatch) => {
    setVerifiedProducts(prev => prev.map(vp => {
      if (vp.lineIndex === lineIndex) {
        return {
          ...vp,
          existingProductId: product.id,
          existingProduct: product,
          isValidated: false,
        };
      }
      return vp;
    }));
  };
  
  // Search products for "select_other" option
  const handleSearchProducts = async (lineIndex: number, query: string) => {
    setProductSearchQuery(prev => ({ ...prev, [lineIndex]: query }));
    
    if (!query.trim() || query.length < 2) {
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, reference, ean, current_stock, price_ht, price_ttc, vat_rate, product_type, unit')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .or(`name.ilike.%${query}%,reference.ilike.%${query}%,ean.ilike.%${query}%`)
        .limit(10);
      
      if (error) throw error;
      
      const results: ProductMatch[] = (data || []).map(p => ({
        ...p,
        matchType: 'name' as const,
        matchScore: 1,
      }));
      
      setSearchResults(prev => ({ ...prev, [lineIndex]: results }));
    } catch (error) {
      console.error('Search error:', error);
    }
  };
  
  // Open product form dialog
  const openProductFormDialog = (lineIndex: number) => {
    setEditingLineIndex(lineIndex);
    setFormDialogOpen(true);
  };
  
  // Handle product form submission
  const handleProductFormSubmit = (formData: ProductFormData) => {
    if (editingLineIndex === null) return;
    
    setVerifiedProducts(prev => prev.map(vp => {
      if (vp.lineIndex === editingLineIndex) {
        return {
          ...vp,
          productFormData: formData,
          validationErrors: [],
          isValidated: false,
        };
      }
      return vp;
    }));
    
    setFormDialogOpen(false);
    setEditingLineIndex(null);
    toast.success(t('product_details_updated') || 'Détails du produit mis à jour');
  };
  
  // Toggle line expansion
  const toggleLine = (lineIndex: number) => {
    setExpandedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineIndex)) {
        next.delete(lineIndex);
      } else {
        next.add(lineIndex);
      }
      return next;
    });
  };
  
  // Validate a single product for creation
  const validateProductForCreation = async (vp: VerifiedProduct): Promise<string[]> => {
    const errors: string[] = [];
    const fd = vp.productFormData;
    
    // Required fields
    if (!fd.name?.trim()) {
      errors.push(t('name_required') || 'Le nom est requis');
    }
    if (fd.vatRate === null) {
      errors.push(t('sale_vat_required') || 'Le taux TVA de vente est requis');
    }
    if (!fd.priceHt || parseFloat(fd.priceHt) <= 0) {
      errors.push(t('sale_price_required') || 'Le prix de vente HT est requis');
    }
    if (!fd.unlimitedStock && (fd.currentStock === '' || parseFloat(fd.currentStock) < 0)) {
      errors.push(t('stock_must_be_positive') || 'Le stock doit être positif');
    }
    if (fd.purchaseYear < 2000 || fd.purchaseYear > 2100) {
      errors.push(t('invalid_year') || 'Année d\'achat invalide');
    }
    
    // Check uniqueness in database
    if (fd.name?.trim()) {
      const { data: nameExists } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', fd.name.trim())
        .maybeSingle();
      
      if (nameExists) {
        errors.push(t('product_name_exists') || 'Un produit avec ce nom existe déjà');
      }
    }
    
    if (fd.reference?.trim()) {
      const { data: refExists } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('reference', fd.reference.trim())
        .maybeSingle();
      
      if (refExists) {
        errors.push(t('product_reference_exists') || 'Un produit avec cette référence existe déjà');
      }
    }
    
    if (fd.ean?.trim()) {
      const { data: eanExists } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('ean', fd.ean.trim())
        .maybeSingle();
      
      if (eanExists) {
        errors.push(t('product_ean_exists') || 'Un produit avec cet EAN existe déjà');
      }
    }
    
    return errors;
  };
  
  // Validate all products
  const validateAllProducts = async (): Promise<boolean> => {
    setIsValidating(true);
    let allValid = true;
    
    const updatedProducts = await Promise.all(verifiedProducts.map(async (vp) => {
      if (vp.decision === 'create_new') {
        const errors = await validateProductForCreation(vp);
        if (errors.length > 0) {
          allValid = false;
        }
        return { ...vp, validationErrors: errors, isValidated: errors.length === 0 };
      } else if (vp.decision === 'use_existing' || vp.decision === 'select_other') {
        if (!vp.existingProductId) {
          allValid = false;
          return { ...vp, validationErrors: [t('select_product') || 'Veuillez sélectionner un produit'], isValidated: false };
        }
        return { ...vp, validationErrors: [], isValidated: true };
      }
      return vp;
    }));
    
    setVerifiedProducts(updatedProducts);
    setIsValidating(false);
    
    return allValid;
  };
  
  // Handle continue button
  const handleContinue = async () => {
    const isValid = await validateAllProducts();
    
    if (!isValid) {
      toast.error(t('fix_errors_before_continue') || 'Veuillez corriger les erreurs avant de continuer');
      
      // Expand all lines with errors
      const linesWithErrors = new Set<number>();
      verifiedProducts.forEach(vp => {
        if (vp.validationErrors.length > 0 || (vp.decision !== 'create_new' && !vp.existingProductId)) {
          linesWithErrors.add(vp.lineIndex);
        }
      });
      setExpandedLines(prev => new Set([...prev, ...linesWithErrors]));
      return;
    }
    
    // Process products - create new ones and update stock for existing ones
    setIsValidating(true);
    
    try {
      for (const vp of verifiedProducts) {
        setVerifiedProducts(prev => prev.map(p => 
          p.lineIndex === vp.lineIndex ? { ...p, isProcessing: true } : p
        ));
        
        if (vp.decision === 'create_new') {
          // Create new product using form data
          const fd = vp.productFormData;
          const currentStock = fd.unlimitedStock ? 0 : (parseInt(fd.currentStock) || 0);
          
          const { data: newProduct, error } = await supabase
            .from('products')
            .insert({
              organization_id: organizationId,
              name: fd.name.trim(),
              reference: fd.reference.trim() || null,
              ean: fd.ean?.trim() || null,
              product_type: fd.productType,
              vat_rate: fd.vatRate || 0,
              price_ht: parseFloat(fd.priceHt) || 0,
              price_ttc: parseFloat(fd.priceTtc) || 0,
              unit: fd.unit || 'piece',
              purchase_year: fd.purchaseYear,
              max_discount: fd.maxDiscount ? parseFloat(fd.maxDiscount) : null,
              unlimited_stock: fd.unlimitedStock,
              allow_out_of_stock_sale: fd.allowOutOfStockSale,
              current_stock: currentStock,
              status: 'active',
            })
            .select()
            .single();
          
          if (error) throw error;
          
          // Create stock movement for initial stock
          if (currentStock > 0) {
            await supabase.from('stock_movements').insert({
              product_id: newProduct.id,
              movement_type: 'add',
              quantity: currentStock,
              previous_stock: 0,
              new_stock: currentStock,
              reason_category: 'manualAdjustment',
              reason_detail: 'excelImport',
            });
          }
          
          // Update verified product with new ID
          setVerifiedProducts(prev => prev.map(p => 
            p.lineIndex === vp.lineIndex 
              ? { ...p, existingProductId: newProduct.id, isProcessing: false, isValidated: true } 
              : p
          ));
          
          toast.success(`${t('product_created') || 'Produit créé'}: ${fd.name}`);
          
        } else if (vp.existingProductId) {
          // Update stock for existing product
          const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', vp.existingProductId)
            .single();
          
          if (fetchError) throw fetchError;
          
          const previousStock = currentProduct?.current_stock || 0;
          const quantityToAdd = vp.productDetails.quantity;
          const newStock = previousStock + quantityToAdd;
          
          // Update product stock
          const { error: updateError } = await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', vp.existingProductId);
          
          if (updateError) throw updateError;
          
          // Create stock movement
          await supabase.from('stock_movements').insert({
            product_id: vp.existingProductId,
            movement_type: 'add',
            quantity: quantityToAdd,
            previous_stock: previousStock,
            new_stock: newStock,
            reason_category: 'production',
            reason_detail: 'manufactured',
          });
          
          setVerifiedProducts(prev => prev.map(p => 
            p.lineIndex === vp.lineIndex ? { ...p, isProcessing: false, isValidated: true } : p
          ));
          
          toast.success(`${t('stock_updated') || 'Stock mis à jour'}: ${vp.existingProduct?.name} (+${quantityToAdd})`);
        }
      }
      
      // All done - proceed to next step
      setIsValidating(false);
      onVerificationComplete(verifiedProducts);
      
    } catch (error) {
      console.error('Processing error:', error);
      toast.error(t('processing_error') || 'Erreur lors du traitement');
      setIsValidating(false);
      
      // Reset processing state
      setVerifiedProducts(prev => prev.map(p => ({ ...p, isProcessing: false })));
    }
  };
  
  // Get match type badge
  const getMatchBadge = (matchType: 'reference' | 'ean' | 'name') => {
    const colors = {
      reference: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
      ean: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400',
      name: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
    };
    const labels = {
      reference: t('match_reference') || 'Référence',
      ean: t('match_ean') || 'EAN',
      name: t('match_name') || 'Nom',
    };
    return (
      <Badge variant="outline" className={colors[matchType]}>
        {labels[matchType]}
      </Badge>
    );
  };
  
  if (isSearching) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {t('searching_existing_products') || 'Recherche des produits existants...'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const matchedCount = verifiedProducts.filter(vp => vp.existingProductId && vp.decision !== 'create_new').length;
  const newCount = verifiedProducts.filter(vp => vp.decision === 'create_new').length;
  
  // Get current product for dialog
  const currentEditingProduct = editingLineIndex !== null 
    ? verifiedProducts.find(vp => vp.lineIndex === editingLineIndex)
    : null;
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            {t('product_verification') || 'Vérification des produits'}
          </CardTitle>
          <CardDescription>
            {t('product_verification_description') || 'Vérifiez et associez les produits extraits avec votre catalogue'}
          </CardDescription>
          
          {/* Summary badges */}
          <div className="flex gap-2 mt-4">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400">
              <Link2 className="h-3 w-3 mr-1" />
              {matchedCount} {t('matched') || 'associés'}
            </Badge>
            <Badge variant="outline" className="bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400">
              <Plus className="h-3 w-3 mr-1" />
              {newCount} {t('to_create') || 'à créer'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-3 pr-4">
              {verifiedProducts.map((vp, index) => {
                const matches = searchResults[index] || [];
                const hasMatch = matches.length > 0;
                const isExpanded = expandedLines.has(index);
                
                return (
                  <Collapsible 
                    key={index}
                    open={isExpanded}
                    onOpenChange={() => toggleLine(index)}
                  >
                    <div className={`border rounded-lg ${
                      vp.validationErrors.length > 0 
                        ? 'border-destructive bg-destructive/5' 
                        : vp.isValidated 
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-border'
                    }`}>
                      {/* Header */}
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            
                            <div className="flex flex-col">
                              <span className="font-medium">{vp.productDetails.name}</span>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {vp.productDetails.reference && (
                                  <span>Réf: {vp.productDetails.reference}</span>
                                )}
                                <span>Qté: {vp.productDetails.quantity}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {vp.isProcessing && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            
                            {vp.isValidated && !vp.isProcessing && (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            )}
                            
                            {vp.validationErrors.length > 0 && (
                              <XCircle className="h-5 w-5 text-destructive" />
                            )}
                            
                            {hasMatch && vp.decision === 'use_existing' && vp.existingProduct && (
                              <div className="flex items-center gap-1">
                                <Link2 className="h-4 w-4 text-emerald-600" />
                                {getMatchBadge(vp.existingProduct.matchType)}
                              </div>
                            )}
                            
                            {vp.decision === 'create_new' && (
                              <Badge variant="outline" className="bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400">
                                <Plus className="h-3 w-3 mr-1" />
                                {t('new') || 'Nouveau'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      {/* Content */}
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-4">
                          <Separator />
                          
                          {/* Decision Radio Group */}
                          <RadioGroup 
                            value={vp.decision} 
                            onValueChange={(value) => handleDecisionChange(index, value as ProductDecision)}
                            className="space-y-3"
                          >
                            {/* Option 1: Use existing match */}
                            {hasMatch && (
                              <div className={`p-3 rounded-lg border transition-colors ${
                                vp.decision === 'use_existing' 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:border-primary/50'
                              }`}>
                                <div className="flex items-start gap-3">
                                  <RadioGroupItem value="use_existing" id={`existing-${index}`} className="mt-1" />
                                  <div className="flex-1">
                                    <Label htmlFor={`existing-${index}`} className="font-medium cursor-pointer">
                                      <div className="flex items-center gap-2">
                                        <Link2 className="h-4 w-4" />
                                        {t('use_existing_product') || 'Utiliser le produit existant'}
                                        {matches[0] && getMatchBadge(matches[0].matchType)}
                                      </div>
                                    </Label>
                                    
                                    {vp.decision === 'use_existing' && (
                                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <p className="font-medium">{matches[0]?.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                              Réf: {matches[0]?.reference || '-'} | EAN: {matches[0]?.ean || '-'}
                                            </p>
                                          </div>
                                          <div className="text-end">
                                            <p className="text-sm">
                                              Stock actuel: <strong>{matches[0]?.current_stock || 0}</strong>
                                            </p>
                                            <p className="text-sm text-emerald-600">
                                              → Nouveau stock: <strong>{(matches[0]?.current_stock || 0) + vp.productDetails.quantity}</strong>
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Option 2: Select another product */}
                            <div className={`p-3 rounded-lg border transition-colors ${
                              vp.decision === 'select_other' 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary/50'
                            }`}>
                              <div className="flex items-start gap-3">
                                <RadioGroupItem value="select_other" id={`other-${index}`} className="mt-1" />
                                <div className="flex-1">
                                  <Label htmlFor={`other-${index}`} className="font-medium cursor-pointer">
                                    <div className="flex items-center gap-2">
                                      <Search className="h-4 w-4" />
                                      {t('select_other_product') || 'Sélectionner un autre produit'}
                                    </div>
                                  </Label>
                                  
                                  {vp.decision === 'select_other' && (
                                    <div className="mt-3 space-y-2">
                                      <Input
                                        placeholder={t('search_product') || 'Rechercher un produit...'}
                                        value={productSearchQuery[index] || ''}
                                        onChange={(e) => handleSearchProducts(index, e.target.value)}
                                      />
                                      
                                      {(searchResults[index] || []).length > 0 && (
                                        <div className="max-h-48 overflow-y-auto border rounded-lg">
                                          {searchResults[index].map(product => (
                                            <div
                                              key={product.id}
                                              className={`p-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                                                vp.existingProductId === product.id ? 'bg-primary/10' : ''
                                              }`}
                                              onClick={() => handleSelectExistingProduct(index, product)}
                                            >
                                              <div className="flex justify-between items-center">
                                                <div>
                                                  <p className="font-medium">{product.name}</p>
                                                  <p className="text-xs text-muted-foreground">
                                                    Réf: {product.reference || '-'} | Stock: {product.current_stock || 0}
                                                  </p>
                                                </div>
                                                {vp.existingProductId === product.id && (
                                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {vp.existingProduct && (
                                        <Alert className="bg-emerald-500/10 border-emerald-500/30">
                                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                          <AlertDescription>
                                            Produit sélectionné: <strong>{vp.existingProduct.name}</strong>
                                            <br />
                                            <span className="text-sm">
                                              Stock actuel: {vp.existingProduct.current_stock || 0} → 
                                              Nouveau: {(vp.existingProduct.current_stock || 0) + vp.productDetails.quantity}
                                            </span>
                                          </AlertDescription>
                                        </Alert>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Option 3: Create new product */}
                            <div className={`p-3 rounded-lg border transition-colors ${
                              vp.decision === 'create_new' 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary/50'
                            }`}>
                              <div className="flex items-start gap-3">
                                <RadioGroupItem value="create_new" id={`new-${index}`} className="mt-1" />
                                <div className="flex-1">
                                  <Label htmlFor={`new-${index}`} className="font-medium cursor-pointer">
                                    <div className="flex items-center gap-2">
                                      <Plus className="h-4 w-4" />
                                      {t('create_new_product') || 'Créer un nouveau produit'}
                                    </div>
                                  </Label>
                                  
                                  {vp.decision === 'create_new' && (
                                    <div className="mt-3 space-y-3">
                                      {/* Summary of product form data */}
                                      <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('name') || 'Nom'}:</span>
                                          <span className="font-medium">{vp.productFormData.name || '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('reference') || 'Référence'}:</span>
                                          <span>{vp.productFormData.reference || '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('unit') || 'Unité'}:</span>
                                          <span>{vp.productFormData.unit || 'piece'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('vatRate') || 'TVA'}:</span>
                                          <span>{vp.productFormData.vatRate !== null ? `${vp.productFormData.vatRate}%` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('priceHT') || 'Prix HT'}:</span>
                                          <span>{vp.productFormData.priceHt || '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-muted-foreground">{t('currentStock') || 'Stock initial'}:</span>
                                          <span>{vp.productFormData.unlimitedStock ? '∞' : vp.productFormData.currentStock}</span>
                                        </div>
                                      </div>
                                      
                                      {/* Button to open full form */}
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openProductFormDialog(index);
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                        {t('edit_product_details') || 'Modifier les détails du produit'}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </RadioGroup>
                          
                          {/* Validation errors */}
                          {vp.validationErrors.length > 0 && (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <ul className="list-disc list-inside">
                                  {vp.validationErrors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
          
          {/* Continue Button */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleContinue}
              disabled={isValidating}
              className="gap-2"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('processing') || 'Traitement...'}
                </>
              ) : (
                <>
                  {t('validate_and_continue') || 'Valider et continuer'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Product Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {t('create_new_product') || 'Créer un nouveau produit'}
            </DialogTitle>
          </DialogHeader>
          
          {currentEditingProduct && (
            <ProductForm
              initialData={currentEditingProduct.productFormData}
              onSubmit={handleProductFormSubmit}
              onCancel={() => {
                setFormDialogOpen(false);
                setEditingLineIndex(null);
              }}
              isLoading={false}
              isEdit={false}
              isDuplicate={false}
              organizationId={organizationId}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
