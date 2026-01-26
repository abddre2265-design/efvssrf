import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  
  const difference = requestTTC - currentTTC;
  const isMatch = Math.abs(difference) < 0.001;
  const isOver = difference < -0.001;
  const isUnder = difference > 0.001;

  const formatAmount = (amount: number) => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <motion.div
        className={cn(
          "rounded-xl shadow-2xl p-4 min-w-[280px] border-2 backdrop-blur-sm",
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
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium opacity-80">{t('request_ttc')}</span>
          <AnimatePresence mode="wait">
            {isMatch ? (
              <motion.div
                key="match"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <CheckCircle2 className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div
                key="nomatch"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <XCircle className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Request TTC */}
        <div className="text-2xl font-bold mb-2">
          {formatAmount(requestTTC)}
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
      </motion.div>
    </motion.div>
  );
};
