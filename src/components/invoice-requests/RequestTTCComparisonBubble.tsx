import React, { useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, GripVertical } from 'lucide-react';

interface RequestTTCComparisonBubbleProps {
  requestTTC: number;
  currentTTC: number;
  currency?: string;
}

export const RequestTTCComparisonBubble: React.FC<RequestTTCComparisonBubbleProps> = ({
  requestTTC,
  currentTTC,
  currency = 'TND',
}) => {
  const { t } = useLanguage();
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);
  
  const difference = requestTTC - currentTTC;
  const isMatch = Math.abs(difference) < 0.001;
  const isOver = difference < -0.001;
  const isUnder = difference > 0.001;

  const formatAmount = (amount: number) => {
    return `${amount.toFixed(3)} ${currency}`;
  };

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
        initial={{ opacity: 0, y: 20, x: 0 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-6 right-6 z-[100] cursor-move"
        whileDrag={{ scale: 1.02 }}
      >
        <motion.div
          className={cn(
            "rounded-xl shadow-2xl min-w-[280px] border-2 backdrop-blur-sm overflow-hidden",
            isMatch 
              ? "bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400"
              : "bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-400"
          )}
          animate={{
            scale: isMatch ? [1, 1.02, 1] : 1,
          }}
          transition={{
            duration: 0.5,
            repeat: isMatch ? 2 : 0,
          }}
        >
          {/* Drag handle header */}
          <div 
            className={cn(
              "flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing",
              isMatch ? "bg-green-500/20" : "bg-red-500/20"
            )}
            onPointerDown={(e) => dragControls.start(e)}
          >
            <GripVertical className="h-4 w-4" />
            <span className="text-sm font-medium">{t('ttc_comparison')}</span>
            <AnimatePresence mode="wait">
              {isMatch ? (
                <motion.div
                  key="match"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="ml-auto"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="nomatch"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="ml-auto"
                >
                  <XCircle className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 pt-2">
            {/* Request TTC */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-80">{t('request_ttc')}</span>
              <span className="text-lg font-bold">{formatAmount(requestTTC)}</span>
            </div>

            {/* Current TTC */}
            <div className="flex items-center justify-between text-sm mb-2 opacity-80">
              <span>{t('current_invoice_ttc')}</span>
              <span className="font-mono">{formatAmount(currentTTC)}</span>
            </div>

            {/* Difference */}
            <div 
              className={cn(
                "flex items-center justify-between pt-2 border-t",
                isMatch ? "border-green-500/30" : "border-red-500/30"
              )}
            >
              <span className="text-sm font-medium">{t('difference')}</span>
              <div className="flex items-center gap-1">
                {isOver && <TrendingDown className="h-4 w-4" />}
                {isUnder && <TrendingUp className="h-4 w-4" />}
                {isMatch && <Minus className="h-4 w-4" />}
                <span className="font-mono font-bold">
                  {isOver ? '+' : isUnder ? '-' : ''}
                  {formatAmount(Math.abs(difference))}
                </span>
              </div>
            </div>

            {/* Status message */}
            <div className="mt-3 text-xs text-center">
              {isMatch ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ {t('amounts_match_validation_enabled')}
                </span>
              ) : isOver ? (
                <span className="text-red-600 dark:text-red-400">
                  {t('invoice_exceeds_request')}
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  {t('invoice_below_request')}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
};
