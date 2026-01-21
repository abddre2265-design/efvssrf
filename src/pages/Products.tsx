import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Loader2, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProductTable } from '@/components/products/ProductTable';
import { ProductViewDialog } from '@/components/products/ProductViewDialog';
import { ProductEditDialog } from '@/components/products/ProductEditDialog';
import { ProductCreateDialog } from '@/components/products/ProductCreateDialog';
import { StockManagementDialog } from '@/components/products/StockManagementDialog';
import { ExcelImportDialog } from '@/components/products/ExcelImportDialog';
import { ProductHistoryDialog } from '@/components/products/ProductHistoryDialog';
import { ProductAISearch } from '@/components/products/ProductAISearch';
import { ProductReservationDialog, ViewReservationsDialog } from '@/components/products/reservations';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Product } from '@/components/products/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Products: React.FC = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Product relationships cache (for delete check)
  const [productRelationships, setProductRelationships] = useState<Record<string, boolean>>({});

  // Dialog states
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [reserveProduct, setReserveProduct] = useState<Product | null>(null);
  const [viewReservationsProduct, setViewReservationsProduct] = useState<Product | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [archiveProduct, setArchiveProduct] = useState<Product | null>(null);
  const [restoreProduct, setRestoreProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!org) {
        setProducts([]);
        setFilteredProducts([]);
        return;
      }

      setOrganizationId(org.id);

      // Fetch ALL products (both active and archived)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allProducts = (data as Product[]) || [];
      setProducts(allProducts);
      setFilteredProducts(allProducts);

      // Check product relationships for delete functionality
      await checkProductRelationships(allProducts.map(p => p.id));
    } catch (error) {
      console.error('Fetch products error:', error);
      toast.error(t('genericError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Check if products have any relationships (invoices, credit notes, purchases)
  const checkProductRelationships = async (productIds: string[]) => {
    if (productIds.length === 0) return;

    try {
      // Check invoice_lines
      const { data: invoiceLines } = await supabase
        .from('invoice_lines')
        .select('product_id')
        .in('product_id', productIds);

      // Check credit_note_lines
      const { data: creditNoteLines } = await supabase
        .from('credit_note_lines')
        .select('product_id')
        .in('product_id', productIds);

      // Check purchase_lines
      const { data: purchaseLines } = await supabase
        .from('purchase_lines')
        .select('product_id')
        .in('product_id', productIds);

      // Check stock_movements
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('product_id')
        .in('product_id', productIds);

      // Build relationship map
      const hasRelationship: Record<string, boolean> = {};
      
      productIds.forEach(id => {
        const hasInvoice = invoiceLines?.some(il => il.product_id === id) || false;
        const hasCreditNote = creditNoteLines?.some(cnl => cnl.product_id === id) || false;
        const hasPurchase = purchaseLines?.some(pl => pl.product_id === id) || false;
        const hasStock = stockMovements?.some(sm => sm.product_id === id) || false;
        
        hasRelationship[id] = hasInvoice || hasCreditNote || hasPurchase || hasStock;
      });

      setProductRelationships(hasRelationship);
    } catch (error) {
      console.error('Error checking product relationships:', error);
    }
  };

  const canDeleteProduct = (productId: string): boolean => {
    return productRelationships[productId] === false;
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]);

  const handleArchive = async () => {
    if (!archiveProduct) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: 'archived' })
        .eq('id', archiveProduct.id);

      if (error) throw error;
      toast.success(t('productArchived'));
      setArchiveProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Archive error:', error);
      toast.error(t('genericError'));
    }
  };

  const handleRestore = async () => {
    if (!restoreProduct) return;
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: 'active' })
        .eq('id', restoreProduct.id);

      if (error) throw error;
      toast.success(t('productRestored'));
      setRestoreProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Restore error:', error);
      toast.error(t('genericError'));
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    
    // Double-check that product can be deleted
    if (!canDeleteProduct(deleteProduct.id)) {
      toast.error(t('cannotDeleteProductWithRelations'));
      setDeleteProduct(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteProduct.id);

      if (error) throw error;
      toast.success(t('productDeleted'));
      setDeleteProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('genericError'));
    }
  };

  const handleFilteredProducts = (filtered: Product[]) => {
    setFilteredProducts(filtered);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">{t('products')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('productsDescription')}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t('addProduct')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background border border-border">
            <DropdownMenuItem onClick={() => setCreateDialogOpen(true)} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              {t('manualCreation')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExcelImportOpen(true)} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" />
              {t('importFromExcel')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters - AI Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50">
        <ProductAISearch
          products={products}
          onFilteredProducts={handleFilteredProducts}
          organizationId={organizationId}
        />

        <Button variant="outline" size="icon" onClick={fetchProducts} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Product Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          onView={setViewProduct}
          onEdit={setEditProduct}
          onStock={setStockProduct}
          onDuplicate={(p) => setDuplicateProduct(p)}
          onArchive={setArchiveProduct}
          onRestore={setRestoreProduct}
          onHistory={setHistoryProduct}
          onDelete={setDeleteProduct}
          onReserve={setReserveProduct}
          onViewReservations={setViewReservationsProduct}
          canDeleteProduct={canDeleteProduct}
        />
      )}

      {/* Dialogs */}
      <ProductViewDialog
        product={viewProduct}
        open={!!viewProduct}
        onOpenChange={(open) => !open && setViewProduct(null)}
      />

      <ProductEditDialog
        product={editProduct}
        open={!!editProduct}
        onOpenChange={(open) => !open && setEditProduct(null)}
        onUpdate={fetchProducts}
      />

      <StockManagementDialog
        product={stockProduct}
        open={!!stockProduct}
        onOpenChange={(open) => !open && setStockProduct(null)}
        onUpdate={fetchProducts}
      />

      <ProductCreateDialog
        open={createDialogOpen || !!duplicateProduct}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setDuplicateProduct(null);
          }
        }}
        onCreated={fetchProducts}
        duplicateFrom={duplicateProduct}
      />

      <ExcelImportDialog
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
        onImported={fetchProducts}
      />

      <ProductHistoryDialog
        product={historyProduct}
        open={!!historyProduct}
        onOpenChange={(open) => !open && setHistoryProduct(null)}
      />

      <ProductReservationDialog
        product={reserveProduct}
        open={!!reserveProduct}
        onOpenChange={(open) => !open && setReserveProduct(null)}
        onReserved={fetchProducts}
      />

      <ViewReservationsDialog
        product={viewReservationsProduct}
        open={!!viewReservationsProduct}
        onOpenChange={(open) => !open && setViewReservationsProduct(null)}
        onUpdated={fetchProducts}
      />

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveProduct} onOpenChange={(open) => !open && setArchiveProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archiveProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archiveProductConfirm')} <strong>{archiveProduct?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-amber-500 hover:bg-amber-600">
              {t('archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreProduct} onOpenChange={(open) => !open && setRestoreProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('restoreProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('restoreProductConfirm')} <strong>{restoreProduct?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-green-500 hover:bg-green-600">
              {t('restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProduct')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteProductConfirm')} <strong>{deleteProduct?.name}</strong>?
              <br />
              <span className="text-destructive font-medium">{t('deleteProductWarning')}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default Products;
