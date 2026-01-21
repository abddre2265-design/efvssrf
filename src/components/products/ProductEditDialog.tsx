import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProductForm } from './ProductForm';
import { Product, ProductFormData } from './types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductEditDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ProductEditDialog: React.FC<ProductEditDialogProps> = ({
  product,
  open,
  onOpenChange,
  onUpdate,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = React.useState(false);

  if (!product) return null;

  const initialData: Partial<ProductFormData> = {
    reference: product.reference || '',
    ean: product.ean || '',
    name: product.name,
    productType: product.product_type,
    vatRate: product.vat_rate,
    priceHt: product.price_ht.toString(),
    priceTtc: product.price_ttc.toString(),
    unit: product.unit || '',
    purchaseYear: product.purchase_year,
    maxDiscount: product.max_discount?.toString() || '',
    unlimitedStock: product.unlimited_stock,
    allowOutOfStockSale: product.allow_out_of_stock_sale ?? false,
    currentStock: product.current_stock?.toString() || '0',
  };

  const handleSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    try {
      // Only update allowed fields
      const updateData = {
        reference: data.reference || null,
        ean: data.ean || null,
        unit: data.unit || null,
        max_discount: data.maxDiscount ? parseFloat(data.maxDiscount) : null,
        allow_out_of_stock_sale: data.allowOutOfStockSale,
        price_ht: parseFloat(data.priceHt),
        price_ttc: parseFloat(data.priceTtc),
      };

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);

      if (error) throw error;

      toast.success(t('productUpdated'));
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Update error:', error);
      toast.error(t('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 glass-strong">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl gradient-text">{t('editProduct')}</DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          <ProductForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={isLoading}
            isEdit={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
