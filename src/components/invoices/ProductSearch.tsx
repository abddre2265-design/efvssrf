import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, Filter, Plus, Package, Infinity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VAT_RATES } from './types';

interface Product {
  id: string;
  name: string;
  reference: string | null;
  ean: string | null;
  price_ht: number;
  vat_rate: number;
  max_discount: number | null;
  current_stock: number | null;
  unlimited_stock: boolean;
  allow_out_of_stock_sale: boolean | null;
  reserved_stock: number;
}

interface ProductSearchProps {
  onSelectProduct: (product: Product) => void;
  organizationId: string | null;
}

export const ProductSearch: React.FC<ProductSearchProps> = ({
  onSelectProduct,
  organizationId,
}) => {
  const { t, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [vatFilter, setVatFilter] = useState<string>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');

  const searchProducts = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, name, reference, ean, price_ht, vat_rate, max_discount, current_stock, unlimited_stock, allow_out_of_stock_sale, reserved_stock')
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      // Search by name, reference, or EAN
      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,reference.ilike.%${searchQuery}%,ean.ilike.%${searchQuery}%`);
      }

      // VAT filter
      if (vatFilter !== 'all') {
        query = query.eq('vat_rate', parseInt(vatFilter));
      }

      // Price filters
      if (minPrice) {
        query = query.gte('price_ht', parseFloat(minPrice));
      }
      if (maxPrice) {
        query = query.lte('price_ht', parseFloat(maxPrice));
      }

      // Stock filters (only for non-unlimited stock)
      if (minStock) {
        query = query.or(`unlimited_stock.eq.true,current_stock.gte.${parseInt(minStock)}`);
      }
      if (maxStock) {
        query = query.or(`unlimited_stock.eq.true,current_stock.lte.${parseInt(maxStock)}`);
      }

      query = query.order('name').limit(50);

      const { data, error } = await query;

      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, searchQuery, vatFilter, minPrice, maxPrice, minStock, maxStock]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchProducts();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchProducts]);

  const clearFilters = () => {
    setVatFilter('all');
    setMinPrice('');
    setMaxPrice('');
    setMinStock('');
    setMaxStock('');
  };

  const hasFilters = vatFilter !== 'all' || minPrice || maxPrice || minStock || maxStock;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_product_placeholder')}
            className={isRTL ? 'pr-10' : 'pl-10'}
          />
        </div>
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant={hasFilters ? 'default' : 'outline'} size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">{t('filters')}</h4>
              
              {/* VAT Filter */}
              <div className="space-y-2">
                <label className="text-sm">{t('vat_rate')}</label>
                <Select value={vatFilter} onValueChange={setVatFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all')}</SelectItem>
                    {VAT_RATES.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <label className="text-sm">{t('price_range')}</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={t('min')}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder={t('max')}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Stock Range */}
              <div className="space-y-2">
                <label className="text-sm">{t('stock_range')}</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={t('min')}
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder={t('max')}
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                  />
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                {t('clear_filters')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Product List */}
      <ScrollArea className="h-[300px] border rounded-lg">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {t('loading')}...
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mb-2" />
              {searchQuery ? t('no_products_found') : t('search_to_find_products')}
            </div>
          ) : (
            products.map((product) => {
              // Available stock = current_stock - reserved_stock
              const availableStock = (product.current_stock || 0) - (product.reserved_stock || 0);
              const isOutOfStock = !product.unlimited_stock && 
                availableStock <= 0 && 
                !product.allow_out_of_stock_sale;
              
              return (
                <div
                  key={product.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    isOutOfStock 
                      ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                      : 'hover:bg-muted/50 cursor-pointer'
                  }`}
                  onClick={() => !isOutOfStock && onSelectProduct(product)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{product.name}</div>
                    <div className="text-sm text-muted-foreground flex gap-2">
                      {product.reference && (
                        <span className="font-mono">{product.reference}</span>
                      )}
                      {product.ean && (
                        <span className="font-mono text-xs">{product.ean}</span>
                      )}
                    </div>
                    {isOutOfStock && (
                      <div className="text-xs text-destructive mt-1">
                        {t('out_of_stock_not_allowed')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Stock */}
                    <div className="text-right">
                      {product.unlimited_stock ? (
                        <Badge variant="outline" className="gap-1">
                          <Infinity className="h-3 w-3" />
                          {t('unlimited')}
                        </Badge>
                      ) : (
                        <Badge
                          variant={
                            availableStock > 0
                              ? 'outline'
                              : product.allow_out_of_stock_sale
                              ? 'secondary'
                              : 'destructive'
                          }
                          title={`${t('available')}: ${availableStock} / ${t('total')}: ${product.current_stock || 0}`}
                        >
                          {availableStock}
                        </Badge>
                      )}
                    </div>
                    {/* Price */}
                    <div className="text-right min-w-[80px]">
                      <div className="font-medium">{product.price_ht.toFixed(3)} DT</div>
                      <div className="text-xs text-muted-foreground">TVA {product.vat_rate}%</div>
                    </div>
                    {/* Add Button */}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      disabled={isOutOfStock}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
