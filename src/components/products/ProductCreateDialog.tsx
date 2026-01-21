import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProductForm } from './ProductForm';
import { Product, ProductFormData } from './types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  duplicateFrom?: Product | null;
}

export const ProductCreateDialog: React.FC<ProductCreateDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
  duplicateFrom,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        setOrganizationId(org?.id || null);
      }
    };
    fetchOrganization();
  }, []);

  const initialData: Partial<ProductFormData> | undefined = duplicateFrom ? {
    reference: '', // Will be auto-generated
    ean: '', // Always empty for duplicates
    name: duplicateFrom.name, // Will be prefixed with "Copy of" in form
    productType: duplicateFrom.product_type,
    vatRate: duplicateFrom.vat_rate,
    priceHt: duplicateFrom.price_ht.toString(),
    priceTtc: duplicateFrom.price_ttc.toString(),
    unit: duplicateFrom.unit || '',
    purchaseYear: duplicateFrom.purchase_year,
    maxDiscount: duplicateFrom.max_discount?.toString() || '',
    unlimitedStock: duplicateFrom.unlimited_stock,
    allowOutOfStockSale: duplicateFrom.allow_out_of_stock_sale ?? false,
    currentStock: duplicateFrom.current_stock?.toString() || '0',
  } : undefined;

  const handleSubmit = async (data: ProductFormData) => {
    if (!organizationId) {
      toast.error(t('noOrganization'));
      return;
    }

    setIsLoading(true);
    try {
      // Check for duplicate name
      const { data: existingName } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', data.name.trim())
        .maybeSingle();

      if (existingName) {
        toast.error(t('productNameExists'));
        setIsLoading(false);
        return;
      }

      // Check for duplicate reference (if provided)
      if (data.reference?.trim()) {
        const { data: existingRef } = await supabase
          .from('products')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('reference', data.reference.trim())
          .maybeSingle();

        if (existingRef) {
          toast.error(t('productReferenceExists'));
          setIsLoading(false);
          return;
        }
      }

      // Check for duplicate EAN (if provided)
      if (data.ean?.trim()) {
        const { data: existingEan } = await supabase
          .from('products')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('ean', data.ean.trim())
          .maybeSingle();

        if (existingEan) {
          toast.error(t('productEanExists'));
          setIsLoading(false);
          return;
        }
      }

      const productData = {
        organization_id: organizationId,
        reference: data.reference?.trim() || null,
        ean: data.ean?.trim() || null,
        name: data.name.trim(),
        product_type: data.productType,
        vat_rate: data.vatRate!,
        price_ht: parseFloat(data.priceHt),
        price_ttc: parseFloat(data.priceTtc),
        unit: data.unit || null,
        purchase_year: data.purchaseYear,
        max_discount: data.maxDiscount ? parseFloat(data.maxDiscount) : null,
        unlimited_stock: data.unlimitedStock,
        allow_out_of_stock_sale: data.unlimitedStock ? null : data.allowOutOfStockSale,
        current_stock: data.unlimitedStock ? null : parseInt(data.currentStock) || 0,
      };

      const { error } = await supabase
        .from('products')
        .insert(productData);

      if (error) throw error;

      toast.success(duplicateFrom ? t('productDuplicated') : t('productCreated'));
      onCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Create error:', error);
      if (error.code === '23505') {
        toast.error(t('productNameExists'));
      } else {
        toast.error(t('genericError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 glass-strong">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl gradient-text">
            {duplicateFrom ? t('duplicateProduct') : t('createProduct')}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          <ProductForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={isLoading}
            isDuplicate={!!duplicateFrom}
            organizationId={organizationId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
