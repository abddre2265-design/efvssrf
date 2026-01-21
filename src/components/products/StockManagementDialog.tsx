import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ArrowRight, TrendingUp, TrendingDown, Package, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Product, STOCK_ADD_REASONS, STOCK_REMOVE_REASONS } from './types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StockManagementDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const StockManagementDialog: React.FC<StockManagementDialogProps> = ({
  product,
  open,
  onOpenChange,
  onUpdate,
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [quantity, setQuantity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!product || product.unlimited_stock) return null;

  const currentStock = product.current_stock ?? 0;
  const reasons = mode === 'add' ? STOCK_ADD_REASONS : STOCK_REMOVE_REASONS;

  const handleSubmit = async () => {
    if (!quantity || !selectedCategory || !selectedReason) {
      toast.error(t('fillAllFields'));
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('invalidQuantity'));
      return;
    }

    if (mode === 'remove' && qty > currentStock) {
      toast.error(t('insufficientStock'));
      return;
    }

    setIsLoading(true);
    try {
      const newStock = mode === 'add' ? currentStock + qty : currentStock - qty;

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: product.id,
          movement_type: mode,
          quantity: qty,
          reason_category: selectedCategory,
          reason_detail: selectedReason,
          previous_stock: currentStock,
          new_stock: newStock,
        });

      if (movementError) throw movementError;

      const { error: updateError } = await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', product.id);

      if (updateError) throw updateError;

      toast.success(t('stockUpdated'));
      onUpdate();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Stock update error:', error);
      toast.error(t('genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setQuantity('');
    setSelectedCategory('');
    setSelectedReason('');
    setMode('add');
  };

  const previewStock = () => {
    const qty = parseInt(quantity) || 0;
    return mode === 'add' ? currentStock + qty : Math.max(0, currentStock - qty);
  };

  const isFormValid = quantity && selectedCategory && selectedReason && parseInt(quantity) > 0;

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetForm(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 glass-strong overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl gradient-text flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t('manageStock')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{product.name}</p>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-180px)] max-h-[500px]">
          <div className="p-6 space-y-6">
            {/* Current Stock Display */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 p-6"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    {t('currentStock')}
                  </p>
                  <motion.p 
                    key={currentStock}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-bold"
                  >
                    {currentStock}
                  </motion.p>
                  <Badge variant="outline" className="mt-2">
                    {product.unit ? t(product.unit) : t('piece')}
                  </Badge>
                </div>

                <AnimatePresence mode="wait">
                  {quantity && parseInt(quantity) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-4"
                    >
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <ArrowRight className="w-6 h-6 text-muted-foreground" />
                      </motion.div>
                      
                      <div className="space-y-1 text-right">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          {t('newStock')}
                        </p>
                        <motion.p 
                          key={previewStock()}
                          initial={{ scale: 1.2, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={`text-4xl font-bold ${
                            mode === 'add' ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {previewStock()}
                        </motion.p>
                        <div className="flex items-center gap-1 justify-end">
                          {mode === 'add' ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                          <span className={`text-sm font-medium ${
                            mode === 'add' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {mode === 'add' ? '+' : '-'}{quantity}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('selectOperation')}</Label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode('add'); setSelectedCategory(''); setSelectedReason(''); }}
                  className={`relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 ${
                    mode === 'add' 
                      ? 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400 shadow-lg shadow-green-500/20' 
                      : 'border-border/50 hover:border-green-500/50 hover:bg-green-500/5'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${mode === 'add' ? 'bg-green-500/20' : 'bg-muted'}`}>
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="font-medium">{t('addStock')}</span>
                  {mode === 'add' && (
                    <motion.div
                      layoutId="modeIndicator"
                      className="absolute inset-0 border-2 border-green-500 rounded-xl"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode('remove'); setSelectedCategory(''); setSelectedReason(''); }}
                  className={`relative flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 ${
                    mode === 'remove' 
                      ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 shadow-lg shadow-red-500/20' 
                      : 'border-border/50 hover:border-red-500/50 hover:bg-red-500/5'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${mode === 'remove' ? 'bg-red-500/20' : 'bg-muted'}`}>
                    <Minus className="w-5 h-5" />
                  </div>
                  <span className="font-medium">{t('removeStock')}</span>
                  {mode === 'remove' && (
                    <motion.div
                      layoutId="modeIndicator"
                      className="absolute inset-0 border-2 border-red-500 rounded-xl"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              </div>
            </div>

            <Separator />

            {/* Quantity Input */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('quantity')} *</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  max={mode === 'remove' ? currentStock : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="futuristic-input text-lg h-12 pr-16"
                  placeholder="0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {product.unit ? t(product.unit) : t('piece')}
                </div>
              </div>
              {mode === 'remove' && currentStock > 0 && (
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map(percent => {
                    const value = Math.floor(currentStock * percent / 100);
                    if (value === 0) return null;
                    return (
                      <Button
                        key={percent}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(value.toString())}
                        className="text-xs"
                      >
                        {percent}% ({value})
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Reason Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('reason')} *</Label>
              
              <div className="space-y-3">
                {Object.entries(reasons).map(([category, reasonList]) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-border/50 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(selectedCategory === category ? '' : category)}
                      className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                        selectedCategory === category 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <span className="font-medium">{t(category)}</span>
                      <motion.span
                        animate={{ rotate: selectedCategory === category ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        ▼
                      </motion.span>
                    </button>
                    
                    <AnimatePresence>
                      {selectedCategory === category && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-border/50"
                        >
                          <div className="p-2 grid grid-cols-2 gap-2">
                            {reasonList.map((reason) => (
                              <motion.button
                                key={reason}
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedReason(reason)}
                                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm text-left transition-all ${
                                  selectedReason === reason 
                                    ? `${mode === 'add' ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50'}` 
                                    : 'hover:bg-muted/50 border border-transparent'
                                }`}
                              >
                                {selectedReason === reason && (
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                )}
                                <span className="truncate">{t(reason)}</span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Selected Summary */}
            <AnimatePresence>
              {isFormValid && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 p-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{t('selectedReason')}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">{t(selectedCategory)}</span>
                        {' → '}
                        {t(selectedReason)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border/50 bg-muted/30">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !isFormValid}
            className={`min-w-[120px] ${
              mode === 'add' 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                {mode === 'add' ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
                {t('confirm')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
