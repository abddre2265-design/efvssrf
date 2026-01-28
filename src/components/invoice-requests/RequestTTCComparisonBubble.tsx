import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const difference = requestTTC - currentTTC;
  const isMatch = Math.abs(difference) < 0.001;
  const isOver = difference < -0.001;
  const isUnder = difference > 0.001;

  const formatAmount = (amount: number) => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  const bubbleContent = (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        setPosition(prev => ({
          x: prev.x + info.offset.x,
          y: prev.y + info.offset.y
        }));
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: position.x,
        y: position.y
      }}
      whileDrag={{ scale: 1.05, zIndex: 99999 }}
      className={cn(
        "fixed bottom-6 right-6 cursor-grab active:cursor-grabbing select-none",
        isDragging ? "z-[99999]" : "z-[9999]"
      )}
      style={{ touchAction: 'none' }}
    >
      <div
        className={cn(
          "rounded-xl shadow-2xl min-w-[280px] border-2 backdrop-blur-sm overflow-hidden",
          isMatch 
            ? "bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400"
            : "bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-400"
        )}
      >
        {/* Drag handle header */}
        <div 
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            isMatch ? "bg-green-500/20" : "bg-red-500/20"
          )}
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
      </div>
    </motion.div>
  );

  // Use portal to render outside of any containing stacking context
  if (typeof document !== 'undefined') {
    return createPortal(bubbleContent, document.body);
  }
  
  return bubbleContent;
};
