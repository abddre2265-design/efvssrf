import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Edit, Package, Copy, Archive, RotateCcw, History, Trash2, ShoppingBag, List } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Product } from './types';

interface ProductTableProps {
  products: Product[];
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onStock: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onArchive: (product: Product) => void;
  onRestore: (product: Product) => void;
  onHistory: (product: Product) => void;
  onDelete: (product: Product) => void;
  onReserve: (product: Product) => void;
  onViewReservations: (product: Product) => void;
  canDeleteProduct: (productId: string) => boolean;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  onView,
  onEdit,
  onStock,
  onDuplicate,
  onArchive,
  onRestore,
  onHistory,
  onDelete,
  onReserve,
  onViewReservations,
  canDeleteProduct,
}) => {
  const { t } = useLanguage();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-TN', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(price);
  };

  const getStockDisplay = (product: Product) => {
    if (product.unlimited_stock) {
      return <Badge variant="secondary">{t('unlimited')}</Badge>;
    }
    const available = (product.current_stock ?? 0) - (product.reserved_stock ?? 0);
    const reserved = product.reserved_stock ?? 0;
    
    if (available <= 0 && reserved === 0) {
      return <Badge variant="destructive">0</Badge>;
    }
    
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Badge variant={available < 10 ? 'outline' : 'outline'} className={available < 10 && available > 0 ? 'text-amber-500 border-amber-500' : available <= 0 ? 'text-destructive border-destructive' : ''}>
          {available}
        </Badge>
        {reserved > 0 && (
          <span className="text-xs text-muted-foreground">
            ({reserved} {t('reserved_short')})
          </span>
        )}
      </div>
    );
  };

  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 text-muted-foreground"
      >
        <Package className="w-12 h-12 mb-4 opacity-50" />
        <p>{t('noProducts')}</p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="text-center">{t('status')}</TableHead>
            <TableHead>{t('eanBarcode')}</TableHead>
            <TableHead>{t('reference')}</TableHead>
            <TableHead>{t('productName')}</TableHead>
            <TableHead className="text-right">{t('priceHT')}</TableHead>
            <TableHead className="text-center">{t('vatRate')}</TableHead>
            <TableHead className="text-right">{t('priceTTC')}</TableHead>
            <TableHead className="text-center">{t('maxDiscount')}</TableHead>
            <TableHead className="text-center">{t('stock')} / {t('reserved_short')}</TableHead>
            <TableHead className="text-center">{t('year')}</TableHead>
            <TableHead className="text-right">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence>
            {products.map((product, index) => (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: index * 0.03 }}
                className="border-b border-border/30 hover:bg-muted/20 transition-colors"
              >
                <TableCell className="text-center">
                  {product.status === 'active' ? (
                    <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/50 hover:bg-green-500/30">
                      {t('active')}
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50 hover:bg-amber-500/30">
                      {t('archived')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {product.ean || '-'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {product.reference || '-'}
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatPrice(product.price_ht)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{product.vat_rate}%</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPrice(product.price_ttc)}
                </TableCell>
                <TableCell className="text-center">
                  {product.max_discount != null ? `${product.max_discount}%` : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {getStockDisplay(product)}
                </TableCell>
                <TableCell className="text-center">{product.purchase_year}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onView(product)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('view')}</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary"
                          onClick={() => onHistory(product)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('history')}</TooltipContent>
                    </Tooltip>

                    {product.status === 'active' && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onEdit(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('edit')}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onStock(product)}
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('manageStock')}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onDuplicate(product)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('duplicate')}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500 hover:text-blue-600"
                              onClick={() => onReserve(product)}
                            >
                              <ShoppingBag className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('reserve')}</TooltipContent>
                        </Tooltip>

                        {(product.reserved_stock ?? 0) > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-purple-500 hover:text-purple-600"
                                onClick={() => onViewReservations(product)}
                              >
                                <List className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('view_reservations')}</TooltipContent>
                          </Tooltip>
                        )}

                        {(product.current_stock === 0 || product.unlimited_stock) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-500 hover:text-amber-600"
                                onClick={() => onArchive(product)}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('archive')}</TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    )}

                    {product.status === 'archived' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-500 hover:text-green-600"
                            onClick={() => onRestore(product)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('restore')}</TooltipContent>
                      </Tooltip>
                    )}

                    {canDeleteProduct(product.id) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDelete(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('delete')}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
};
