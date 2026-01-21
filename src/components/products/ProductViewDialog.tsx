import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Product } from './types';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, BarChart3, ShoppingCart, Calendar } from 'lucide-react';

interface ProductViewDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PurchaseStats {
  lastPurchasePrice: number | null;
  lastPurchaseDate: string | null;
  highestPurchasePrice: number | null;
  lowestPurchasePrice: number | null;
  averagePurchasePrice: number | null;
  totalPurchaseQuantity: number;
  purchaseCount: number;
}

export const ProductViewDialog: React.FC<ProductViewDialogProps> = ({
  product,
  open,
  onOpenChange,
}) => {
  const { t, language, isRTL } = useLanguage();
  const [purchaseStats, setPurchaseStats] = useState<PurchaseStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    if (open && product) {
      fetchPurchaseStats();
    }
  }, [open, product]);

  const fetchPurchaseStats = async () => {
    if (!product) return;
    setIsLoadingStats(true);

    try {
      // Fetch all purchase lines for this product
      const { data: purchaseLines } = await supabase
        .from('purchase_lines')
        .select(`
          *,
          purchase_documents!inner(created_at, exchange_rate, currency)
        `)
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (!purchaseLines || purchaseLines.length === 0) {
        setPurchaseStats({
          lastPurchasePrice: null,
          lastPurchaseDate: null,
          highestPurchasePrice: null,
          lowestPurchasePrice: null,
          averagePurchasePrice: null,
          totalPurchaseQuantity: 0,
          purchaseCount: 0,
        });
        return;
      }

      // Calculate stats - convert prices to TND if needed
      const pricesInTND = purchaseLines.map(line => {
        const exchangeRate = line.purchase_documents?.exchange_rate || 1;
        // unit_price_ht is in original currency, multiply by exchange_rate to get TND
        return line.unit_price_ht * exchangeRate;
      });

      const totalQuantity = purchaseLines.reduce((sum, line) => sum + line.quantity, 0);
      const weightedSum = purchaseLines.reduce((sum, line) => {
        const exchangeRate = line.purchase_documents?.exchange_rate || 1;
        return sum + (line.unit_price_ht * exchangeRate * line.quantity);
      }, 0);

      const lastLine = purchaseLines[0];
      const lastExchangeRate = lastLine.purchase_documents?.exchange_rate || 1;

      setPurchaseStats({
        lastPurchasePrice: lastLine.unit_price_ht * lastExchangeRate,
        lastPurchaseDate: lastLine.created_at,
        highestPurchasePrice: Math.max(...pricesInTND),
        lowestPurchasePrice: Math.min(...pricesInTND),
        averagePurchasePrice: totalQuantity > 0 ? weightedSum / totalQuantity : null,
        totalPurchaseQuantity: totalQuantity,
        purchaseCount: purchaseLines.length,
      });
    } catch (error) {
      console.error('Error fetching purchase stats:', error);
      setPurchaseStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  };

  if (!product) return null;

  const getLocale = () => {
    switch (language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(price);
  };

  const calculateGainRate = (purchasePrice: number) => {
    if (!purchasePrice || purchasePrice === 0) return null;
    // Calculate gain based on TTC selling price vs purchase price
    const gain = ((product.price_ttc - purchasePrice) / purchasePrice) * 100;
    return gain;
  };

  const DetailRow: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex justify-between py-2 items-center">
      <span className="text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );

  const GainBadge: React.FC<{ gain: number | null }> = ({ gain }) => {
    if (gain === null) return <span>-</span>;
    const isPositive = gain >= 0;
    return (
      <Badge 
        variant="outline" 
        className={isPositive 
          ? 'bg-green-500/10 text-green-500 border-green-500/30' 
          : 'bg-red-500/10 text-red-500 border-red-500/30'
        }
      >
        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {gain.toFixed(2)}%
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 glass-strong" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl gradient-text">{t('productDetails')}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] px-6 pb-6">
          <div className="space-y-4 py-4">
            {/* Status */}
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">{product.name}</span>
              <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                {t(product.status)}
              </Badge>
            </div>

            <Separator />

            {/* Basic Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1"
            >
              <DetailRow label={t('reference')} value={product.reference || '-'} />
              <DetailRow label={t('eanBarcode')} value={product.ean || '-'} />
              <DetailRow 
                label={t('productType')} 
                value={
                  <Badge variant="outline">
                    {t(product.product_type === 'physical' ? 'physicalProduct' : 'service')}
                  </Badge>
                } 
              />
            </motion.div>

            <Separator />

            {/* Pricing */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-1"
            >
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">{t('pricing')}</h4>
              <DetailRow label={t('vatRate')} value={`${product.vat_rate}%`} />
              <DetailRow label={t('priceHT')} value={`${formatPrice(product.price_ht)} TND`} />
              <DetailRow label={t('priceTTC')} value={`${formatPrice(product.price_ttc)} TND`} />
              <DetailRow 
                label={t('maxDiscount')} 
                value={product.max_discount != null ? `${product.max_discount}%` : '-'} 
              />
            </motion.div>

            <Separator />

            {/* Purchase Statistics */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-1"
            >
              <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                {t('purchase_statistics')}
              </h4>
              
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : purchaseStats && purchaseStats.purchaseCount > 0 ? (
                <>
                  <DetailRow 
                    label={t('purchase_count')} 
                    value={
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                        {purchaseStats.purchaseCount} {t('purchases_count_label')}
                      </Badge>
                    }
                    icon={<BarChart3 className="h-3 w-3" />}
                  />
                  <DetailRow 
                    label={t('total_quantity_purchased')} 
                    value={purchaseStats.totalPurchaseQuantity}
                  />
                  
                  <Separator className="my-2" />
                  
                  <DetailRow 
                    label={t('last_purchase_price')} 
                    value={
                      <div className="flex items-center gap-2">
                        <span>{formatPrice(purchaseStats.lastPurchasePrice!)} TND</span>
                        <GainBadge gain={calculateGainRate(purchaseStats.lastPurchasePrice!)} />
                      </div>
                    }
                    icon={<Calendar className="h-3 w-3" />}
                  />
                  {purchaseStats.lastPurchaseDate && (
                    <DetailRow 
                      label={t('last_purchase_date')} 
                      value={format(new Date(purchaseStats.lastPurchaseDate), 'PPP', { locale: getLocale() })}
                    />
                  )}
                  
                  <Separator className="my-2" />
                  
                  <DetailRow 
                    label={t('highest_purchase_price')} 
                    value={
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">{formatPrice(purchaseStats.highestPurchasePrice!)} TND</span>
                        <GainBadge gain={calculateGainRate(purchaseStats.highestPurchasePrice!)} />
                      </div>
                    }
                    icon={<TrendingUp className="h-3 w-3 text-red-500" />}
                  />
                  <DetailRow 
                    label={t('lowest_purchase_price')} 
                    value={
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">{formatPrice(purchaseStats.lowestPurchasePrice!)} TND</span>
                        <GainBadge gain={calculateGainRate(purchaseStats.lowestPurchasePrice!)} />
                      </div>
                    }
                    icon={<TrendingDown className="h-3 w-3 text-green-500" />}
                  />
                  <DetailRow 
                    label={t('average_purchase_price')} 
                    value={
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-semibold">{formatPrice(purchaseStats.averagePurchasePrice!)} TND</span>
                        <GainBadge gain={calculateGainRate(purchaseStats.averagePurchasePrice!)} />
                      </div>
                    }
                    icon={<BarChart3 className="h-3 w-3 text-primary" />}
                  />
                  
                  <Separator className="my-2" />
                  
                  <DetailRow 
                    label={t('average_gain_rate')} 
                    value={<GainBadge gain={calculateGainRate(purchaseStats.averagePurchasePrice!)} />}
                  />
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  {t('no_purchase_data')}
                </div>
              )}
            </motion.div>

            <Separator />

            {/* Stock */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-1"
            >
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">{t('stockInfo')}</h4>
              <DetailRow 
                label={t('unlimitedStock')} 
                value={product.unlimited_stock ? t('yes') : t('no')} 
              />
              {!product.unlimited_stock && (
                <>
                  <DetailRow 
                    label={t('allowOutOfStockSale')} 
                    value={product.allow_out_of_stock_sale ? t('yes') : t('no')} 
                  />
                  <DetailRow 
                    label={t('currentStock')} 
                    value={product.current_stock ?? 0} 
                  />
                </>
              )}
            </motion.div>

            <Separator />

            {/* Other */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-1"
            >
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">{t('otherInfo')}</h4>
              <DetailRow label={t('unit')} value={product.unit ? t(product.unit) : '-'} />
              <DetailRow label={t('purchaseYear')} value={product.purchase_year} />
              <DetailRow 
                label={t('createdAt')} 
                value={format(new Date(product.created_at), 'PPP', { locale: getLocale() })} 
              />
            </motion.div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
