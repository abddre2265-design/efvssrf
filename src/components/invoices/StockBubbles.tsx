import React, { useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Infinity, TrendingDown, Package, GripVertical } from 'lucide-react';
import { StockBubble as StockBubbleType } from './types';

interface StockBubblesProps {
  bubbles: StockBubbleType[];
}

export const StockBubbles: React.FC<StockBubblesProps> = ({ bubbles }) => {
  const { t } = useLanguage();
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);

  if (bubbles.length === 0) return null;

  return (
    <>
      {/* Invisible constraints container covering the viewport */}
      <div 
        ref={constraintsRef} 
        className="fixed inset-0 pointer-events-none z-[99]"
      />
      
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={constraintsRef}
        initial={{ x: 0, y: 0 }}
        className="fixed bottom-20 right-8 z-[100] flex flex-col gap-2 max-w-[280px] cursor-move"
        whileDrag={{ scale: 1.02 }}
      >
        {/* Drag handle header */}
        <div 
          className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-t-lg backdrop-blur-sm"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">{t('stock_status')}</span>
        </div>

        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {bubbles.map((bubble) => (
              <motion.div
                key={bubble.product_id}
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.8 }}
                className={`
                  p-3 rounded-lg shadow-lg backdrop-blur-sm border
                  ${
                    bubble.unlimited_stock
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : bubble.remaining_stock !== null && bubble.remaining_stock < 0
                      ? 'bg-red-500/10 border-red-500/30'
                      : bubble.remaining_stock !== null && bubble.remaining_stock === 0
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-green-500/10 border-green-500/30'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-sm truncate">{bubble.product_name}</span>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  {bubble.unlimited_stock ? (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Infinity className="h-4 w-4" />
                      <span className="text-sm">{t('unlimited_stock')}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">-{bubble.quantity_used}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`
                          ${
                            bubble.remaining_stock !== null && bubble.remaining_stock < 0
                              ? 'border-red-500 text-red-600 dark:text-red-400'
                              : bubble.remaining_stock === 0
                              ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                              : 'border-green-500 text-green-600 dark:text-green-400'
                          }
                        `}
                      >
                        {t('remaining')}: {bubble.remaining_stock ?? 0}
                      </Badge>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};
